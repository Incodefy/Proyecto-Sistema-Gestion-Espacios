const {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyInvitacionAceptada } = require('../../utils/notificationHelper');

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /api/invitaciones/aceptar | ${TRACE_ID} ===`);

  try {
    const { token } = JSON.parse(event.body || "{}");

    if (!token) {
      console.warn(`[${TRACE_ID}] ⚠️ Token no proporcionado`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Token de invitación requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Obtener datos del usuario autenticado
    const userSub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event?.requestContext?.authorizer?.jwt?.claims?.email;
    let userName = event?.requestContext?.authorizer?.jwt?.claims?.name || 
                   event?.requestContext?.authorizer?.jwt?.claims?.['cognito:username'] || 
                   userEmail?.split('@')[0] || 
                   'Usuario';

    // Intentar obtener el nombre desde la tabla de usuarios
    try {
      const userResult = await db.send(new GetCommand({
        TableName: process.env.USERS_TABLE,
        Key: { user_sub: userSub }
      }));
      
      if (userResult.Item?.name) {
        userName = userResult.Item.name;
        console.log(`[${TRACE_ID}] 👤 Nombre obtenido de USERS_TABLE: ${userName}`);
      }
    } catch (err) {
      console.warn(`[${TRACE_ID}] ⚠️ No se pudo obtener nombre de USERS_TABLE:`, err.message);
    }

    if (!userSub || !userEmail) {
      console.warn(`[${TRACE_ID}] ⚠️ Usuario no autenticado`);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Debes iniciar sesión para aceptar la invitación",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] 👤 Usuario: ${userEmail} (${userSub})`);
    console.log(`[${TRACE_ID}] 🔍 Verificando token:`, token.substring(0, 8) + '...');

    // Buscar invitación
    const invite = await db.send(new GetCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Key: { token }
    }));

    if (!invite.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Invitación no encontrada`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Invitación no encontrada o ha expirado",
          trace_id: TRACE_ID
        })
      };
    }

    const invitation = invite.Item;

    // Validar que la invitación esté pendiente
    if (invitation.status !== 'pending') {
      console.warn(`[${TRACE_ID}] ⚠️ Invitación ya ${invitation.status}`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: invitation.status === 'ACCEPTED' 
            ? 'Esta invitación ya fue aceptada' 
            : 'Esta invitación no está disponible',
          trace_id: TRACE_ID
        })
      };
    }

    // Validar que el email coincida (importante para seguridad)
    if (invitation.invited_email.toLowerCase() !== userEmail.toLowerCase()) {
      console.warn(`[${TRACE_ID}] ⚠️ Email no coincide. Invitado: ${invitation.invited_email}, Usuario: ${userEmail}`);
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Esta invitación fue enviada a otro correo electrónico",
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que el usuario no sea ya miembro del grupo
    const existingMember = await db.send(new GetCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: invitation.group_id,
        user_sub: userSub
      }
    }));

    if (existingMember.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Usuario ya es miembro del grupo`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Ya eres miembro de este grupo",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] ✅ Todas las validaciones pasaron, agregando miembro...`);

    // Agregar al usuario como miembro del grupo
    await db.send(new PutCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Item: {
        group_id: invitation.group_id,
        user_sub: userSub,
        user_email: userEmail,
        user_name: userName,
        role: invitation.role,
        added_at: new Date().toISOString(),
        updated_by: userSub,
        joined_via: 'invitation'
      }
    }));

    // Marcar invitación como aceptada
    await db.send(new UpdateCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Key: { token },
      UpdateExpression: "SET #status = :accepted, accepted_at = :acceptedAt, accepted_by = :acceptedBy",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: { 
        ":accepted": "ACCEPTED",
        ":acceptedAt": new Date().toISOString(),
        ":acceptedBy": userSub
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Invitación aceptada exitosamente`);

    // Notificar a todos los miembros del grupo (excepto al nuevo miembro)
    try {
      const membersResult = await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': invitation.group_id }
      }));

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
        console.log(`[${TRACE_ID}] 📬 Notificaciones enviadas a ${userSubs.length} miembros`);
      }
    } catch (notifError) {
      console.error(`[${TRACE_ID}] ⚠️ Error enviando notificaciones:`, notifError);
      // No fallar si las notificaciones fallan
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: "Invitación aceptada exitosamente",
        group_id: invitation.group_id,
        role: invitation.role,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error aceptando invitación:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al aceptar la invitación",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
