const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE;

/**
 * PUT /notifications/{id}/read
 * Marca una notificación como leída
 * 
 * También acepta PUT /notifications/read-all para marcar todas como leídas
 */
module.exports.handler = async (event) => {
  const TRACE_ID = event.headers?.['x-trace-id'] || `lambda-${Date.now()}`;
  
  try {
    console.log(`[${TRACE_ID}] 📖 Marcando notificación(es) como leída(s)...`);

    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userSub) {
      console.warn(`[${TRACE_ID}] ⚠️ No se encontró userSub en JWT`);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "No autenticado",
          trace_id: TRACE_ID
        })
      };
    }

    const notificationId = event.pathParameters?.id;
    const isReadAll = (
      notificationId === 'all' ||
      event.path?.endsWith('/read-all') ||
      event.resource === '/notifications/read-all' // para API Gateway REST
    );

    // Caso especial: marcar todas como leídas
    if (isReadAll) {
      console.log(`[${TRACE_ID}] 📚 Marcando TODAS las notificaciones como leídas`);
      // Usar Scan para obtener todas las notificaciones no leídas del usuario
      const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
      const scanResult = await db.send(new ScanCommand({
        TableName: NOTIFICATIONS_TABLE,
        FilterExpression: 'PK = :user AND leida = :leida',
        ExpressionAttributeValues: {
          ':user': `USER#${userSub}`,
          ':leida': false
        }
      }));

      const notifications = scanResult.Items || [];
      console.log(`[${TRACE_ID}] 📊 ${notifications.length} notificaciones no leídas encontradas`);

      // Actualizar cada una
      const updatePromises = notifications.map(notif => 
        db.send(new UpdateCommand({
          TableName: NOTIFICATIONS_TABLE,
          Key: {
            PK: notif.PK,
            SK: notif.SK
          },
          UpdateExpression: 'SET leida = :true, read_at = :now',
          ExpressionAttributeValues: {
            ':true': true,
            ':now': new Date().toISOString()
          }
        }))
      );

      await Promise.all(updatePromises);

      console.log(`[${TRACE_ID}] ✅ ${notifications.length} notificaciones marcadas como leídas`);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          message: `${notifications.length} notificaciones marcadas como leídas`,
          count: notifications.length,
          trace_id: TRACE_ID
        })
      };
    }

    // Caso normal: marcar una sola notificación
    if (!notificationId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "ID de notificación requerido",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] 📋 Notificación ID: ${notificationId}`);
    console.log(`[${TRACE_ID}] 👤 Usuario: ${userSub}`);

    // Buscar la notificación usando el GSI NotificationIdIndex
    const queryParams = {
      TableName: NOTIFICATIONS_TABLE,
      IndexName: 'NotificationIdIndex',
      KeyConditionExpression: 'notification_id = :id',
      ExpressionAttributeValues: {
        ':id': notificationId
      },
      Limit: 1
    };

    console.log(`[${TRACE_ID}] 🔍 Query params:`, JSON.stringify(queryParams, null, 2));

    const queryResult = await db.send(new QueryCommand(queryParams));

    console.log(`[${TRACE_ID}] 📊 Items encontrados:`, queryResult.Items?.length || 0);
    if (queryResult.Items?.length > 0) {
      console.log(`[${TRACE_ID}] 📄 Notificación encontrada:`, JSON.stringify(queryResult.Items[0], null, 2));
    }

    if (!queryResult.Items || queryResult.Items.length === 0) {
      console.warn(`[${TRACE_ID}] ⚠️ Notificación no encontrada`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Notificación no encontrada",
          trace_id: TRACE_ID
        })
      };
    }

    const notification = queryResult.Items[0];

    // Verificar que la notificación pertenece al usuario
    if (notification.PK !== `USER#${userSub}`) {
      console.warn(`[${TRACE_ID}] ⚠️ Notificación no pertenece al usuario`);
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "No tienes permiso para modificar esta notificación",
          trace_id: TRACE_ID
        })
      };
    }

    // Actualizar como leída
    await db.send(new UpdateCommand({
      TableName: NOTIFICATIONS_TABLE,
      Key: {
        PK: notification.PK,
        SK: notification.SK
      },
      UpdateExpression: 'SET leida = :true, read_at = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': new Date().toISOString()
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Notificación marcada como leída`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        message: "Notificación marcada como leída",
        notification_id: notificationId,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error:`, error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Error al marcar notificación como leída",
        trace_id: TRACE_ID
      })
    };
  }
};
