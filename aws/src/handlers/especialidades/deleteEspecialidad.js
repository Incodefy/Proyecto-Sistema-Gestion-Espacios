// aws/src/handlers/especialidades/deleteEspecialidad.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const deleteEspecialidad = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteEspecialidad' });
  const grupo_id = event.pathParameters?.grupo_id;
  const especialidadId = event.pathParameters?.id;
  
  validate('deleteEspecialidad', { grupo_id, id: especialidadId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.ESPECIALIDADES_TABLE,
      Key: { PK: grupo_id, SK: `ESP#${especialidadId}` }
    })),
    { operation: 'getEspecialidad' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Especialidad no encontrada');
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.ESPECIALIDADES_TABLE,
      Key: { PK: grupo_id, SK: `ESP#${especialidadId}` }
    })),
    { operation: 'deleteEspecialidad' }
  );
  
  logger.info('Especialidad eliminada', { especialidadId });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Especialidad eliminada exitosamente" }) };
};

module.exports.handler = createAPIHandler(deleteEspecialidad, { rateLimit: { maxRequests: 15, windowSeconds: 60 } });
