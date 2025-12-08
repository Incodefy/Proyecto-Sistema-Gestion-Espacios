// aws/src/handlers/ocupantes/updateOcupante.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { ValidationError, NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { encryptPII, decryptPII } = require("../../utils/encryption");
const { notifyOcupanteModificado } = require("../../utils/notificationHelper");

/**
 * PUT /groups/{grupo_id}/ocupantes/{id}
 * Actualiza un ocupante existente
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ JSON Schema validation
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 50 req/min)
 */
async function updateOcupanteHandler(event, context, logger) {
  const grupo_id = event.pathParameters?.grupo_id;
  const ocupanteId = event.pathParameters?.id;
  const userEmail = event.userContext?.email;
  const userSub = event.userContext?.sub;
  
  if (!grupo_id || !ocupanteId) {
    throw new ValidationError('grupo_id y ocupante id son requeridos');
  }

  // Validación con JSON Schema
  const result = validate('updateOcupante', event.parsedBody, logger);
  if (!result.valid) {
    throw new ValidationError('Invalid ocupante data', { errors: result.errors });
  }
  
  const { nombre, especialidad_id, tipo } = result.data;

  logger = logger.child({ groupId: grupo_id, ocupanteId });
  logger.info('Updating ocupante');

  // Verificar que el ocupante existe
  const getResult = await retryDB(async () => {
    return await db.send(
      new GetCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        }
      })
    );
  });

  if (!getResult.Item) {
    throw new NotFoundError('Ocupante', ocupanteId);
  }

  // Detectar cambios para notificación
  const oldItem = await decryptPII(getResult.Item);
  const cambios = {};
  
  if (oldItem.nombre !== nombre.trim()) {
    cambios.nombre = { old: oldItem.nombre, new: nombre.trim() };
  }
  
  if (especialidad_id && oldItem.especialidad_id !== especialidadIdConPrefijo) {
    cambios.especialidad = { 
      old: oldItem.especialidad || 'Sin especialidad', 
      new: especialidadNombre || especialidadIdConPrefijo 
    };
  }

  const now = new Date().toISOString();
  
  // Preparar datos para encriptar (v2.1)
  const dataToEncrypt = {
    nombre: nombre.trim()
  };
  
  const encryptedData = await encryptPII(dataToEncrypt);
  
  let updateExpression = "SET nombre = :nombre, updated_at = :updated";
  let expressionValues = {
    ":nombre": encryptedData.nombre,
    ":updated": now
  };

  if (tipo) {
    updateExpression += ", tipo = :tipo";
    expressionValues[":tipo"] = tipo;
  }

  if (especialidad_id) {
    let especialidadNombre = null;
    const especialidadIdConPrefijo = especialidad_id.startsWith('ESP#') 
      ? especialidad_id 
      : `ESP#${especialidad_id}`;
    
    try {
      const especialidadResult = await retryDB(async () => {
        return await db.send(
          new GetCommand({
            TableName: process.env.ESPECIALIDADES_TABLE,
            Key: {
              PK: grupo_id,
              SK: especialidadIdConPrefijo
            }
          })
        );
      });
      
      if (especialidadResult.Item) {
        especialidadNombre = especialidadResult.Item.nombre;
        logger.debug('Especialidad found', { nombre: especialidadNombre });
      }
    } catch (err) {
      logger.warn('Could not fetch especialidad name', err);
    }

    updateExpression += ", especialidad_id = :especialidad";
    expressionValues[":especialidad"] = especialidadIdConPrefijo;

    if (especialidadNombre) {
      updateExpression += ", especialidad = :especialidadNombre";
      expressionValues[":especialidadNombre"] = especialidadNombre;
    }
  }

  await retryDB(async () => {
    await db.send(
      new UpdateCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues
      })
    );
  });

  logger.info('Ocupante updated with encrypted PII', { ocupanteId });

  // Desencriptar para response (v2.1)
  const decryptedResponse = await decryptPII({
    nombre: encryptedData.nombre
  });

  // Enviar notificación solo si hubo cambios
  if (Object.keys(cambios).length > 0) {
    try {
      const membersResult = await retryDB(() => db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupo_id }
      })));

      const userSubs = (membersResult.Items || []).map(m => m.user_sub);

      if (userSubs.length > 0) {
        await notifyOcupanteModificado({
          userSubs,
          grupoId: grupo_id,
          createdBy: userSub,
          ocupanteNombre: decryptedResponse.nombre,
          especialidadNombre: especialidadNombre || oldItem.especialidad || 'Sin especialidad',
          cambios,
          tipoOcupante: tipo || oldItem.tipo || 'Ocupante'
        });
        logger.info('Notification sent for ocupante update', { cambios });
      }
    } catch (notifError) {
      logger.warn('Failed to send notification for ocupante update', notifError);
    }
  }

  return successResponse({
    ocupante: {
      id: ocupanteId,
      nombre: decryptedResponse.nombre,
      especialidad_id: especialidad_id || getResult.Item.especialidad_id,
      grupo_id,
      updated_at: now
    }
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(updateOcupanteHandler, {
  requireAuth: true,
  rateLimit: { max: 50, windowMs: 60000 }
});
