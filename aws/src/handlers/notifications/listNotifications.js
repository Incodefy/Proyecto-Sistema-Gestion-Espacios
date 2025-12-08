const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE;

/**
 * GET /notifications
 * Lista las notificaciones de un usuario
 * Query params: limit, grupo_id, solo_no_leidas
 */
const listNotifications = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listNotifications' });
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  
  const queryParams = event.queryStringParameters || {};
  const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
  const grupoId = queryParams.grupo_id;
  const soloNoLeidas = queryParams.solo_no_leidas === 'true';
  
  validate('listNotifications', { userSub, limit });
  
  logger.info('Consultando notificaciones desde DB', { 
    userSub,
    limit,
    grupo_id: grupoId,
    solo_no_leidas: soloNoLeidas
  });
  
  let params;
  
  if (grupoId) {
    params = {
      TableName: NOTIFICATIONS_TABLE,
      IndexName: 'GroupIndex',
      KeyConditionExpression: 'GSI1PK = :grupo',
      ExpressionAttributeValues: {
        ':grupo': `GROUP#${grupoId}`,
        ':user': `USER#${userSub}`
      },
      ScanIndexForward: false,
      Limit: limit
    };
    
    const filterParts = ['PK = :user'];
    if (soloNoLeidas) {
      filterParts.push('leida = :leida');
      params.ExpressionAttributeValues[':leida'] = false;
    }
    params.FilterExpression = filterParts.join(' AND ');
  } else {
    params = {
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'PK = :user',
      ExpressionAttributeValues: {
        ':user': `USER#${userSub}`
      },
      ScanIndexForward: false,
      Limit: limit
    };
    
    if (soloNoLeidas) {
      params.FilterExpression = 'leida = :leida';
      params.ExpressionAttributeValues[':leida'] = false;
    }
  }
  
  const result = await retryDB(
    () => db.send(new QueryCommand(params)),
    { operation: 'listNotifications' }
  );
  
  const notifications = (result.Items || []).map(item => ({
    id: item.notification_id,
    tipo: item.tipo,
    categoria: item.categoria,
    titulo: item.titulo,
    mensaje: item.mensaje,
    leida: item.leida,
    prioridad: item.prioridad,
    accion_requerida: item.accion_requerida,
    grupo_id: item.grupo_id,
    entidad_afectada: item.entidad_afectada,
    detalles: item.detalles,
    created_at: item.created_at,
    created_by: item.created_by
  }));
  
  const response = {
    notifications,
    count: notifications.length,
    has_more: !!result.LastEvaluatedKey
  };
  
  logger.info('Notificaciones obtenidas', { count: notifications.length });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, ...response })
  };
};

module.exports.handler = createAPIHandler(listNotifications, {
  rateLimit: { maxRequests: 100, windowSeconds: 60 }
});
