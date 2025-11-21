// src/handlers/espacios/configuracion.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, BatchWriteCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");
const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

/**
 * PUT /api/espacios/asignar-grupo
 * Asigna un grupo como activo para el usuario
 */
module.exports.asignarGrupoActivo = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [AsignarGrupoActivo] Inicio | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userSub) {
      return response(401, { 
        ok: false, 
        error: "Usuario no autenticado",
        trace_id: TRACE_ID 
      });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (jsonErr) {
      return response(400, { 
        ok: false, 
        error: "JSON inválido en el body",
        trace_id: TRACE_ID 
      });
    }

    const { grupo_id } = body;

    if (!grupo_id) {
      return response(400, {
        ok: false,
        error: "grupo_id es requerido",
        trace_id: TRACE_ID
      });
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
      });
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
      });
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

    console.log(`[${TRACE_ID}] ✅ Grupo ${grupo_id} asignado como activo`);

    return response(200, {
      ok: true,
      message: "Grupo asignado correctamente",
      grupo_activo: {
        grupo_id: grupo_id,
        nomenclatura: verificacion.Item.parameter_value
      },
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error asignando grupo activo`, err);
    
    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
  }
};

/**
 * GET /api/espacios/grupo-activo
 * Obtiene el grupo activo del usuario
 */
module.exports.obtenerGrupoActivo = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [ObtenerGrupoActivo] Inicio | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    
    if (!userSub) {
      return response(401, { 
        ok: false, 
        error: "Usuario no autenticado",
        trace_id: TRACE_ID 
      });
    }

    console.log(`[${TRACE_ID}] Obteniendo grupo activo para user: ${userSub}`);

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
      });
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
      });
    }

    const grupo = grupoDetalles.Item;

    console.log(`[${TRACE_ID}] ✅ Grupo activo obtenido exitosamente`);

    return response(200, {
      ok: true,
      grupo_activo: {
        grupo_id: grupoActivoId,
        nombre: grupo.nombre,
        nomenclatura: grupo.nomenclatura || null,
        configured: grupo.configured || false,
        asignado_en: result.Item.parameter_value.asignado_en
      },
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error obteniendo grupo activo`, err);
    
    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
  }
};

/**
 * DELETE /api/espacios/configuracion
 * Elimina una configuración completa de espacios
 */
module.exports.eliminarConfiguracion = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [EliminarConfiguracion] Inicio | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const grupo_id = event.queryStringParameters?.grupo_id;
    
    if (!userSub) {
      return response(401, { 
        ok: false, 
        error: "Usuario no autenticado",
        trace_id: TRACE_ID 
      });
    }

    if (!grupo_id) {
      return response(400, {
        ok: false,
        error: "grupo_id es requerido",
        trace_id: TRACE_ID
      });
    }

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

    console.log(`[${TRACE_ID}] ✅ Configuración eliminada`);

    return response(200, {
      ok: true,
      message: "Configuración eliminada correctamente",
      grupo_id,
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error eliminando configuración`, err);
    
    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
  }
};

/**
 * GET /api/espacios/configuracion
 * Obtiene la configuración de nomenclatura del usuario
 */
module.exports.obtenerConfiguracion = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const grupo_id = event.queryStringParameters?.grupo_id;
    
    if (!userSub) {
      return response(401, { 
        ok: false, 
        error: "Usuario no autenticado",
        trace_id: TRACE_ID 
      });
    }

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
      : configuraciones[0]; // La más reciente

    if (grupo_id && !configFiltrada) {
      return response(404, {
        ok: false,
        error: "Configuración no encontrada para el grupo especificado",
        trace_id: TRACE_ID
      });
    }

    return response(200, {
      ok: true,
      configuracion: configFiltrada || null,
      todas_configuraciones: configuraciones,
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error obteniendo configuración`, err);
    
    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
  }
};

/**
 * GET /api/espacios/lista
 * Obtiene todos los espacios de un grupo
 */
module.exports.listarEspacios = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  try {
    const grupo_id = event.queryStringParameters?.grupo_id;
    
    if (!grupo_id) {
      return response(400, {
        ok: false,
        error: "grupo_id es requerido",
        trace_id: TRACE_ID
      });
    }

    // Obtener todos los items del catálogo que pertenecen a este grupo
    const result = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        
        const res = await docClient.send(new QueryCommand({
          TableName: process.env.DB_CATALOGO,
          IndexName: "TipoEntidadIndex",
          KeyConditionExpression: "GSI1PK = :tipo",
          FilterExpression: "grupo_id = :grupoId",
          ExpressionAttributeValues: {
            ":tipo": "TIPO#ESPACIO",
            ":grupoId": grupo_id
          }
        }));
        
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const espacios = result.Items || [];
    
    return response(200, {
      ok: true,
      grupo_id,
      espacios,
      total: espacios.length,
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error listando espacios`, err);
    
    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
  }
};

/**
 * Respuesta HTTP estandarizada
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}