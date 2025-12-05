const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { validate, schemas } = require("../../utils/validator");
const { ValidationError, NotFoundError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 120, maxSize: 500 });

const obtenerAgendaPorId = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerAgendaPorId' });
  const { idAgenda } = event.queryStringParameters || {};
  
  if (!idAgenda) throw new ValidationError('idAgenda es requerido', 'MISSING_ID_AGENDA');
  validate(schemas.id, idAgenda, 'idAgenda');
  
  const cacheKey = `agenda-id-${idAgenda}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.info('Agenda desde cache', { idAgenda });
    return successResponse(cached);
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      IndexName: "GSI3_IdAgenda",
      KeyConditionExpression: "GSI3PK = :pk",
      ExpressionAttributeValues: { ":pk": `IDAGENDA#${idAgenda}` }
    })),
    { operation: 'obtenerAgendaPorId', idAgenda }
  );

  if (!data.Items || data.Items.length === 0) {
    logger.warn('Agenda no encontrada', { idAgenda });
    throw new NotFoundError('Agenda', idAgenda);
  }

  const item = data.Items[0];
  cache.set(cacheKey, item);
  logger.info('Agenda obtenida por ID', { idAgenda });
  
  return successResponse(item);
};

module.exports.handler = createAPIHandler(obtenerAgendaPorId, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
