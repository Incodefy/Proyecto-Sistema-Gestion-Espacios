const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { retryDB } = require("../../utils/retry");
const { validate, schemas } = require("../../utils/validator");
const { ValidationError, NotFoundError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 600, maxSize: 200 });

const obtenerBoxNombre = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerBoxNombre' });
  const { boxId } = event.queryStringParameters || {};
  
  if (!boxId) throw new ValidationError('boxId es requerido', 'MISSING_BOX_ID');
  validate(schemas.id, boxId, 'boxId');
  
  const cacheKey = `box-nombre-${boxId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Box nombre desde cache', { boxId });
    return successResponse(cached);
  }
  
  const data = await retryDB(
    () => client.send(new GetCommand({
      TableName: process.env.DB_CATALOGO,
      Key: { PK: `BOX#${boxId}`, SK: "#" }
    })),
    { operation: 'obtenerBoxNombre', boxId }
  );

  if (!data.Item) {
    logger.warn('Box no encontrado', { boxId });
    throw new NotFoundError('Box', boxId);
  }

  const result = { nombre: data.Item.nombre || null };
  cache.set(cacheKey, result);
  logger.info('Box nombre obtenido y cacheado', { boxId, nombre: result.nombre });
  
  return successResponse(result);
};

module.exports.handler = createAPIHandler(obtenerBoxNombre, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
