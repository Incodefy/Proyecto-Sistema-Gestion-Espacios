const { DynamoDBDocumentClient, DeleteCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyEspacioEliminado } = require('../../utils/notificationHelper');

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] DELETE /api/espacios/espacio/:id | ${TRACE_ID} ===`);
  console.log(`[${TRACE_ID}] 🔍 Full event:`, JSON.stringify(event, null, 2));
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const espacioId = event.pathParameters.id; // Formato: SPACE#1 o SUBSPACE#1
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📦 Espacio ID (raw):`, espacioId);
    console.log(`[${TRACE_ID}] 📦 Path parameters:`, JSON.stringify(event.pathParameters));
    console.log(`[${TRACE_ID}] 📦 Query parameters:`, JSON.stringify(event.queryStringParameters));

    // Necesitamos el grupo_id para la clave
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

    // TODO: Verificar que el usuario tenga permisos para eliminar espacios del grupo

    // Verificar que el espacio existe
    const getResult = await db.send(new GetCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { 
        PK: grupoId,
        SK: espacioId
      }
    }));

    if (!getResult.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Espacio no encontrado`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Espacio no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    // Si es un espacio general (SPACE#), verificar que no tenga sub-espacios
    if (espacioId.startsWith('SPACE#')) {
      const queryResult = await db.send(new QueryCommand({
        TableName: process.env.SPACES_TABLE,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'parent = :parent',
        ExpressionAttributeValues: {
          ':pk': grupoId,
          ':parent': espacioId
        },
        Limit: 1
      }));

      if (queryResult.Items && queryResult.Items.length > 0) {
        console.warn(`[${TRACE_ID}] ⚠️ El espacio tiene sub-espacios`);
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ok: false, 
            error: "No se puede eliminar un espacio que tiene sub-espacios. Elimina los sub-espacios primero.",
            trace_id: TRACE_ID
          })
        };
      }
    }

    console.log(`[${TRACE_ID}] 🗑️ Eliminando espacio:`, espacioId);

    const espacioNombre = getResult.Item.nombre;
    const espacioTipo = getResult.Item.tipo;

    await db.send(new DeleteCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { 
        PK: grupoId,
        SK: espacioId
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Espacio eliminado exitosamente`);

    // Notificar a todos los miembros del grupo
    try {
      const membersResult = await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupoId }
      }));

      const userSubs = (membersResult.Items || []).map(m => m.user_sub);
      
      if (userSubs.length > 0) {
        await notifyEspacioEliminado({
          userSubs,
          grupoId,
          createdBy: userSub,
          espacioId,
          espacioNombre,
          espacioTipo
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
        message: 'Espacio eliminado correctamente',
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error eliminando espacio:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al eliminar el espacio",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
