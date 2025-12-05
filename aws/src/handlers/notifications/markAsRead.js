const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { NotFoundError, AuthorizationError } = require("../../utils/errorHandler");
const { retryDB } = require("../../utils/retry");
const { quickBatchUpdate } = require("../../utils/batchHelper");
const { createAPIHandler } = require("../../middleware/interceptors");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE;

/**
 * PUT /notifications/{id}/read
 * Marca una o todas las notificaciones como leídas
 */
const markAsRead = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'markAsRead' });
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const notificationId = event.pathParameters?.id;
  
  const isReadAll = (
    notificationId === 'all' ||
    event.path?.endsWith('/read-all') ||
    event.resource === '/notifications/read-all'
  );
  
  validate('markAsRead', { userSub, notificationId: isReadAll ? 'all' : notificationId });
  
  // Caso: Marcar TODAS como leídas (batch operation)
  if (isReadAll) {
    logger.info('Marcando todas las notificaciones como leídas', { userSub });
    
    const scanResult = await retryDB(
      () => db.send(new ScanCommand({
        TableName: NOTIFICATIONS_TABLE,
        FilterExpression: 'PK = :user AND leida = :leida',
        ExpressionAttributeValues: {
          ':user': `USER#${userSub}`,
          ':leida': false
        }
      })),
      { operation: 'scanUnreadNotifications' }
    );
    
    const notifications = scanResult.Items || [];
    logger.info('Notificaciones no leídas encontradas', { count: notifications.length });
    
    if (notifications.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          message: 'No hay notificaciones no leídas',
          count: 0
        })
      };
    }
    
    // Batch update con helper optimizado
    const now = new Date().toISOString();
    const updates = notifications.map(notif => ({
      Key: { PK: notif.PK, SK: notif.SK },
      UpdateExpression: 'SET leida = :true, read_at = :now',
      ExpressionAttributeValues: {
        ':true': true,
        ':now': now
      }
    }));
    
    // Procesar en paralelo con Promise.all (optimizado para < 25 items)
    await Promise.all(
      updates.map(update => 
        retryDB(
          () => db.send(new UpdateCommand({ TableName: NOTIFICATIONS_TABLE, ...update })),
          { operation: 'batchMarkAsRead' }
        )
      )
    );
    
    logger.info('Notificaciones marcadas como leídas en batch', { count: notifications.length });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        message: `${notifications.length} notificaciones marcadas como leídas`,
        count: notifications.length
      })
    };
  }
  
  // Caso: Marcar UNA notificación como leída
  logger.info('Marcando notificación individual como leída', { notificationId });
  
  const queryResult = await retryDB(
    () => db.send(new QueryCommand({
      TableName: NOTIFICATIONS_TABLE,
      IndexName: 'NotificationIdIndex',
      KeyConditionExpression: 'notification_id = :id',
      ExpressionAttributeValues: {
        ':id': notificationId
      },
      Limit: 1
    })),
    { operation: 'getNotificationById' }
  );
  
  if (!queryResult.Items || queryResult.Items.length === 0) {
    throw new NotFoundError('Notificación no encontrada');
  }
  
  const notification = queryResult.Items[0];
  
  // Verificar pertenencia al usuario
  if (notification.PK !== `USER#${userSub}`) {
    throw new AuthorizationError('No tienes permiso para modificar esta notificación');
  }
  
  await retryDB(
    () => db.send(new UpdateCommand({
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
    })),
    { operation: 'markNotificationAsRead' }
  );
  
  logger.info('Notificación marcada como leída', { notificationId });
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      message: 'Notificación marcada como leída',
      notification_id: notificationId
    })
  };
};

module.exports.handler = createAPIHandler(markAsRead, {
  rateLimit: { maxRequests: 50, windowSeconds: 60 }
});
