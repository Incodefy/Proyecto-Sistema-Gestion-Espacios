// aws/src/handlers/especialidades/listEspecialidades.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");

const especialidadesCache = new Cache({ ttl: 300, maxSize: 500 }); // 5 min TTL

const listEspecialidades = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listEspecialidades' });
  
  const grupo_id = event.pathParameters?.grupo_id;
  validate('listEspecialidades', { grupo_id });
  
  const cacheKey = `especialidades:${grupo_id}`;
  const cached = especialidadesCache.get(cacheKey);
  
  if (cached) {
    logger.info('Especialidades obtenidas desde cache', { grupo_id, count: cached.length });
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        ok: true, 
        especialidades: cached,
        count: cached.length,
        cached: true
      })
    };
  }
  
  logger.info('Consultando especialidades desde DB', { grupo_id });
  
  const result = await retryDB(
    () => db.send(
      new QueryCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":gid": grupo_id,
          ":prefix": "ESP#"
        }
      })
    ),
    { operation: 'listEspecialidades' }
  );
  
  const especialidades = (result.Items || []).map(item => ({
    id: item.SK.replace('ESP#', ''),
    nombre: item.nombre,
    grupo_id: item.PK,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
  
  especialidadesCache.set(cacheKey, especialidades);
  logger.info('Especialidades obtenidas y cacheadas', { count: especialidades.length });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      ok: true, 
      especialidades,
      count: especialidades.length
    })
  };
};

module.exports.handler = createAPIHandler(listEspecialidades, {
  rateLimit: { maxRequests: 100, windowSeconds: 60 }
});
