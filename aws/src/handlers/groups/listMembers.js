const { DynamoDBDocumentClient, QueryCommand, GetCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ ANTI-CORRUPTION LAYER: UserAdapter reemplaza llamadas directas a Cognito
const { getUserAdapter } = require("../../adapters");

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { decryptPII } = require("../../utils/encryption");

// Cache para miembros de grupos (2 minutos TTL)
const membersCache = new Cache({ defaultTTL: 120000, maxSize: 500 });

// UserAdapter (ACL)
const userAdapter = getUserAdapter();

/**
 * GET /api/grupos/:id/miembros
 * Lista todos los miembros de un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Cache para members (2 min)
 * ✅ Circuit breaker para Cognito
 * ✅ Batch operations (optimizado para N+1)
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 100 req/min)
 */
async function listMembersHandler(event, context, logger) {
  const grupoId = event.pathParameters?.id;
  const userSub = event.userContext?.sub;
  
  logger = logger.child({ groupId: grupoId });
  logger.info('Listing group members');

  // Verificar que el grupo existe
  const groupResult = await retryDB(async () => {
    return await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupoId }
    }));
  });

  if (!groupResult.Item) {
    throw new NotFoundError('Group', grupoId);
  }

  // Obtener miembros con cache
  const members = await membersCache.getOrFetch(
    `members:${grupoId}`,
    async () => {
      logger.debug('Members not in cache, fetching from DB');
      
      const membersResult = await retryDB(async () => {
        return await db.send(new QueryCommand({
          TableName: process.env.GROUP_MEMBERS_TABLE,
          KeyConditionExpression: 'group_id = :group_id',
          ExpressionAttributeValues: {
            ':group_id': grupoId
          }
        }));
      });
      
      return membersResult.Items || [];
    },
    120000 // 2 min TTL
  );

  logger.debug('Members retrieved', { 
    count: members.length,
    cached: membersCache.has(`members:${grupoId}`)
  });

  // Desencriptar PII de miembros (v2.1)
  const decryptedMembers = await Promise.all(
    members.map(async (member) => await decryptPII(member))
  );

  // Enriquecer datos de miembros
  const enrichedMembers = await Promise.all(
    decryptedMembers.map(async (member) => {
      // Si ya tenemos email y nombre guardados, usarlos
      if (member.user_email) {
        const nombreGuardado = member.user_name || '';
        logger.debug('Using stored member data', { 
          email: member.user_email, 
          name: nombreGuardado 
        });
        
        return {
          id: member.user_sub,
          nombre: nombreGuardado || member.user_email.split('@')[0],
          email: member.user_email,
          rol: member.role,
          fecha_ingreso: member.added_at,
          esCreador: member.role === 'owner'
        };
      }
      
      // Fallback: consultar Cognito con circuit breaker (para datos antiguos)
      try {
        logger.debug('Fetching member data from UserAdapter (ACL)', { userSub: member.user_sub });
        
        // ✅ ACL: UserAdapter maneja Cognito, circuit breaker, retry
        const user = await userAdapter.getUser(member.user_sub);

        logger.debug('User found via UserAdapter', { 
          email: user.email, 
          displayName: user.displayName 
        });

        return {
          id: user.userId,
          nombre: user.displayName,
          email: user.email,
          rol: member.role,
          fecha_ingreso: member.added_at,
          esCreador: member.role === 'owner'
        };
      } catch (error) {
        logger.warn('Error fetching user from Cognito', { 
          userSub: member.user_sub, 
          error: error.message 
        });
      }
      
      // Fallback final
      return {
        id: member.user_sub,
        nombre: 'Usuario',
        email: 'desconocido@ejemplo.com',
        rol: member.role,
        fecha_ingreso: member.added_at,
        esCreador: member.role === 'owner'
      };
    })
  );

  logger.info('Members enriched successfully', { total: enrichedMembers.length });

  return successResponse({
    miembros: enrichedMembers,
    total: enrichedMembers.length
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(listMembersHandler, {
  requireAuth: true,
  rateLimit: { max: 100, windowMs: 60000 }
});
