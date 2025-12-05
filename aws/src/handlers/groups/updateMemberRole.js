const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyRolCambiado } = require('../../utils/notificationHelper');

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { ValidationError, NotFoundError, AuthorizationError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB, retryAWS } = require("../../utils/retry");
const { invalidateUserPermissions } = require("../../utils/cache");

/**
 * PUT /api/grupos/miembro/:id/rol
 * Actualiza el rol de un miembro del grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ JSON Schema validation
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Cache invalidation
 * ✅ Interceptors (rate limit: 30 req/min)
 */
async function updateMemberRoleHandler(event, context, logger) {
  const miembroSub = event.pathParameters?.id;
  const grupoId = event.queryStringParameters?.grupo_id;
  const userSub = event.userContext?.sub;
  
  // Validación con JSON Schema
  const result = validate('updateMemberRole', event.parsedBody, logger);
  if (!result.valid) {
    throw new ValidationError('Invalid role data', { errors: result.errors });
  }
  
  const { rol } = result.data;
  
  if (!grupoId) {
    throw new ValidationError('grupo_id es requerido');
  }

  logger = logger.child({ groupId: grupoId, memberSub: miembroSub, newRole: rol });
  logger.info('Updating member role');

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
    logger.warn('Attempt to change owner role');
    throw new AuthorizationError('No se puede cambiar el rol del propietario del grupo');
  }

  const timestamp = new Date().toISOString();
  const rolAnterior = memberResult.Item.role;
  const targetUserName = memberResult.Item.user_name || 'Usuario';
  const targetUserEmail = memberResult.Item.user_email || '';

  logger.debug('Updating role', { from: rolAnterior, to: rol });

  // Actualizar rol
  await retryDB(async () => {
    await db.send(new UpdateCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      },
      UpdateExpression: "SET #role = :rol, updated_at = :now, updated_by = :user",
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: {
        ':rol': rol,
        ':now': timestamp,
        ':user': userSub
      }
    }));
  });

  logger.info('Role updated successfully');

  // Invalidar cache de permisos
  await invalidateUserPermissions(miembroSub);

  // Notificar a todos los miembros del grupo
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
      await notifyRolCambiado({
        userSubs,
        grupoId,
        targetUserSub: miembroSub,
        targetUserName,
        targetUserEmail,
        rolAnterior,
        rolNuevo: rol,
        createdBy: userSub
      });
      logger.debug('Notifications sent', { recipients: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Failed to send notifications', notifError);
  }

  return successResponse({
    message: 'Rol actualizado correctamente',
    miembro_id: miembroSub,
    rol: rol
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(updateMemberRoleHandler, {
  requireAuth: true,
  rateLimit: { max: 30, windowMs: 60000 }
});
