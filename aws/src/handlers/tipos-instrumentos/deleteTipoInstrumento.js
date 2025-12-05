// aws/src/handlers/tipos-instrumentos/deleteTipoInstrumento.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const deleteTipoInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteTipoInstrumento' });
  const grupo_id = event.pathParameters?.grupo_id;
  const tipoId = event.pathParameters?.id;
  
  validate('deleteTipoInstrumento', { grupo_id, id: tipoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `TIPO_INST#${tipoId}` }
    })),
    { operation: 'getTipoInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Tipo de instrumento no encontrado');
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `TIPO_INST#${tipoId}` }
    })),
    { operation: 'deleteTipoInstrumento' }
  );
  
  logger.info('Tipo de instrumento eliminado', { tipoId });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Tipo de instrumento eliminado correctamente" }) };
};

module.exports.handler = createAPIHandler(deleteTipoInstrumento, { rateLimit: { maxRequests: 15, windowSeconds: 60 } });
