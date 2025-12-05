const {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand
} = require("@aws-sdk/lib-dynamodb");

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryAWS } = require("../../utils/retry");
const { quickBatchGet } = require("../../utils/batchHelper");
const { Cache } = require("../../utils/cache");

const db = DynamoDBDocumentClient.from(
  new (require("@aws-sdk/client-dynamodb").DynamoDBClient)()
);

// Cache para grupos de usuarios (2 minutos TTL)
const userGroupsCache = new Cache({ defaultTTL: 120000, maxSize: 500 });

/**
 * GET /groups/user
 * Lista todos los grupos del usuario autenticado
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Cache para reducir queries
 * ✅ Batch operations para obtener detalles
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 100 req/min)
 */
async function listUserGroupsHandler(event, context, logger) {
  const userSub = event.userContext?.sub;
  const userEmail = event.userContext?.email;

  logger = logger.child({ userSub });
  logger.info('Listing user groups');

  // 1️⃣ BUSCAR MEMBRESÍAS CON CACHE
  const memberships = await userGroupsCache.getOrFetch(
    `user-groups:${userSub}`,
    async () => {
      logger.debug('User groups not in cache, fetching from DB');
      
      const memberQuery = await retryAWS(async () => {
        return await db.send(new QueryCommand({
          TableName: process.env.GROUP_MEMBERS_TABLE,
          IndexName: "UserGroupsIndex",
          KeyConditionExpression: "user_sub = :u",
          ExpressionAttributeValues: { ":u": userSub }
        }));
      });
      
      return memberQuery.Items || [];
    },
    120000 // 2 min TTL
  );

  logger.debug('Memberships retrieved', { 
    count: memberships.length,
    cached: userGroupsCache.has(`user-groups:${userSub}`)
  });

  if (memberships.length === 0) {
    logger.info('User has no groups');
    return successResponse({ grupos: [], total: 0 });
  }

  // 2️⃣ OBTENER DETALLES CON BATCH OPERATIONS
  const groupIds = memberships.map(m => ({ group_id: m.group_id }));
  
  const groupDetails = await logger.traceAsync('batchGetGroupDetails', async () => {
    return await quickBatchGet(process.env.GROUPS_TABLE, groupIds);
  }, { count: groupIds.length });

  // 3️⃣ COMBINAR DATOS
  const grupos = memberships
    .map(membership => {
      const group = groupDetails.find(g => g.group_id === membership.group_id);
      
      if (!group) {
        logger.warn('Group not found in details', { groupId: membership.group_id });
        return null;
      }
      
      return {
        grupo_id: group.group_id,
        nombre: group.nombre,
        role: membership.role,
        created_at: group.created_at,
        owner_sub: group.owner_sub
      };
    })
    .filter(g => g !== null)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  logger.info('Groups retrieved successfully', { total: grupos.length });

  return successResponse({ grupos, total: grupos.length });
}

// Exportar con interceptors (rate limit: 100 req/min)
exports.handler = createAPIHandler(listUserGroupsHandler, {
  rateLimit: {
    limit: 100,
    window: 60,
    endpoint: 'listUserGroups'
  }
});
