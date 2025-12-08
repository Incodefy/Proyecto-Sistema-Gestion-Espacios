// aws/src/handlers/groups/updateSpace.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyEspacioModificado } = require("../../utils/notificationHelper");

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
      UpdateExpression: "SET nombre = :nombre, updated_at = :now",
      ExpressionAttributeValues: {
        ":nombre": body.nombre.trim(),
        ":now": timestamp
      }
    })),
    { operation: 'updateSpace' }
  );
  
  logger.info('Espacio actualizado', { espacioId });
  
  // Notificar a los miembros del grupo
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
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
      // Detectar cambios
      const cambios = {};
      if (getResult.Item.nombre !== body.nombre.trim()) {
        cambios.nombre = {
          old: getResult.Item.nombre,
          new: body.nombre.trim()
        };
      }
      
      await notifyEspacioModificado({
        userSubs,
        grupoId,
        createdBy: userSub,
        espacioId,
        espacioNombre: body.nombre.trim(),
        espacioTipo: getResult.Item.tipo || 'GENERAL',
        cambios
      });
      logger.info('Notificaciones de espacio modificado enviadas', { recipients: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Error enviando notificaciones', { error: notifError.message });
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, espacio_id: espacioId, nombre: body.nombre.trim() })
  };
};

module.exports.handler = createAPIHandler(updateSpace, { rateLimit: { maxRequests: 40, windowSeconds: 60 } });
