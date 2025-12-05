// aws/src/handlers/groups/updateSpace.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const updateSpace = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateSpace' });
  const body = JSON.parse(event.body || "{}");
  const espacioId = event.pathParameters?.id;
  const grupoId = body.grupo_id || event.queryStringParameters?.grupo_id;
  
  validate('updateSpace', { ...body, grupo_id: grupoId, id: espacioId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { PK: grupoId, SK: espacioId }
    })),
    { operation: 'getSpace' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Espacio no encontrado');
  
  const timestamp = new Date().toISOString();
  
  await retryDB(
    () => db.send(new UpdateCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { PK: grupoId, SK: espacioId },
      UpdateExpression: \"SET nombre = :nombre, updated_at = :now\",
      ExpressionAttributeValues: {
        \":nombre\": body.nombre.trim(),
        \":now\": timestamp
      }
    })),
    { operation: 'updateSpace' }
  );
  
  logger.info('Espacio actualizado', { espacioId });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, espacio_id: espacioId, nombre: body.nombre.trim() })
  };
};

module.exports.handler = createAPIHandler(updateSpace, { rateLimit: { maxRequests: 40, windowSeconds: 60 } });
