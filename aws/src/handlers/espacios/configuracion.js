// src/handlers/espacios/configuracion.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, BatchWriteCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");
const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const { Logger } = require("../../utils/logger");
const { createAPIHandler } = require("../../middleware/interceptors");
const { successResponse, errorResponse } = require("../../utils/errorHandler");
const { AuthorizationError, ValidationError, NotFoundError } = require("../../utils/errorHandler");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

async function asignarGrupoActivoHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
  
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");

  const body = JSON.parse(event.body || "{}");
  const { grupo_id } = body;

  if (!grupo_id) {
    throw new ValidationError("grupo_id es requerido");
  }

  logger.info('Asignando grupo activo', { grupo_id, userSub });

  // Verificar que el grupo existe en GROUPS_TABLE
  const verificacion = await retryWithJitter(
    async () => {
      if (!dynamoBreaker.shouldAllow()) {
        throw new Error("CircuitBreakerOpen");
      }
      
      const res = await docClient.send(new GetCommand({
        TableName: process.env.GROUPS_TABLE,
        Key: {
          group_id: grupo_id
        }
      }));
      
      dynamoBreaker.reportSuccess();
      return res;
    },
    { maxAttempts: 3, baseDelayMs: 300 }
  );

  if (!verificacion.Item) {
    throw new NotFoundError("Grupo no encontrado");
  }

  // Verificar que el usuario es miembro o owner del grupo
  const grupo = verificacion.Item;
  const isOwner = grupo.owner_sub === userSub;
  
  // Verificar membresía
  let isMember = false;
  try {
    const memberCheck = await docClient.send(new GetCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { group_id: grupo_id, user_sub: userSub }
    }));
    isMember = !!memberCheck.Item;
  } catch (err) {
    logger.warn('Error verificando membresía', { error: err.message });
  }

  if (!isOwner && !isMember) {
    throw new AuthorizationError("No tienes acceso a este grupo");
  }

  const timestamp = new Date().toISOString();

  logger.info('Guardando grupo activo', { grupo_id });

  // Guardar el grupo activo en PARAMETERS_TABLE
  await retryWithJitter(
    async () => {
      if (!dynamoBreaker.shouldAllow()) {
        throw new Error("CircuitBreakerOpen");
      }
      
      await docClient.send(new PutCommand({
        TableName: process.env.PARAMETERS_TABLE,
        Item: {
          user_sub: userSub,
          parameter_key: 'espacios.grupo_activo',
          parameter_value: {
            grupo_id: grupo_id,
            asignado_en: timestamp
          },
          updated_at: timestamp,
          email: userEmail
        }
      }));
      
      dynamoBreaker.reportSuccess();
    },
    { maxAttempts: 3, baseDelayMs: 300 }
  );

  logger.info('Grupo asignado como activo', { grupo_id, userSub });

  return successResponse({
    ok: true,
    message: "Grupo asignado correctamente",
    grupo_activo: {
      grupo_id: grupo_id,
      nombre: grupo.nombre,
      nomenclatura: grupo.nomenclatura || null,
      configured: grupo.configured || false
    }
  });
}

module.exports.asignarGrupoActivo = createAPIHandler(asignarGrupoActivoHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });

async function obtenerGrupoActivoHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");

  logger.info('Obteniendo grupo activo', { userSub });

  const result = await retryWithJitter(
    async () => {
      if (!dynamoBreaker.shouldAllow()) {
        throw new Error("CircuitBreakerOpen");
      }
      
      const res = await docClient.send(new GetCommand({
        TableName: process.env.PARAMETERS_TABLE,
        Key: {
          user_sub: userSub,
          parameter_key: 'espacios.grupo_activo'
        }
      }));
      
      dynamoBreaker.reportSuccess();
      return res;
    },
    { maxAttempts: 3, baseDelayMs: 300 }
  );

  if (!result.Item) {
    throw new NotFoundError("No hay grupo activo asignado");
  }

  const grupoActivoId = result.Item.parameter_value.grupo_id;
  logger.info('Grupo activo encontrado', { grupo_id: grupoActivoId });

  // Obtener detalles del grupo desde GROUPS_TABLE
  const grupoDetalles = await retryWithJitter(
    async () => {
      if (!dynamoBreaker.shouldAllow()) {
        throw new Error("CircuitBreakerOpen");
      }
      
      const res = await docClient.send(new GetCommand({
        TableName: process.env.GROUPS_TABLE,
        Key: {
          group_id: grupoActivoId
        }
      }));
      
      dynamoBreaker.reportSuccess();
      return res;
    },
    { maxAttempts: 3, baseDelayMs: 300 }
  );

  if (!grupoDetalles.Item) {
    throw new NotFoundError("Grupo activo no encontrado");
  }

  const grupo = grupoDetalles.Item;

  logger.info('Grupo activo obtenido', { grupo_id: grupoActivoId });

  return successResponse({
    ok: true,
    grupo_activo: {
      grupo_id: grupoActivoId,
      nombre: grupo.nombre,
      nomenclatura: grupo.nomenclatura || null,
      configured: grupo.configured || false,
      asignado_en: result.Item.parameter_value.asignado_en
    }
  });
}

module.exports.obtenerGrupoActivo = createAPIHandler(obtenerGrupoActivoHandler, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });

async function eliminarConfiguracionHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const grupo_id = event.queryStringParameters?.grupo_id;
  
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");
  if (!grupo_id) throw new ValidationError("grupo_id es requerido");

  logger.info('Eliminando configuración', { grupo_id, userSub });

    // Eliminar nomenclatura
    await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        
        await docClient.send(new DeleteCommand({
          TableName: process.env.PARAMETERS_TABLE,
          Key: {
            user_sub: userSub,
            parameter_key: `espacios.nomenclatura.${grupo_id}`
          }
        }));
        
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    // Eliminar resumen
    await retryWithJitter(
      async () => {
        await docClient.send(new DeleteCommand({
          TableName: process.env.PARAMETERS_TABLE,
          Key: {
            user_sub: userSub,
            parameter_key: `espacios.resumen.${grupo_id}`
          }
        }));
      },
      { maxAttempts: 2, baseDelayMs: 300 }
    );

    logger.info('Configuración eliminada', { grupo_id });

    return successResponse({
      ok: true,
      message: "Configuración eliminada correctamente",
      grupo_id
    });
}

module.exports.eliminarConfiguracion = createAPIHandler(eliminarConfiguracionHandler, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });

async function obtenerConfiguracionHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const grupo_id = event.queryStringParameters?.grupo_id;
  
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");

  logger.info('Obteniendo configuración', { grupo_id, userSub });

    // Buscar todas las configuraciones de nomenclatura del usuario
    const result = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        
        const res = await docClient.send(new QueryCommand({
          TableName: process.env.PARAMETERS_TABLE,
          KeyConditionExpression: "user_sub = :userSub AND begins_with(parameter_key, :prefix)",
          ExpressionAttributeValues: {
            ":userSub": userSub,
            ":prefix": "espacios.nomenclatura."
          }
        }));
        
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const configuraciones = (result.Items || []).map(item => ({
      grupo_id: item.parameter_value.grupo_id,
      nomenclatura: {
        general: item.parameter_value.general,
        especifico: item.parameter_value.especifico
      },
      created_at: item.parameter_value.created_at
    }));

    // Si se especificó un grupo_id, filtrar
    const configFiltrada = grupo_id 
      ? configuraciones.find(c => c.grupo_id === grupo_id)
      : configuraciones[0];

    if (grupo_id && !configFiltrada) {
      throw new NotFoundError("Configuración no encontrada para el grupo especificado");
    }

    logger.info('Configuración obtenida', { hasConfig: !!configFiltrada, totalConfigs: configuraciones.length });

    return successResponse({
      ok: true,
      configuracion: configFiltrada || null,
      todas_configuraciones: configuraciones
    });
}

module.exports.obtenerConfiguracion = createAPIHandler(obtenerConfiguracionHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });

async function listarEspaciosHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const grupo_id = event.queryStringParameters?.grupo_id;
  
  if (!grupo_id) throw new ValidationError("grupo_id es requerido");

  logger.info('Listando espacios', { grupo_id, userSub });

    // Obtener todos los espacios que pertenecen a este grupo
    const result = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        
        const res = await docClient.send(new QueryCommand({
          TableName: process.env.SPACES_TABLE,
          KeyConditionExpression: "PK = :pk",
          ExpressionAttributeValues: {
            ":pk": grupo_id
          }
        }));
        
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const espacios = result.Items || [];
    
    logger.info('Espacios encontrados', { count: espacios.length });
    
    // Organizar espacios en estructura jerárquica
    const espaciosGenerales = espacios.filter(e => e.tipo === 'general');
    const espaciosEspecificos = espacios.filter(e => e.tipo === 'especifico');
    
    // Mapear espacios específicos a sus padres
    const espaciosConHijos = espaciosGenerales.map(general => ({
      ...general,
      specificSpaces: espaciosEspecificos.filter(esp => esp.parent === general.SK)
    }));
    
    return successResponse({
      ok: true,
      grupo_id,
      espacios: espaciosConHijos,
      total: espaciosGenerales.length,
      total_especificos: espaciosEspecificos.length
    });
}

module.exports.listarEspacios = createAPIHandler(listarEspaciosHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });