// aws/src/handlers/instrumentos/deleteInstrumento.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const deleteInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteInstrumento' });
  const grupo_id = event.pathParameters?.grupo_id;
  const instrumentoId = event.pathParameters?.id;
  
  validate('deleteInstrumento', { grupo_id, id: instrumentoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` }
    })),
    { operation: 'getInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Instrumento no encontrado');
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` }
    })),
    { operation: 'deleteInstrumento' }
  );
  
  logger.info('Instrumento eliminado', { instrumentoId });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Instrumento eliminado correctamente" }) };
};

module.exports.handler = createAPIHandler(deleteInstrumento, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });
