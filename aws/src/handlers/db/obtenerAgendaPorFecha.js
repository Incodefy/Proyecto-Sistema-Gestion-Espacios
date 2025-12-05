const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 60, maxSize: 300 });

const obtenerAgendaPorFecha = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerAgendaPorFecha' });
  const { fecha } = event.queryStringParameters || {};
  
  if (!fecha) throw new ValidationError('fecha es requerida', 'MISSING_FECHA');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ValidationError('Fecha debe tener formato YYYY-MM-DD', 'INVALID_DATE_FORMAT');
  }
  
  const cacheKey = `agenda-fecha-${fecha}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Agenda desde cache', { fecha, count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      IndexName: "FechaIndex",
      KeyConditionExpression: "GSI2PK = :fecha",
      ExpressionAttributeValues: { ":fecha": `DATE#${fecha}` }
    })),
    { operation: 'obtenerAgendaPorFecha', fecha }
  );
  
  const items = data.Items || [];
  cache.set(cacheKey, items);
  logger.info('Agenda obtenida por fecha', { fecha, count: items.length });
  
  return successResponse(items, 200, { count: items.length, fecha });
};

module.exports.handler = createAPIHandler(obtenerAgendaPorFecha, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
