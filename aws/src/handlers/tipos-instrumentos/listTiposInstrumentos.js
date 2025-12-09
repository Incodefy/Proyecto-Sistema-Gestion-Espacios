// aws/src/handlers/tipos-instrumentos/listTiposInstrumentos.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const listTiposInstrumentos = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listTiposInstrumentos' });
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('listTiposInstrumentos', { grupo_id });
  
  const result = await retryDB(
    () => db.send(new QueryCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":gid": grupo_id, ":prefix": "TIPO_INST#" }
    })),
    { operation: 'listTiposInstrumentos' }
  );
  
  const tipos = (result.Items || []).map(item => ({
    id: item.SK.replace('TIPO_INST#', ''),
    nombre: item.nombre,
    grupo_id: item.PK,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
  
  logger.info('Tipos obtenidos', { count: tipos.length });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, tipos, count: tipos.length }) };
};

module.exports.handler = createAPIHandler(listTiposInstrumentos, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });
