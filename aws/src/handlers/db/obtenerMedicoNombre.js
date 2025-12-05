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
const cache = new Cache({ ttl: 600, maxSize: 300 });

const obtenerMedicoNombre = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerMedicoNombre' });
  const { medicoId } = event.queryStringParameters || {};
  
  if (!medicoId) throw new ValidationError('medicoId es requerido', 'MISSING_MEDICO_ID');
  validate(schemas.id, medicoId, 'medicoId');
  
  const cacheKey = `medico-nombre-${medicoId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Médico nombre desde cache', { medicoId });
    return successResponse(cached);
  }
  
  const data = await retryDB(
    () => client.send(new GetCommand({
      TableName: process.env.DB_CATALOGO,
      Key: { PK: `MEDICO#${medicoId}`, SK: "#" }
    })),
    { operation: 'obtenerMedicoNombre', medicoId }
  );

  if (!data.Item) {
    logger.warn('Médico no encontrado', { medicoId });
    throw new NotFoundError('Médico', medicoId);
  }

  const result = { nombre: data.Item.nombre || null };
  cache.set(cacheKey, result);
  logger.info('Médico nombre obtenido y cacheado', { medicoId, nombre: result.nombre });
  
  return successResponse(result);
};

module.exports.handler = createAPIHandler(obtenerMedicoNombre, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
