// aws/src/handlers/ocupantes/listOcupantes.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { decryptPII } = require("../../utils/encryption");

// Cache para ocupantes de grupos (3 minutos TTL)
const ocupantesCache = new Cache({ defaultTTL: 180000, maxSize: 500 });

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

  // Obtener ocupantes con cache
  const ocupantes = await ocupantesCache.getOrFetch(
    `ocupantes:${grupo_id}`,
    async () => {
      logger.debug('Ocupantes not in cache, fetching from DB');
      
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
      const decryptedItems = await Promise.all(
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
      
      return decryptedItems;
    },
    180000 // 3 min TTL
  );

  logger.info('Ocupantes retrieved', { 
    count: ocupantes.length,
    cached: ocupantesCache.has(`ocupantes:${grupo_id}`)
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
