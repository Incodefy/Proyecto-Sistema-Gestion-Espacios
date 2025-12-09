// aws/src/handlers/instrumentos/listInstrumentos.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const listInstrumentos = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listInstrumentos' });
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('listInstrumentos', { grupo_id });
  
  const result = await retryDB(
    () => db.send(new QueryCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":gid": grupo_id, ":prefix": "INST#" }
    })),
    { operation: 'listInstrumentos' }
  );
  
  const instrumentos = (result.Items || []).map(item => ({
    id: item.SK.replace('INST#', ''),
    nombre: item.nombre,
    tipo_instrumento_id: item.tipo_instrumento_id?.replace('TIPO_INST#', '') || '',
    grupo_id: item.PK,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
  
  logger.info('Instrumentos obtenidos', { count: instrumentos.length });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, instrumentos, count: instrumentos.length }) };
};

module.exports.handler = createAPIHandler(listInstrumentos, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });
