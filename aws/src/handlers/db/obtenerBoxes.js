const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 300, maxSize: 50 });

const obtenerBoxes = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerBoxes' });
  
  const cached = cache.get('all-boxes');
  if (cached) {
    logger.info('Boxes desde cache', { count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_CATALOGO,
      KeyConditionExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: { ':pk': 'BOX#' }
    })),
    { operation: 'obtenerBoxes' }
  );
  
  const items = data.Items || [];
  cache.set('all-boxes', items);
  logger.info('Boxes obtenidos y cacheados', { count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerBoxes, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });