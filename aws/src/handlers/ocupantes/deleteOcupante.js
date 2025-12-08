// aws/src/handlers/ocupantes/deleteOcupante.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { decryptPII } = require("../../utils/encryption");
const { notifyOcupanteEliminado } = require("../../utils/notificationHelper");

/**
 * DELETE /groups/{grupo_id}/ocupantes/{id}
 * Elimina un ocupante de un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 20 req/min)
 */
async function deleteOcupanteHandler(event, context, logger) {
  const grupo_id = event.pathParameters?.grupo_id;
  const ocupanteId = event.pathParameters?.id;
  const userSub = event.userContext?.sub;
  
  if (!grupo_id || !ocupanteId) {
    throw new ValidationError('grupo_id y ocupante id son requeridos');
  }

  logger = logger.child({ groupId: grupo_id, ocupanteId });
  logger.info('Deleting ocupante');

  // Verificar que el ocupante existe antes de eliminar
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

  // Guardar datos para notificación antes de eliminar
  const ocupanteData = await decryptPII(getResult.Item);
  const ocupanteNombre = ocupanteData.nombre;
  const especialidadNombre = ocupanteData.especialidad || 'Sin especialidad';
  const tipoOcupante = ocupanteData.tipo || 'Ocupante';

  await retryDB(async () => {
    await db.send(
      new DeleteCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        }
      })
    );
  });

  logger.info('Ocupante deleted', { ocupanteId });

  // Enviar notificación
  try {
    const membersResult = await retryDB(() => db.send(new QueryCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      KeyConditionExpression: 'group_id = :gid',
      ExpressionAttributeValues: { ':gid': grupo_id }
    })));

    const userSubs = (membersResult.Items || []).map(m => m.user_sub);

    if (userSubs.length > 0) {
      await notifyOcupanteEliminado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        ocupanteNombre,
        especialidadNombre,
        tipoOcupante
      });
      logger.info('Notification sent for ocupante deletion');
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for ocupante deletion', notifError);
  }

  return successResponse({
    message: "Ocupante eliminado exitosamente"
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(deleteOcupanteHandler, {
  requireAuth: true,
  rateLimit: { max: 20, windowMs: 60000 }
});
