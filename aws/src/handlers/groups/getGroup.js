const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { NotFoundError, AuthorizationError, ValidationError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { decryptPII } = require("../../utils/encryption");

const db = DynamoDBDocumentClient.from(
  new (require("@aws-sdk/client-dynamodb").DynamoDBClient)()
);

/**
 * GET /groups/{group_id}
 * Obtiene información de un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Error handling centralizado
 * ✅ Cache para reducir queries
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 100 req/min)
 */
async function getGroupHandler(event, context, logger) {
  const groupId = event.pathParameters?.group_id;
  const userSub = event.userContext?.sub;

  logger = logger.child({ groupId, userSub });
  logger.info('Fetching group details');

  // Validación básica
  if (!groupId) {
    throw new ValidationError('group_id is required');
  }

  // 1️⃣ BUSCAR GRUPO DIRECTO DE DB (sin cache)
  logger.debug('Fetching group from DB');
  
  const res = await retryDB(async () => {
    return await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: groupId }
    }));
  });
  
  if (!res.Item) {
    throw new NotFoundError('Group', groupId);
  }
  
  const group = res.Item;

  logger.debug('Group retrieved fresh from DB', { 
    groupName: group.nombre 
  });

  // 2️⃣ VERIFICAR PERMISOS
  const isOwner = group.owner_sub === userSub;
  
  // Verificar membership con retry
  let isMember = false;
  try {
    const memberCheck = await retryDB(async () => {
      return await db.send(new GetCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Key: { group_id: groupId, user_sub: userSub }
      }));
    });
    isMember = !!memberCheck.Item;
  } catch (memberErr) {
    logger.warn('Could not verify membership', memberErr);
  }

  if (!isOwner && !isMember) {
    logger.warn('Access denied - user is not member or owner');
    throw new AuthorizationError('No tienes acceso a este grupo');
  }

  logger.info('Group access granted', { 
    isOwner, 
    isMember,
    role: isOwner ? 'owner' : 'member'
  });

  // 3️⃣ DESENCRIPTAR PII (v2.1)
  const decryptedGroup = await decryptPII(group);

  // 4️⃣ RESPONSE
  return successResponse({ group: decryptedGroup });
}

// Exportar con interceptors (rate limit: 100 req/min para lectura)
exports.handler = createAPIHandler(getGroupHandler, {
  rateLimit: {
    limit: 100,
    window: 60,
    endpoint: 'getGroup'
  }
});
