const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyRolCambiado } = require('../../utils/notificationHelper');

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /api/grupos/miembro/:id/rol | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const miembroSub = event.pathParameters.id;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 🎯 Miembro Sub:`, miembroSub);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!body.rol) {
      console.warn(`[${TRACE_ID}] ⚠️ Rol no proporcionado`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El rol es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Validar rol
    const rolesValidos = ['owner', 'admin', 'editor', 'viewer'];
    if (!rolesValidos.includes(body.rol)) {
      console.warn(`[${TRACE_ID}] ⚠️ Rol inválido:`, body.rol);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: `Rol inválido. Debe ser uno de: ${rolesValidos.join(', ')}`,
          trace_id: TRACE_ID
        })
      };
    }

    // Obtener grupo_id del query parameter
    const grupoId = event.queryStringParameters?.grupo_id;
    if (!grupoId) {
      console.warn(`[${TRACE_ID}] ⚠️ grupo_id no proporcionado`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // TODO: Verificar que el usuario que hace la petición tiene permisos de admin/owner

    // No permitir cambiar el rol del owner
    const memberResult = await db.send(new GetCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      }
    }));

    if (!memberResult.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Miembro no encontrado`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Miembro no encontrado en el grupo",
          trace_id: TRACE_ID
        })
      };
    }

    if (memberResult.Item.role === 'owner') {
      console.warn(`[${TRACE_ID}] ⚠️ Intento de cambiar rol del owner`);
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "No se puede cambiar el rol del propietario del grupo",
          trace_id: TRACE_ID
        })
      };
    }

    const timestamp = new Date().toISOString();

    // Guardar rol anterior y datos del miembro
    const rolAnterior = memberResult.Item.role;
    const targetUserName = memberResult.Item.user_name || 'Usuario';
    const targetUserEmail = memberResult.Item.user_email || '';

    console.log(`[${TRACE_ID}] 🔄 Actualizando rol del miembro (${rolAnterior} → ${body.rol})`);

    await db.send(new UpdateCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      },
      UpdateExpression: "SET #role = :rol, updated_at = :now, updated_by = :user",
      ExpressionAttributeNames: {
        '#role': 'role'
      },
      ExpressionAttributeValues: {
        ':rol': body.rol,
        ':now': timestamp,
        ':user': userSub
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Rol actualizado exitosamente`);

    // Notificar a todos los miembros del grupo
    try {
      const membersResult = await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupoId }
      }));

      const userSubs = (membersResult.Items || []).map(m => m.user_sub);
      
      if (userSubs.length > 0) {
        await notifyRolCambiado({
          userSubs,
          grupoId,
          targetUserSub: miembroSub,
          targetUserName,
          targetUserEmail,
          rolAnterior,
          rolNuevo: body.rol,
          createdBy: userSub
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
        message: 'Rol actualizado correctamente',
        miembro_id: miembroSub,
        rol: body.rol,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando rol:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar el rol",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
