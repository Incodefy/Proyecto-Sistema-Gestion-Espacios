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
 * GET /api/espacios/grupos-usuario
 * Obtiene todos los grupos a los que pertenece el usuario
 */
module.exports.listarGruposUsuario = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [ListarGruposUsuario] Inicio | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    
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

    const grupos = (result.Items || []).map(item => ({
      grupo_id: item.parameter_value.grupo_id,
      nombre: `${item.parameter_value.general} / ${item.parameter_value.especifico}`,
      nomenclatura: {
        general: item.parameter_value.general,
        especifico: item.parameter_value.especifico
      },
      created_at: item.parameter_value.created_at,
      created_by: item.parameter_value.created_by
    }));

    // Ordenar por fecha de creación (más reciente primero)
    grupos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`[${TRACE_ID}] ✅ Grupos encontrados: ${grupos.length}`);

    return response(200, {
      ok: true,
      grupos,
      total: grupos.length,
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error listando grupos`, err);
    
    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
  }
};

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

    // Verificar que el grupo existe y pertenece al usuario
    const verificacion = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        
        const res = await docClient.send(new GetCommand({
          TableName: process.env.PARAMETERS_TABLE,
          Key: {
            user_sub: userSub,
            parameter_key: `espacios.nomenclatura.${grupo_id}`
          }
        }));
        
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    if (!verificacion.Item) {
      return response(404, {
        ok: false,
        error: "Grupo no encontrado o no pertenece al usuario",
        trace_id: TRACE_ID
      });
    }

    const timestamp = new Date().toISOString();

    // Guardar el grupo activo
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
  
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    
    if (!userSub) {
      return response(401, { 
        ok: false, 
        error: "Usuario no autenticado",
        trace_id: TRACE_ID 
      });
    }

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
      return response(404, {
        ok: false,
        error: "No hay grupo activo asignado",
        trace_id: TRACE_ID
      });
    }

    const grupoActivoId = result.Item.parameter_value.grupo_id;

    // Obtener detalles del grupo
    const grupoDetalles = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        
        const res = await docClient.send(new GetCommand({
          TableName: process.env.PARAMETERS_TABLE,
          Key: {
            user_sub: userSub,
            parameter_key: `espacios.nomenclatura.${grupoActivoId}`
          }
        }));
        
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    return response(200, {
      ok: true,
      grupo_activo: {
        grupo_id: grupoActivoId,
        nomenclatura: grupoDetalles.Item?.parameter_value || null,
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
 * POST /api/espacios/configuracion
 * Guarda la configuración de nomenclatura y crea los espacios en catálogo
 */
module.exports.guardarConfiguracion = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [GuardarConfiguracion] Inicio | ${TRACE_ID} ===`);

  try {
    // 1) VALIDAR AUTENTICACIÓN
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userSub) {
      return response(401, { 
        ok: false, 
        error: "Usuario no autenticado",
        trace_id: TRACE_ID 
      });
    }

    console.log(`[${TRACE_ID}] 👤 Usuario: ${userEmail}`);

    // 2) PARSEAR BODY
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (jsonErr) {
      console.error(`[${TRACE_ID}] ❌ Error parseando JSON`, jsonErr);
      return response(400, { 
        ok: false, 
        error: "JSON inválido en el body",
        trace_id: TRACE_ID 
      });
    }

    const { nomenclatura, espacios, grupo_id } = body;

    // 3) VALIDACIONES
    if (!nomenclatura || !nomenclatura.general || !nomenclatura.especifico) {
      return response(400, { 
        ok: false, 
        error: "Debe proporcionar nomenclatura completa (general y especifico)",
        trace_id: TRACE_ID 
      });
    }

    if (!espacios || espacios.length === 0) {
      return response(400, { 
        ok: false, 
        error: "Debe crear al menos un espacio",
        trace_id: TRACE_ID 
      });
    }

    // Validar estructura de espacios
    const isValid = espacios.every(space => 
      space.name && 
      space.name.trim() !== '' && 
      space.specificSpaces && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name && spec.name.trim() !== '')
    );

    if (!isValid) {
      return response(400, { 
        ok: false, 
        error: "Todos los espacios deben tener nombre y al menos un espacio específico",
        trace_id: TRACE_ID 
      });
    }

    // 4) IDEMPOTENCIA
    const timestamp = new Date().toISOString();
    const configHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify({ nomenclatura, espacios }))
      .digest('hex')
      .substring(0, 16);
    
    const idempotencyKey = `espacios-config-${userSub}-${configHash}`;
    
    if (await wasAlreadyProcessed(idempotencyKey)) {
      console.log(`[${TRACE_ID}] ⏭️ Configuración ya procesada`);
      return response(200, {
        ok: true,
        message: "Configuración ya estaba guardada",
        already_processed: true,
        trace_id: TRACE_ID
      });
    }

    // 5) GENERAR O USAR GRUPO_ID
    const finalGrupoId = grupo_id || `GRUPO#${Date.now()}`;
    console.log(`[${TRACE_ID}] 📦 Grupo ID: ${finalGrupoId}`);

    // 6) GUARDAR NOMENCLATURA EN TABLA DE PARÁMETROS
    console.log(`[${TRACE_ID}] 💾 Guardando nomenclatura...`);
    
    if (!dynamoBreaker.shouldAllow()) {
      throw new Error("CircuitBreakerOpen");
    }

    await retryWithJitter(
      async () => {
        await docClient.send(new PutCommand({
          TableName: process.env.PARAMETERS_TABLE,
          Item: {
            user_sub: userSub,
            parameter_key: `espacios.nomenclatura.${finalGrupoId}`,
            parameter_value: {
              general: nomenclatura.general,
              especifico: nomenclatura.especifico,
              grupo_id: finalGrupoId,
              created_at: timestamp,
              created_by: userEmail
            },
            updated_at: timestamp,
            email: userEmail
          }
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    // 7) PREPARAR ITEMS PARA CATÁLOGO
    const catalogoItems = [];
    let espacioCounter = 0;
    let boxCounter = 0;

    for (const espacio of espacios) {
      espacioCounter++;
      const espacioId = `ESPACIO_GENERAL#${espacioCounter}`;
      
      // Item para espacio general
      catalogoItems.push({
        PK: `${nomenclatura.general.toUpperCase()}#${espacioId}`,
        SK: `METADATA`,
        GSI1PK: `TIPO#${nomenclatura.general.toUpperCase()}`,
        GSI1SK: espacio.name,
        tipo: nomenclatura.general.toLowerCase(),
        nombre: espacio.name,
        grupo_id: finalGrupoId,
        espacio_id: espacioId,
        created_at: timestamp,
        created_by: userEmail
      });

      // Items para espacios específicos
      for (const spec of espacio.specificSpaces) {
        boxCounter++;
        const boxId = `ESPACIO_ESPECIFICO#${boxCounter}`;
        
        catalogoItems.push({
          PK: `${nomenclatura.especifico.toUpperCase()}#${boxId}`,
          SK: `METADATA`,
          GSI1PK: `TIPO#${nomenclatura.especifico.toUpperCase()}`,
          GSI1SK: spec.name,
          tipo: nomenclatura.especifico.toLowerCase(),
          nombre: spec.name,
          pertenece_a: espacioId,
          pertenece_a_nombre: espacio.name,
          grupo_id: finalGrupoId,
          box_id: boxId,
          created_at: timestamp,
          created_by: userEmail
        });
      }
    }

    console.log(`[${TRACE_ID}] 📝 Items a crear: ${catalogoItems.length}`);

    // 8) BATCH WRITE A CATÁLOGO (máximo 25 items por batch)
    const batchSize = 25;
    for (let i = 0; i < catalogoItems.length; i += batchSize) {
      const batch = catalogoItems.slice(i, i + batchSize);
      
      if (!dynamoBreaker.shouldAllow()) {
        throw new Error("CircuitBreakerOpen");
      }

      await retryWithJitter(
        async () => {
          await docClient.send(new BatchWriteCommand({
            RequestItems: {
              [process.env.DB_CATALOGO]: batch.map(item => ({
                PutRequest: { Item: item }
              }))
            }
          }));
          dynamoBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 400 }
      );
      
      console.log(`[${TRACE_ID}] ✅ Batch ${Math.floor(i/batchSize) + 1} guardado`);
    }

    // 9) GUARDAR RESUMEN EN PARÁMETROS
    await retryWithJitter(
      async () => {
        await docClient.send(new PutCommand({
          TableName: process.env.PARAMETERS_TABLE,
          Item: {
            user_sub: userSub,
            parameter_key: `espacios.resumen.${finalGrupoId}`,
            parameter_value: {
              total_espacios_generales: espacioCounter,
              total_espacios_especificos: boxCounter,
              grupo_id: finalGrupoId,
              created_at: timestamp
            },
            updated_at: timestamp,
            email: userEmail
          }
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    // 10) MARCAR COMO PROCESADO
    await markAsProcessed(idempotencyKey);

    console.log(`[${TRACE_ID}] ✅ Configuración guardada exitosamente`);

    return response(200, {
      ok: true,
      message: "Configuración guardada correctamente",
      data: {
        grupo_id: finalGrupoId,
        nomenclatura,
        espacios_creados: {
          generales: espacioCounter,
          especificos: boxCounter
        }
      },
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error guardando configuración`, err);
    
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