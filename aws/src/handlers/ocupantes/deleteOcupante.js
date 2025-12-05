// aws/src/handlers/ocupantes/deleteOcupante.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");

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

  return successResponse({
    message: "Ocupante eliminado exitosamente"
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(deleteOcupanteHandler, {
  requireAuth: true,
  rateLimit: { max: 20, windowMs: 60000 }
});
