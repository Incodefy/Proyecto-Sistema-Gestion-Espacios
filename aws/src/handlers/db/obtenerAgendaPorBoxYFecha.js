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
const cache = new Cache({ ttl: 60, maxSize: 500 });

const obtenerAgendaPorBoxYFecha = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerAgendaPorBoxYFecha' });
  const { boxId, fecha } = event.queryStringParameters || {};
  
  if (!boxId || !fecha) {
    throw new ValidationError('boxId y fecha son requeridos', 'MISSING_PARAMS');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ValidationError('Fecha debe tener formato YYYY-MM-DD', 'INVALID_DATE_FORMAT');
  }
  validate(schemas.id, boxId, 'boxId');
  
  const pk = `BOX#${boxId}#DATE#${fecha}`;
  const cacheKey = `agenda-box-fecha-${boxId}-${fecha}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Agenda desde cache', { boxId, fecha, count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": pk }
    })),
    { operation: 'obtenerAgendaPorBoxYFecha', boxId, fecha }
  );
  
  const items = data.Items || [];
  cache.set(cacheKey, items);
  logger.info('Agenda obtenida', { boxId, fecha, count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerAgendaPorBoxYFecha, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
