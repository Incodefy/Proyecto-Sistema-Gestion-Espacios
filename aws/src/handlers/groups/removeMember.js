const { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyMiembroRemovido } = require('../../utils/notificationHelper');

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] DELETE /api/grupos/miembro/:id | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const miembroSub = event.pathParameters.id;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 🎯 Miembro Sub:`, miembroSub);
    
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

    // Verificar que el miembro existe y no es el owner
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
      console.warn(`[${TRACE_ID}] ⚠️ Intento de remover al owner`);
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "No se puede remover al propietario del grupo",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] 🗑️ Removiendo miembro del grupo`);

    // Guardar datos del miembro ANTES de eliminarlo
    const removedName = memberResult.Item.user_name || 'Usuario';
    const removedEmail = memberResult.Item.user_email || '';

    await db.send(new DeleteCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Miembro removido exitosamente`);

    // Obtener nombre del grupo para las notificaciones
    let grupoNombre = 'sin nombre';
    try {
      const groupResult = await db.send(new GetCommand({
        TableName: process.env.GROUPS_TABLE,
        Key: { grupo_id: grupoId }
      }));
      grupoNombre = groupResult.Item?.name || 'sin nombre';
    } catch (err) {
      console.warn(`[${TRACE_ID}] ⚠️ No se pudo obtener nombre del grupo:`, err.message);
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
        isTargetUser: true // Indicar que es el usuario afectado
      });
      console.log(`[${TRACE_ID}] 📬 Notificación enviada al usuario removido`);
    } catch (notifError) {
      console.error(`[${TRACE_ID}] ⚠️ Error enviando notificación al usuario removido:`, notifError);
    }

    // Notificar a todos los miembros restantes del grupo
    try {
      const membersResult = await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupoId }
      }));

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
        console.log(`[${TRACE_ID}] 📬 Notificaciones enviadas a ${userSubs.length} miembros restantes`);
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
        message: 'Miembro removido correctamente',
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error removiendo miembro:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al remover el miembro",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
