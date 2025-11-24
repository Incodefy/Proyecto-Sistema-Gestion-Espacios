const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, ListUsersCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});
const crypto = require("crypto");
const { getInvitationEmailTemplate, getInvitationEmailText } = require("../../utils/emailTemplates");
const { notifyMiembroInvitado } = require('../../utils/notificationHelper');

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /api/grupos/invitar | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    const { grupo_id, email, rol } = body;
    
    if (!grupo_id || !email || !rol) {
      console.warn(`[${TRACE_ID}] ⚠️ Datos incompletos`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id, email y rol son requeridos",
          trace_id: TRACE_ID
        })
      };
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn(`[${TRACE_ID}] ⚠️ Email inválido:`, email);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Email inválido",
          trace_id: TRACE_ID
        })
      };
    }

    // Validar rol (owner no se puede asignar manualmente)
    const rolesValidos = ['admin', 'escritor', 'lector'];
    if (!rolesValidos.includes(rol)) {
      console.warn(`[${TRACE_ID}] ⚠️ Rol inválido:`, rol);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: `Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}. El rol 'owner' solo puede tenerlo el creador del grupo.`,
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que el grupo existe
    const groupResult = await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: grupo_id }
    }));

    if (!groupResult.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Grupo no encontrado`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Grupo no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    // TODO: Verificar que el usuario que invita tiene permisos de admin/owner

    // Buscar al usuario en Cognito por email
    let invitedUserSub = null;
    try {
      // Buscar usuario por email en Cognito
      const usersResult = await cognito.send(new ListUsersCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Filter: `email = "${email}"`,
        Limit: 1
      }));
      
      if (usersResult.Users && usersResult.Users.length > 0) {
        invitedUserSub = usersResult.Users[0].Attributes?.find(attr => attr.Name === 'sub')?.Value;
        console.log(`[${TRACE_ID}] ✅ Usuario encontrado en Cognito: ${invitedUserSub}`);
      } else {
        console.log(`[${TRACE_ID}] ℹ️ Usuario no encontrado en Cognito, se enviará invitación por email`);
      }
    } catch (error) {
      console.log(`[${TRACE_ID}] ⚠️ Error buscando usuario en Cognito:`, error.message);
    }

    // Si el usuario ya existe, verificar que no sea miembro del grupo
    if (invitedUserSub) {
      const existingMember = await db.send(new GetCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Key: { 
          group_id: grupo_id,
          user_sub: invitedUserSub
        }
      }));

      if (existingMember.Item) {
        console.warn(`[${TRACE_ID}] ⚠️ Usuario ya es miembro del grupo`);
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ok: false, 
            error: "El usuario ya es miembro del grupo",
            trace_id: TRACE_ID
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
    const acceptLink = `${process.env.APP_URL}/aceptar-invitacion?token=${invitationToken}`;

    console.log(`[${TRACE_ID}] 📧 Enviando email a ${email}...`);

    try {
      // Enviar email con SES
      await ses.send(new SendEmailCommand({
        FromEmailAddress: process.env.SES_FROM_EMAIL,
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al enviar la invitación",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
