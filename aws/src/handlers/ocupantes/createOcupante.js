// aws/src/handlers/ocupantes/createOcupante.js
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { ValidationError, NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { encryptPII, decryptPII } = require("../../utils/encryption");
const { notifyOcupanteCreado } = require("../../utils/notificationHelper");

/**
 * POST /groups/{grupo_id}/ocupantes
 * Crea un nuevo ocupante en un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ JSON Schema validation
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 30 req/min)
 */
async function createOcupanteHandler(event, context, logger) {
  const grupo_id = event.pathParameters?.grupo_id;
  const userSub = event.userContext?.sub;
  const userEmail = event.userContext?.email;
  
  if (!grupo_id) {
    throw new ValidationError('grupo_id es requerido');
  }

  // Validación con JSON Schema
  const result = validate('createOcupante', event.parsedBody, logger);
  if (!result.valid) {
    throw new ValidationError('Invalid ocupante data', { errors: result.errors });
  }
  
  const { nombre, especialidad_id, tipo } = result.data;

  logger = logger.child({ groupId: grupo_id, especialidadId: especialidad_id });
  logger.info('Creating ocupante');

  // Buscar la especialidad para obtener su nombre
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

  const ocupanteId = crypto.randomUUID().substring(0, 8);
  const now = new Date().toISOString();

  const item = {
    PK: grupo_id,
    SK: `OCCUPANT#${ocupanteId}`,
    occupant_id: `OCCUPANT#${ocupanteId}`,
    nombre: nombre.trim(),
    especialidad_id: especialidadIdConPrefijo,
    tipo: tipo || 'Ocupante',
    created_at: now,
    updated_at: now,
    created_by: userEmail || userSub
  };

  if (especialidadNombre) {
    item.especialidad = especialidadNombre;
  }

  // Encriptar PII antes de guardar (v2.1)
  const encryptedItem = await encryptPII(item);

  await retryDB(async () => {
    await db.send(
      new PutCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Item: encryptedItem
      })
    );
  });

  logger.info('Ocupante created with encrypted PII', { ocupanteId });

  // Desencriptar para retornar al frontend (v2.1)
  const decryptedItem = await decryptPII(encryptedItem);

  // Obtener miembros del grupo para notificar
  try {
    const membersResult = await retryDB(() => db.send(new QueryCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      KeyConditionExpression: 'group_id = :gid',
      ExpressionAttributeValues: { ':gid': grupo_id }
    })));

    const userSubs = (membersResult.Items || []).map(m => m.user_sub);

    if (userSubs.length > 0) {
      await notifyOcupanteCreado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        ocupanteNombre: decryptedItem.nombre,
        especialidadNombre: especialidadNombre || 'Sin especialidad',
        tipoOcupante: tipo || 'Ocupante'
      });
      logger.info('Notification sent for ocupante creation', { userSubs: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for ocupante creation', notifError);
  }

  return successResponse({
    ocupante: {
      id: ocupanteId,
      nombre: decryptedItem.nombre,
      especialidad_id,
      grupo_id,
      created_at: now
    }
  }, 201);
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(createOcupanteHandler, {
  requireAuth: true,
  rateLimit: { max: 30, windowMs: 60000 }
});
