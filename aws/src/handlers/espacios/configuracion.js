// src/handlers/espacios/configuracion.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, BatchWriteCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");
const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const Logger = require("../../utils/logger");
const { createAPIHandler } = require("../../utils/interceptors");
const { successResponse, errorResponse } = require("../../utils/response");
const { AuthorizationError, ValidationError, NotFoundError } = require("../../utils/errors");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

// Helper response function (mantener compatibilidad)
function response(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  };
}

async function asignarGrupoActivoHandler(event, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
  
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");

  const body = JSON.parse(event.body || "{}");
  const { grupo_id } = body;

    if (!grupo_id) {
      return response(400, {
        ok: false,
        error: "grupo_id es requerido",
        trace_id: TRACE_ID
      }, getSecurityHeaders());
    }

    console.log(`[${TRACE_ID}] Verificando grupo: ${grupo_id}`);

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
      console.log(`[${TRACE_ID}] Grupo no encontrado en GROUPS_TABLE`);
      return response(404, {
        ok: false,
        error: "Grupo no encontrado",
        trace_id: TRACE_ID
      }, getSecurityHeaders());
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
      console.log(`[${TRACE_ID}] Error verificando membresía:`, err.message);
    }

    if (!isOwner && !isMember) {
      console.log(`[${TRACE_ID}] Usuario no tiene acceso al grupo`);
      return response(403, {
        ok: false,
        error: "No tienes acceso a este grupo",
        trace_id: TRACE_ID
      }, getSecurityHeaders());
    }

    const timestamp = new Date().toISOString();

    console.log(`[${TRACE_ID}] Guardando grupo activo: ${grupo_id}`);

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
        nomenclatura: verificacion.Item.parameter_value
      }
    });
}

module.exports.asignarGrupoActivo = createAPIHandler(asignarGrupoActivoHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });

async function obtenerGrupoActivoHandler(event, logger) {
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
      console.log(`[${TRACE_ID}] No hay grupo activo asignado`);
      return response(404, {
        ok: false,
        error: "No hay grupo activo asignado",
        trace_id: TRACE_ID
      }, getSecurityHeaders());
    }

    const grupoActivoId = result.Item.parameter_value.grupo_id;
    console.log(`[${TRACE_ID}] Grupo activo encontrado: ${grupoActivoId}`);

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
      console.log(`[${TRACE_ID}] Grupo no encontrado en GROUPS_TABLE`);
      return response(404, {
        ok: false,
        error: "Grupo activo no encontrado",
        trace_id: TRACE_ID
      }, getSecurityHeaders());
    }

    const grupo = grupoDetalles.Item;

    console.log(`[${TRACE_ID}] ✅ Grupo activo obtenido exitosamente`);

    return response(200, {
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

async function eliminarConfiguracionHandler(event, logger) {
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

async function obtenerConfiguracionHandler(event, logger) {
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

async function listarEspaciosHandler(event, logger) {
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
    
    console.log(`[${TRACE_ID}] ✅ Espacios encontrados: ${espacios.length}`);
    
    // Organizar espacios en estructura jerárquica
    const espaciosGenerales = espacios.filter(e => e.tipo === 'general');
    const espaciosEspecificos = espacios.filter(e => e.tipo === 'especifico');
    
    // Mapear espacios específicos a sus padres
    const espaciosConHijos = espaciosGenerales.map(general => ({
      ...general,
      specificSpaces: espaciosEspecificos.filter(esp => esp.parent === general.SK)
    }));
    
    return response(200, {
      ok: true,
      grupo_id,
      espacios: espaciosConHijos,
      total: espaciosGenerales.length,
      total_especificos: espaciosEspecificos.length
    });
}

module.exports.listarEspacios = createAPIHandler(listarEspaciosHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });

/**
 * Respuesta HTTP estandarizada
 */
function response(statusCode, body, securityHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      ...securityHeaders
    },
    body: JSON.stringify(body)
  };
}