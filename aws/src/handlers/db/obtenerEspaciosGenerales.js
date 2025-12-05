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
const cache = new Cache({ ttl: 120, maxSize: 100 });

const obtenerEspaciosGenerales = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerEspaciosGenerales' });
  const { grupo_id } = event.queryStringParameters || {};
  
  if (!grupo_id) throw new ValidationError('grupo_id es requerido', 'MISSING_GRUPO_ID');
  validate(schemas.groupId, grupo_id, 'grupo_id');
  
  const cacheKey = `espacios-generales-${grupo_id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Espacios generales desde cache', { grupo_id, count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.SPACES_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": grupo_id,
        ":sk": "SPACE#"
      }
    })),
    { operation: 'obtenerEspaciosGenerales', grupo_id }
  );

  const itemsOrdenados = (data.Items || []).sort((a, b) => {
    const numA = parseInt(a.SK.replace('SPACE#', ''));
    const numB = parseInt(b.SK.replace('SPACE#', ''));
    return numA - numB;
  });

  cache.set(cacheKey, itemsOrdenados);
  logger.info('Espacios generales obtenidos y cacheados', { grupo_id, count: itemsOrdenados.length });
  
  return successResponse(itemsOrdenados, 200, { count: itemsOrdenados.length });
};

module.exports.handler = createAPIHandler(obtenerEspaciosGenerales, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
