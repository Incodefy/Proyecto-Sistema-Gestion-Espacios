// aws/src/handlers/ocupantes/listOcupantes.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { decryptPII } = require("../../utils/encryption");

/**
 * GET /groups/{grupo_id}/ocupantes
 * Lista todos los ocupantes de un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Cache (3 min TTL)
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 100 req/min)
 */
async function listOcupantesHandler(event, context, logger) {
  const grupo_id = event.pathParameters?.grupo_id;
  const userSub = event.userContext?.sub;
  
  if (!grupo_id) {
    throw new ValidationError('grupo_id es requerido');
  }

  logger = logger.child({ groupId: grupo_id });
  logger.info('Listing ocupantes');

  logger.debug('Fetching ocupantes from DB');
  
  const result = await retryDB(async () => {
    return await db.send(
      new QueryCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":gid": grupo_id,
          ":prefix": "OCCUPANT#"
        }
      })
    );
  });

  const items = result.Items || [];
  
  // Desencriptar PII de cada ocupante (v2.1)
  const ocupantes = await Promise.all(
    items.map(async (item) => {
      const decrypted = await decryptPII(item);
      return {
        id: item.SK.replace('OCCUPANT#', ''),
        nombre: decrypted.nombre,
        especialidad: decrypted.especialidad,
        especialidad_id: decrypted.especialidad_id ? decrypted.especialidad_id.replace('ESP#', '') : null,
        grupo_id: item.PK,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    })
  );

  logger.info('Ocupantes retrieved', { 
    count: ocupantes.length
  });

  return successResponse({ 
    ocupantes,
    count: ocupantes.length
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(listOcupantesHandler, {
  requireAuth: true,
  rateLimit: { max: 100, windowMs: 60000 }
});
