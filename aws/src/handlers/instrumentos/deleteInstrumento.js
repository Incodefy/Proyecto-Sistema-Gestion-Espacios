// aws/src/handlers/instrumentos/deleteInstrumento.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyInstrumentoEliminado } = require("../../utils/notificationHelper");

const deleteInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteInstrumento' });
  const grupo_id = event.pathParameters?.grupo_id;
  const instrumentoId = event.pathParameters?.id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('deleteInstrumento', { grupo_id, id: instrumentoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` }
    })),
    { operation: 'getInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Instrumento no encontrado');
  
  const instrumentoNombre = getResult.Item.nombre;
  let tipoNombre = 'Sin tipo';
  
  // Obtener nombre del tipo
  if (getResult.Item.tipo_instrumento_id) {
    try {
      const tipoResult = await retryDB(
        () => db.send(new GetCommand({
          TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
          Key: { PK: grupo_id, SK: getResult.Item.tipo_instrumento_id }
        })),
        { operation: 'getTipoInstrumento' }
      );
      if (tipoResult.Item) {
        tipoNombre = tipoResult.Item.nombre;
      }
    } catch (err) {
      logger.warn('Could not fetch tipo name', err);
    }
  }
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` }
    })),
    { operation: 'deleteInstrumento' }
  );
  
  logger.info('Instrumento eliminado', { instrumentoId });
  
  // Enviar notificación
  try {
    const membersResult = await retryDB(
      () => db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupo_id }
      })),
      { operation: 'getGroupMembers' }
    );

    const userSubs = (membersResult.Items || []).map(m => m.user_sub);

    if (userSubs.length > 0) {
      await notifyInstrumentoEliminado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        instrumentoNombre,
        tipoNombre
      });
      logger.info('Notification sent for instrumento deletion');
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for instrumento deletion', notifError);
  }
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Instrumento eliminado correctamente" }) };
};

module.exports.handler = createAPIHandler(deleteInstrumento, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });
