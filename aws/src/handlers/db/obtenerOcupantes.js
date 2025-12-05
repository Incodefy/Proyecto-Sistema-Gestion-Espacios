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
const cache = new Cache({ ttl: 120, maxSize: 100 });

const obtenerOcupantes = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerOcupantes' });
  const { grupo_id } = event.queryStringParameters || {};
  
  if (!grupo_id) throw new ValidationError('grupo_id es requerido', 'MISSING_GRUPO_ID');
  validate(schemas.groupId, grupo_id, 'grupo_id');
  
  const cacheKey = `ocupantes-${grupo_id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Ocupantes desde cache', { grupo_id, count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.OCCUPANTS_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": grupo_id,
        ":sk": "OCCUPANT#"
      }
    })),
    { operation: 'obtenerOcupantes', grupo_id }
  );
  
  const items = data.Items || [];
  cache.set(cacheKey, items);
  logger.info('Ocupantes obtenidos y cacheados', { grupo_id, count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerOcupantes, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
