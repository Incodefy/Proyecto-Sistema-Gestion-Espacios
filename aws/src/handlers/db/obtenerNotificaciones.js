const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 30, maxSize: 20 });

const obtenerNotificaciones = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerNotificaciones' });
  
  const cached = cache.get('recent-notificaciones');
  if (cached) {
    logger.info('Notificaciones desde cache', { count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new ScanCommand({
      TableName: process.env.DB_NOTIFICACION,
      Limit: 50
    })),
    { operation: 'obtenerNotificaciones' }
  );

  const items = (data.Items || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  
  cache.set('recent-notificaciones', items);
  logger.info('Notificaciones obtenidas y ordenadas', { count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerNotificaciones, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });
