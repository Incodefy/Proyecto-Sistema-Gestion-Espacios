const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { validate, schemas } = require("../../utils/validator");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 60, maxSize: 300 });

const obtenerAgendaPorBox = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerAgendaPorBox' });
  const { space_id } = event.queryStringParameters || {};
  
  if (!space_id) throw new ValidationError('space_id es requerido', 'MISSING_SPACE_ID');
  validate(schemas.id, space_id, 'space_id');
  
  const cacheKey = `agenda-box-${space_id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Agenda desde cache', { space_id, count: cached.length });
    return successResponse(cached, 200, { space_id, count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      KeyConditionExpression: "begins_with(PK, :pk)",
      ExpressionAttributeValues: { ":pk": `${space_id}#DATE#` }
    })),
    { operation: 'obtenerAgendaPorBox', space_id }
  );
  
  const items = data.Items || [];
  cache.set(cacheKey, items);
  logger.info('Agenda obtenida por espacio', { space_id, count: items.length });
  
  return successResponse(items, 200, { space_id, count: items.length });
};

module.exports.handler = createAPIHandler(obtenerAgendaPorBox, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
