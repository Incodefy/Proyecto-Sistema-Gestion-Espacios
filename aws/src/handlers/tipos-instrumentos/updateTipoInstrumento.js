// aws/src/handlers/tipos-instrumentos/updateTipoInstrumento.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const updateTipoInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateTipoInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const tipoId = event.pathParameters?.id;
  
  validate('updateTipoInstrumento', { ...body, grupo_id, id: tipoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `TIPO_INST#${tipoId}` }
    })),
    { operation: 'getTipoInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Tipo de instrumento no encontrado');
  
  const now = new Date().toISOString();
  
  await retryDB(
    () => db.send(new UpdateCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `TIPO_INST#${tipoId}` },
      UpdateExpression: "SET nombre = :nombre, updated_at = :updated",
      ExpressionAttributeValues: {
        ":nombre": body.nombre.trim(),
        ":updated": now
      }
    })),
    { operation: 'updateTipoInstrumento' }
  );
  
  logger.info('Tipo de instrumento actualizado', { tipoId });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, tipo: { id: tipoId, nombre: body.nombre.trim(), grupo_id, updated_at: now } })
  };
};

module.exports.handler = createAPIHandler(updateTipoInstrumento, { rateLimit: { maxRequests: 40, windowSeconds: 60 } });
