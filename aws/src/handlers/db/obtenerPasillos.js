const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cache = new Cache({ ttl: 300, maxSize: 50 });

const obtenerPasillos = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerPasillos' });
  
  const cached = cache.get('all-pasillos');
  if (cached) {
    logger.info('Pasillos desde cache', { count: cached.length });
    return successResponse(cached, 200, { count: cached.length, cached: true });
  }
  
  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_CATALOGO,
      IndexName: "TipoEntidadIndex",
      KeyConditionExpression: "GSI1PK = :tipo",
      ExpressionAttributeValues: { ":tipo": "TIPO#PASILLO" }
    })),
    { operation: 'obtenerPasillos' }
  );
  
  const items = (data.Items || []).sort((a, b) => {
    if (a.idBox < b.idBox) return -1;
    if (a.idBox > b.idBox) return 1;
    return 0;
  });
  
  cache.set('all-pasillos', items);
  logger.info('Pasillos obtenidos y cacheados', { count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerPasillos, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });
