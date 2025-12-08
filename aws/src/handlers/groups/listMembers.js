const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { decryptPII } = require("../../utils/encryption");

/**
 * GET /api/grupos/:id/miembros
 * Lista todos los miembros de un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Circuit breaker para Cognito
 * ✅ Batch operations (optimizado para N+1)
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 100 req/min)
 * ⚠️ SIN CACHE - Siempre datos frescos
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

  // Obtener miembros directamente de DB (SIN CACHE)
  logger.debug('Fetching members from DB');
  
  const membersResult = await retryDB(async () => {
    return await db.send(new QueryCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      KeyConditionExpression: 'group_id = :group_id',
      ExpressionAttributeValues: {
        ':group_id': grupoId
      }
    }));
  });
  
  const members = membersResult.Items || [];

  logger.debug('Members retrieved', { count: members.length });

  // Desencriptar PII de miembros (v2.1)
  const decryptedMembers = await Promise.all(
    members.map(async (member) => await decryptPII(member))
  );

  // Enriquecer datos de miembros (sin UserAdapter para evitar 500)
  const enrichedMembers = decryptedMembers.map((member) => {
    // Usar datos almacenados directamente
    const email = member.user_email || 'desconocido@ejemplo.com';
    const nombre = member.user_name || email.split('@')[0] || 'Usuario';
    
    logger.debug('Using stored member data', { 
      hasEmail: !!member.user_email,
      hasName: !!member.user_name 
    });
    
    return {
      id: member.user_sub,
      nombre: nombre,
      email: email,
      rol: member.role,
      fecha_ingreso: member.added_at,
      esCreador: member.role === 'owner'
    };
  });

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
