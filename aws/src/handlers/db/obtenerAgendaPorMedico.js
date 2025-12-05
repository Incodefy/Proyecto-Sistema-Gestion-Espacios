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
const cache = new Cache({ ttl: 60, maxSize: 200 });

const obtenerAgendaPorMedico = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerAgendaPorMedico' });
  const { occupant_id } = event.queryStringParameters || {};
  
  if (!occupant_id) throw new ValidationError('occupant_id es requerido', 'MISSING_OCCUPANT_ID');
  validate(schemas.id, occupant_id, 'occupant_id');
  
  const cacheKey = `agenda-medico-${occupant_id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Agenda desde cache', { occupant_id, count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      IndexName: "MedicoFechaIndex",
      KeyConditionExpression: "begins_with(GSI1PK, :prefix)",
      ExpressionAttributeValues: { ":prefix": `${occupant_id}#DATE#` }
    })),
    { operation: 'obtenerAgendaPorMedico', occupant_id }
  );
  
  const items = data.Items || [];
  cache.set(cacheKey, items);
  logger.info('Agenda obtenida por ocupante', { occupant_id, count: items.length });
  
  return successResponse(items, 200, { count: items.length, occupant_id });
};

module.exports.handler = createAPIHandler(obtenerAgendaPorMedico, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
