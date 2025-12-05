const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyInvitacionAceptada } = require('../../utils/notificationHelper');

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, NotFoundError, ConflictError, AuthorizationError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB, retryAWS } = require("../../utils/retry");
const { invalidateUserPermissions } = require("../../utils/cache");

/**
 * POST /api/invitaciones/aceptar
 * Acepta una invitación a un grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Cache invalidation
 * ✅ Interceptors (rate limit: 30 req/min)
 */
async function acceptInvitationHandler(event, context, logger) {
  const { token } = event.parsedBody;
  
  if (!token) {
    throw new ValidationError('Token de invitación requerido');
  }

  const userSub = event.userContext?.sub;
  const userEmail = event.userContext?.email;
  let userName = event.userContext?.name || userEmail?.split('@')[0] || 'Usuario';

  logger = logger.child({ token: token.substring(0, 8), userSub });
  logger.info('Accepting invitation');

  // Intentar obtener nombre de USERS_TABLE
  try {
    const userResult = await retryDB(async () => {
      return await db.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { user_sub: userSub }
      }));
    });
    
    if (userResult.Item?.name) {
      userName = userResult.Item.name;
      logger.debug('User name retrieved from USERS_TABLE', { userName });
    }
  } catch (err) {
    logger.warn('Could not fetch user name from USERS_TABLE', err);
  }

  // Buscar invitación con retry
  const invite = await retryDB(async () => {
    return await db.send(new GetCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Key: { token }
    }));
  });

  if (!invite.Item) {
    throw new NotFoundError('Invitación', token);
  }

  const invitation = invite.Item;
  logger = logger.child({ groupId: invitation.group_id, invitedEmail: invitation.invited_email });

  // Validar estado
  if (invitation.status !== 'pending') {
    const message = invitation.status === 'ACCEPTED' 
      ? 'Esta invitación ya fue aceptada' 
      : 'Esta invitación no está disponible';
    throw new ConflictError(message);
  }

  // Validar email
  if (invitation.invited_email.toLowerCase() !== userEmail.toLowerCase()) {
    logger.warn('Email mismatch', { 
      invited: invitation.invited_email, 
      current: userEmail 
    });
    throw new AuthorizationError('Esta invitación fue enviada a otro correo electrónico');
  }

  // Verificar membership existente
  const existingMember = await retryDB(async () => {
    return await db.send(new GetCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: invitation.group_id,
        user_sub: userSub
      }
    }));
  });

  if (existingMember.Item) {
    logger.warn('User is already a member');
    throw new ConflictError('Ya eres miembro de este grupo');
  }

  logger.debug('All validations passed, adding member');

  // Agregar miembro y actualizar invitación
  const timestamp = new Date().toISOString();

  await retryDB(async () => {
    await db.send(new PutCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Item: {
        group_id: invitation.group_id,
        user_sub: userSub,
        user_email: userEmail,
        user_name: userName,
        role: invitation.role,
        added_at: timestamp,
        updated_by: userSub,
        joined_via: 'invitation'
      }
    }));
  });

  await retryDB(async () => {
    await db.send(new UpdateCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Key: { token },
      UpdateExpression: "SET #status = :accepted, accepted_at = :acceptedAt, accepted_by = :acceptedBy",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { 
        ":accepted": "ACCEPTED",
        ":acceptedAt": timestamp,
        ":acceptedBy": userSub
      }
    }));
  });

  logger.info('Invitation accepted successfully');

  // Invalidar cache de permisos
  await invalidateUserPermissions(userSub);

  // Notificar a miembros existentes
  try {
    const membersResult = await retryAWS(async () => {
      return await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': invitation.group_id }
      }));
    });

    const userSubs = (membersResult.Items || []).map(m => m.user_sub);
    
    if (userSubs.length > 0) {
      await notifyInvitacionAceptada({
        userSubs,
        grupoId: invitation.group_id,
        newMemberSub: userSub,
        newMemberName: userName,
        newMemberEmail: userEmail,
        rol: invitation.role
      });
      logger.debug('Notifications sent', { recipients: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Failed to send notifications', notifError);
  }

  return successResponse({
    message: "Invitación aceptada exitosamente",
    group_id: invitation.group_id,
    role: invitation.role
  });
}

// Exportar con interceptors
module.exports.handler = createAPIHandler(acceptInvitationHandler, {
  requireAuth: true,
  rateLimit: { max: 30, windowMs: 60000 }
});
