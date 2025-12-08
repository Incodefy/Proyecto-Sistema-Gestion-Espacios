const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const crypto = require("crypto");
const { notifyMiembroInvitado } = require('../../utils/notificationHelper');
const { getSecret } = require("../../utils/secretsManager");

// ✅ ANTI-CORRUPTION LAYER: Adaptadores reemplazan llamadas directas a AWS
const { getUserAdapter, getEmailAdapter } = require("../../adapters");

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError, 
  successResponse 
} = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { retryDB } = require("../../utils/retry");
const { cacheSystemConfig } = require("../../utils/cache");

// Inicializar DynamoDB Client
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Adaptadores (ACL)
const userAdapter = getUserAdapter();
const emailAdapter = getEmailAdapter();

/**
 * POST /groups/{group_id}/invite
 * Invita a un usuario al grupo
 * 
 * MEJORAS:
 * ✅ Logging estructurado
 * ✅ JSON Schema validation
 * ✅ Circuit breakers para SES y Cognito
 * ✅ Error handling centralizado
 * ✅ Retry logic automático
 * ✅ Interceptors (rate limit: 20 req/min)
 */
async function inviteMemberHandler(event, context, logger) {
  logger.info('Processing member invitation');

  // 1️⃣ OBTENER SECRETS Y VALIDAR
  const secrets = await cacheSystemConfig('appSecrets', async () => {
    return await getSecret();
  });

  // Extraer parámetros del body (grupo_id viene en body para esta ruta alternativa)
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const { grupo_id, email, rol } = body;

  // 2️⃣ VALIDACIÓN CON JSON SCHEMA
  const validationResult = validate('inviteMember', { grupo_id, email, rol }, logger);
  
  if (!validationResult.valid) {
    logger.warn('Validation failed', { errors: validationResult.errors });
    throw new ValidationError('Invalid invitation data', { errors: validationResult.errors });
  }

  // Extraer información del usuario que invita
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub || 
                  event.requestContext?.authorizer?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email || 
                    event.requestContext?.authorizer?.claims?.email;
  const userName = event.requestContext?.authorizer?.jwt?.claims?.['cognito:username'] || 
                   userEmail?.split('@')[0] || 'Usuario';

  logger = logger.child({ grupo_id, invitedEmail: email, role: rol });

  // 3️⃣ VERIFICAR QUE EL GRUPO EXISTE
  const groupResult = await retryDB(async () => {
    return await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupo_id }
    }));
  });

  if (!groupResult.Item) {
    logger.warn('Group not found');
    throw new NotFoundError('Group', grupo_id);
  }

  const groupName = groupResult.Item.nombre || groupResult.Item.name || 'sin nombre';
  logger.debug('Group found', { groupName });

  // 4️⃣ BUSCAR USUARIO CON USERADAPTER (ACL)
  let invitedUserSub = null;
  
  try {
    // ✅ ACL: UserAdapter maneja Cognito con circuit breaker y retry
    const users = await userAdapter.findByEmail(email);
    
    if (users && users.length > 0) {
      invitedUserSub = users[0].userId;
      logger.info('User found via UserAdapter', { invitedUserSub });
    } else {
      logger.info('User not found - will send email invitation');
    }
  } catch (error) {
    logger.warn('Error searching user via UserAdapter', error);
    // Continuar sin el user_sub - se enviará invitación por email
  }

  // 5️⃣ VERIFICAR QUE NO SEA YA MIEMBRO
  if (invitedUserSub) {
    const existingMember = await retryDB(async () => {
      return await db.send(new GetCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Key: { 
          group_id: grupo_id,
          user_sub: invitedUserSub
        }
      }));
    });

    if (existingMember.Item) {
      logger.warn('User is already a member');
      throw new ConflictError('El usuario ya es miembro del grupo');
    }
  }

  // 6️⃣ CREAR INVITACIÓN
  const invitationToken = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const expiresAtEpoch = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 días

  logger.info('Creating invitation', { invitationToken });

  await retryDB(async () => {
    await db.send(new PutCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Item: {
        token: invitationToken,
        group_id: grupo_id,
        invited_email: email,
        invited_user_sub: invitedUserSub,
        role: rol,
        invited_by: userSub,
        status: 'pending',
        created_at: timestamp,
        expires_at: expiresAtEpoch
      }
    }));
  });

  // 7️⃣ ENVIAR EMAIL CON EMAILADAPTER (ACL)
  const roleNames = {
    'admin': 'Administrador',
    'escritor': 'Escritor',
    'lector': 'Lector'
  };
  const roleName = roleNames[rol] || rol;
  const acceptLink = `${secrets.APP_URL}/aceptar-invitacion?token=${invitationToken}`;

  try {
    await logger.traceAsync('sendInvitationEmail', async () => {
      // ✅ ACL: EmailAdapter maneja SES (circuit breaker, rate limit, retry)
      await emailAdapter.sendGroupInvitation(
        email,
        groupName,
        userName,
        acceptLink
      );
    }, { service: 'EmailAdapter' });

    logger.info('Invitation email sent successfully via EmailAdapter');
  } catch (emailError) {
    logger.error('Email sending failed but invitation created', emailError);
    // No fallar - la invitación ya está creada
  }

  // 8️⃣ CREAR NOTIFICACIÓN (si tiene user_sub)
  if (invitedUserSub) {
    try {
      await notifyMiembroInvitado({
        invitedUserSub,
        grupoId: grupo_id,
        grupoNombre: groupName,
        createdBy: userSub,
        rol,
        invitedEmail: email
      });
      logger.debug('Notification created');
    } catch (notifError) {
      logger.warn('Failed to create notification', notifError);
      // No fallar
    }
  }

  logger.info('Invitation process completed successfully');

  // 9️⃣ RESPONSE
  return successResponse({
    message: 'Invitación enviada correctamente',
    invitation_token: invitationToken,
    email,
    rol,
    grupo_id
  }, 201);
}

// Exportar con interceptors (rate limit: 20 req/min)
exports.handler = createAPIHandler(inviteMemberHandler, {
  rateLimit: {
    limit: 20,
    window: 60,
    endpoint: 'inviteMember'
  }
});
