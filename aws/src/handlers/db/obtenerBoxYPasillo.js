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
const cache = new Cache({ ttl: 300, maxSize: 200 });

const obtenerBoxYPasillo = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerBoxYPasillo' });
  const { boxId } = event.queryStringParameters || {};
  
  if (!boxId) throw new ValidationError('boxId es requerido', 'MISSING_BOX_ID');
  validate(schemas.id, boxId, 'boxId');
  
  const cacheKey = `box-pasillo-${boxId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Box+Pasillo desde cache', { boxId });
    return successResponse(cached);
  }
  
  const data = await retryDB(
    () => client.send(new GetCommand({
      TableName: process.env.DB_CATALOGO,
      Key: { PK: `BOX#${boxId}`, SK: "#" }
    })),
    { operation: 'obtenerBoxYPasillo', boxId }
  );

  if (!data.Item) {
    logger.warn('Box no encontrado', { boxId });
    throw new NotFoundError('Box', boxId);
  }

  const item = {
    idBox: data.Item.idBox,
    nombre: data.Item.nombre,
    estado: data.Item.estado,
    idPasillo: data.Item.idPasillo,
    pasilloNombre: data.Item.pasilloNombre
  };

  cache.set(cacheKey, item);
  logger.info('Box con pasillo obtenido y cacheado', { boxId, idPasillo: item.idPasillo });
  
  return successResponse(item);
};

module.exports.handler = createAPIHandler(obtenerBoxYPasillo, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
