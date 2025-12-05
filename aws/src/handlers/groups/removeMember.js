const { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyMiembroRemovido } = require('../../utils/notificationHelper');

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, NotFoundError, AuthorizationError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB, retryAWS } = require("../../utils/retry");
const { invalidateUserPermissions } = require("../../utils/cache");

/**
 * DELETE /api/grupos/miembro/:id
 * Remueve un miembro de un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Cache invalidation
 * ✅ Interceptors (rate limit: 20 req/min)
 */
async function removeMemberHandler(event, context, logger) {
  const miembroSub = event.pathParameters?.id;
  const grupoId = event.queryStringParameters?.grupo_id;
  const userSub = event.userContext?.sub;
  
  if (!grupoId) {
    throw new ValidationError('grupo_id es requerido');
  }

  logger = logger.child({ groupId: grupoId, memberSub: miembroSub, removedBy: userSub });
  logger.info('Removing member from group');

  // Verificar que el miembro existe y no es el owner
  const memberResult = await retryDB(async () => {
    return await db.send(new GetCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      }
    }));
  });

  if (!memberResult.Item) {
    throw new NotFoundError('Member', miembroSub);
  }

  if (memberResult.Item.role === 'owner') {
    logger.warn('Attempt to remove group owner');
    throw new AuthorizationError('No se puede remover al propietario del grupo');
  }

  // Guardar datos del miembro ANTES de eliminarlo
  const removedName = memberResult.Item.user_name || 'Usuario';
  const removedEmail = memberResult.Item.user_email || '';
  
  logger.debug('Member data retrieved', { removedName, removedEmail });

  // Eliminar miembro
  await retryDB(async () => {
    await db.send(new DeleteCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      }
    }));
  });

  logger.info('Member removed successfully');

  // Invalidar cache de permisos
  await invalidateUserPermissions(miembroSub);

  // Obtener nombre del grupo para las notificaciones
  let grupoNombre = 'sin nombre';
  try {
    const groupResult = await retryDB(async () => {
      return await db.send(new GetCommand({
        TableName: process.env.GROUPS_TABLE,
        Key: { group_id: grupoId }
      }));
    });
    grupoNombre = groupResult.Item?.name || 'sin nombre';
  } catch (err) {
    logger.warn('Could not fetch group name', err);
  }

  // Notificar al usuario removido
  try {
    await notifyMiembroRemovido({
      userSubs: [miembroSub],
      grupoId,
      removedUserSub: miembroSub,
      removedUserName: removedName,
      removedUserEmail: removedEmail,
      createdBy: userSub,
      grupoNombre,
      isTargetUser: true
    });
    logger.debug('Notification sent to removed user');
  } catch (notifError) {
    logger.warn('Failed to notify removed user', notifError);
  }

  // Notificar a miembros restantes
  try {
    const membersResult = await retryAWS(async () => {
      return await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupoId }
      }));
    });

    const userSubs = (membersResult.Items || []).map(m => m.user_sub);
    
    if (userSubs.length > 0) {
      await notifyMiembroRemovido({
        userSubs,
        grupoId,
        removedUserSub: miembroSub,
        removedUserName: removedName,
        removedUserEmail: removedEmail,
        createdBy: userSub,
        grupoNombre,
        isTargetUser: false
      });
      logger.debug('Notifications sent to remaining members', { recipients: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Failed to notify remaining members', notifError);
  }

  return successResponse({ message: 'Miembro removido correctamente' });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(removeMemberHandler, {
  requireAuth: true,
  rateLimit: { max: 20, windowMs: 60000 }
});
