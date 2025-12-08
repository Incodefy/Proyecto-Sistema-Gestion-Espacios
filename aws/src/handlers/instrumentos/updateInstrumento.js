// aws/src/handlers/instrumentos/updateInstrumento.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const updateInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const instrumentoId = event.pathParameters?.id;
  
  validate('updateInstrumento', { ...body, grupo_id, id: instrumentoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` }
    })),
    { operation: 'getInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Instrumento no encontrado');
  
  const now = new Date().toISOString();
  let updateExpression = "SET nombre = :nombre, updated_at = :updated";
  let expressionValues = { ":nombre": body.nombre.trim(), ":updated": now };
  
  if (body.tipo_instrumento_id) {
    updateExpression += ", tipo_instrumento_id = :tipo";
    expressionValues[":tipo"] = `TIPO_INST#${body.tipo_instrumento_id}`;
  }
  
  await retryDB(
    () => db.send(new UpdateCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues
    })),
    { operation: 'updateInstrumento' }
  );
  
  logger.info('Instrumento actualizado', { instrumentoId });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, instrumento: { id: instrumentoId, nombre: body.nombre.trim(), tipo_instrumento_id: body.tipo_instrumento_id, grupo_id, updated_at: now } })
  };
};

module.exports.handler = createAPIHandler(updateInstrumento, { rateLimit: { maxRequests: 40, windowSeconds: 60 } });
