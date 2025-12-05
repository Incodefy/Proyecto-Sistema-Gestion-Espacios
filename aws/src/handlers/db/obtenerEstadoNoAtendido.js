const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { Cache } = require("../../utils/cache");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 3600, maxSize: 5 });

const obtenerEstadoNoAtendido = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerEstadoNoAtendido' });
  
  const cached = cache.get('estado-no-atendido');
  if (cached) {
    logger.info('Estado desde cache', { idEstado: cached.idEstado });
    return successResponse(cached);
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_CATALOGO,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": "ESTADO#2" }
    })),
    { operation: 'obtenerEstadoNoAtendido' }
  );
  
  const estadoId = data.Items?.[0]?.idEstado || null;
  const result = { idEstado: estadoId };
  
  cache.set('estado-no-atendido', result);
  logger.info('Estado no atendido obtenido', { estadoId });
  
  return successResponse(result);
};

module.exports.handler = createAPIHandler(obtenerEstadoNoAtendido, { rateLimit: { maxRequests: 200, windowSeconds: 60 } });
