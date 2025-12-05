// aws/src/handlers/groups/deleteSpace.js
const { DynamoDBDocumentClient, DeleteCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyEspacioEliminado } = require('../../utils/notificationHelper');
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError, ValidationError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

const deleteSpace = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteSpace' });
  const espacioId = event.pathParameters?.id;
  const grupoId = event.queryStringParameters?.grupo_id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('deleteSpace', { grupo_id: grupoId, id: espacioId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { PK: grupoId, SK: espacioId }
    })),
    { operation: 'getSpace' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Espacio no encontrado');
  
  if (espacioId.startsWith('SPACE#')) {
    const queryResult = await retryDB(
      () => db.send(new QueryCommand({
        TableName: process.env.SPACES_TABLE,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'parent = :parent',
        ExpressionAttributeValues: { ':pk': grupoId, ':parent': espacioId },
        Limit: 1
      })),
      { operation: 'checkSubSpaces' }
    );
    
    if (queryResult.Items && queryResult.Items.length > 0) {
      throw new ValidationError('No se puede eliminar un espacio que tiene sub-espacios. Elimina los sub-espacios primero.');
    }
  }
  
  const espacioNombre = getResult.Item.nombre;
  const espacioTipo = getResult.Item.tipo;
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { PK: grupoId, SK: espacioId }
    })),
    { operation: 'deleteSpace' }
  );
  
  logger.info('Espacio eliminado', { espacioId });
  
  try {
    const membersResult = await retryDB(
      () => db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupoId }
      })),
      { operation: 'getGroupMembers' }
    );
    
    const userSubs = (membersResult.Items || []).map(m => m.user_sub);
    
    if (userSubs.length > 0) {
      await notifyEspacioEliminado({
        userSubs,
        grupoId,
        createdBy: userSub,
        espacioId,
        espacioNombre,
        espacioTipo
      });
      logger.info('Notificaciones enviadas', { count: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Error enviando notificaciones', { error: notifError.message });
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: 'Espacio eliminado correctamente' })
  };
};

module.exports.handler = createAPIHandler(deleteSpace, { rateLimit: { maxRequests: 15, windowSeconds: 60 } });
