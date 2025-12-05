const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});
const crypto = require("crypto");
const { getInvitationEmailTemplate, getInvitationEmailText } = require("../../utils/emailTemplates");
const { notifyMiembroInvitado } = require('../../utils/notificationHelper');
const { getSecret } = require("../../utils/secretsManager");

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
const { cognitoWithCircuitBreaker, sendEmailWithCircuitBreaker } = require("../../utils/circuitBreaker");
const { retryDB, retryAWS } = require("../../utils/retry");
const { cacheSystemConfig } = require("../../utils/cache");

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

  // 2️⃣ VALIDACIÓN CON JSON SCHEMA
  const validationResult = validate('inviteMember', event.parsedBody, logger);
  
  if (!validationResult.valid) {
    logger.warn('Validation failed', { errors: validationResult.errors });
    throw new ValidationError('Invalid invitation data', { errors: validationResult.errors });
  }

  const { grupo_id, email, rol } = validationResult.data;
  const userSub = event.userContext?.sub;
  const userEmail = event.userContext?.email;
  const userName = event.userContext?.name || userEmail?.split('@')[0] || 'Usuario';

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

  // 4️⃣ BUSCAR USUARIO EN COGNITO CON CIRCUIT BREAKER
  let invitedUserSub = null;
  
  try {
    const usersResult = await cognitoWithCircuitBreaker(
      cognito,
      new ListUsersCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Filter: `email = "${email}"`,
        Limit: 1
      })
    );
    
    if (usersResult.Users && usersResult.Users.length > 0) {
      invitedUserSub = usersResult.Users[0].Attributes?.find(attr => attr.Name === 'sub')?.Value;
      logger.info('User found in Cognito', { invitedUserSub });
    } else {
      logger.info('User not found in Cognito - will send email invitation');
    }
  } catch (error) {
    logger.warn('Error searching user in Cognito', error);
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

  // 7️⃣ ENVIAR EMAIL CON CIRCUIT BREAKER
  const roleNames = {
    'admin': 'Administrador',
    'escritor': 'Escritor',
    'lector': 'Lector'
  };
  const roleName = roleNames[rol] || rol;
  const acceptLink = `${secrets.APP_URL}/aceptar-invitacion?token=${invitationToken}`;

  try {
    await logger.traceAsync('sendInvitationEmail', async () => {
      await sendEmailWithCircuitBreaker(ses, {
        FromEmailAddress: secrets.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Content: {
          Simple: {
            Subject: {
              Data: `Invitación al grupo ${groupName}`,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: getInvitationEmailTemplate({
                  invitedEmail: email,
                  groupName,
                  inviterName: userName,
                  roleName,
                  acceptLink
                }),
                Charset: 'UTF-8'
              },
              Text: {
                Data: getInvitationEmailText({
                  invitedEmail: email,
                  groupName,
                  inviterName: userName,
                  roleName,
                  acceptLink
                }),
                Charset: 'UTF-8'
              }
            }
          }
        }
      }, {
        fallback: async () => {
          logger.warn('Email not sent - circuit breaker open or SES failure', {
            action: 'INVITATION_CREATED_WITHOUT_EMAIL'
          });
          return { MessageId: 'FALLBACK' };
        }
      });
    }, { service: 'SES' });

    logger.info('Invitation email sent successfully');
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
          })
        };
      }
    }

    // Generar token único para la invitación
    const invitationToken = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    // TTL en formato epoch (segundos desde 1970) - 7 días
    const expiresAtEpoch = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

    console.log(`[${TRACE_ID}] 💾 Creando invitación con token:`, invitationToken);

    // Guardar invitación
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

    // Obtener información del invitador
    const inviterEmail = event.requestContext.authorizer.jwt.claims.email;
    const inviterName = event.requestContext.authorizer.jwt.claims['cognito:username'] || inviterEmail.split('@')[0];

    // Mapear nombres de roles
    const roleNames = {
      'admin': 'Administrador',
      'escritor': 'Escritor',
      'lector': 'Lector'
    };
    const roleName = roleNames[rol] || rol;

    // Construir link de aceptación
    const acceptLink = `${secrets.APP_URL}/aceptar-invitacion?token=${invitationToken}`;

    console.log(`[${TRACE_ID}] 📧 Enviando email a ${email}...`);

    try {
      // Enviar email con SES
      await ses.send(new SendEmailCommand({
        FromEmailAddress: secrets.SES_FROM_EMAIL,
        Destination: {
          ToAddresses: [email]
        },
        Content: {
          Simple: {
            Subject: {
              Data: `Invitación al grupo ${groupResult.Item.name || 'sin nombre'}`,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: getInvitationEmailTemplate({
                  invitedEmail: email,
                  groupName: groupResult.Item.name || 'sin nombre',
                  inviterName,
                  roleName,
                  acceptLink
                }),
                Charset: 'UTF-8'
              },
              Text: {
                Data: getInvitationEmailText({
                  invitedEmail: email,
                  groupName: groupResult.Item.name || 'sin nombre',
                  inviterName,
                  roleName,
                  acceptLink
                }),
                Charset: 'UTF-8'
              }
            }
          }
        }
      }));

      console.log(`[${TRACE_ID}] ✅ Email enviado exitosamente`);
    } catch (emailError) {
      console.error(`[${TRACE_ID}] ⚠️ Error enviando email (invitación creada):`, emailError.message);
      // No fallar la invitación si el email falla - la invitación ya está creada
    }

    console.log(`[${TRACE_ID}] ✅ Invitación creada exitosamente`);

    // Crear notificación para el usuario invitado (si tiene sub)
    if (invitedUserSub) {
      try {
        await notifyMiembroInvitado({
          invitedUserSub,
          grupoId: grupo_id,
          grupoNombre: groupResult.Item.name || 'sin nombre',
          createdBy: userSub,
          rol,
          invitedEmail: email
        });
        console.log(`[${TRACE_ID}] 📬 Notificación creada para ${email}`);
      } catch (notifError) {
        console.error(`[${TRACE_ID}] ⚠️ Error creando notificación:`, notifError);
        // No fallar si la notificación falla
      }
    }

    return {
      statusCode: 201,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: true,
        message: 'Invitación enviada correctamente',
        invitation_token: invitationToken,
        email,
        rol,
        grupo_id,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error enviando invitación:`, error);
    
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al enviar la invitación",
        trace_id: TRACE_ID
      })
    };
  }
};
