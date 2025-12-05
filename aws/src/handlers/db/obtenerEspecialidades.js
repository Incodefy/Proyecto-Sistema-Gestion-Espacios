const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 300, maxSize: 100 });

const obtenerEspecialidades = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerEspecialidades' });
  
  const cached = cache.get('all-especialidades');
  if (cached) {
    logger.info('Especialidades desde cache', { count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_CATALOGO,
      IndexName: "TipoEntidadIndex",
      KeyConditionExpression: "GSI1PK = :tipo",
      ExpressionAttributeValues: { ":tipo": "TIPO#ESPECIALIDAD" }
    })),
    { operation: 'obtenerEspecialidades' }
  );
  
  const items = data.Items || [];
  cache.set('all-especialidades', items);
  logger.info('Especialidades obtenidas y cacheadas', { count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerEspecialidades, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
