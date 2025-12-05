const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { retryDB } = require("../../utils/retry");
const { validate, schemas } = require("../../utils/validator");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 180, maxSize: 100 });

const obtenerInstrumentosPorBox = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerInstrumentosPorBox' });
  const { boxId } = event.queryStringParameters || {};
  
  if (!boxId) throw new ValidationError('boxId es requerido', 'MISSING_BOX_ID');
  validate(schemas.id, boxId, 'boxId');
  
  const cacheKey = `instrumentos-box-${boxId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Instrumentos desde cache', { boxId, count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_BOX_INSTRUMENTO,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `BOX#${boxId}` }
    })),
    { operation: 'obtenerInstrumentosPorBox', boxId }
  );
  
  const items = data.Items || [];
  cache.set(cacheKey, items);
  logger.info('Instrumentos obtenidos y cacheados', { boxId, count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerInstrumentosPorBox, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });