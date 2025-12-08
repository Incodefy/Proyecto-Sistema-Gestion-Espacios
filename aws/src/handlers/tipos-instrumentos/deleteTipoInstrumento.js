// aws/src/handlers/tipos-instrumentos/deleteTipoInstrumento.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyTipoInstrumentoEliminado } = require("../../utils/notificationHelper");

const deleteTipoInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteTipoInstrumento' });
  const grupo_id = event.pathParameters?.grupo_id;
  const tipoId = event.pathParameters?.id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('deleteTipoInstrumento', { grupo_id, id: tipoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `TIPO_INST#${tipoId}` }
    })),
    { operation: 'getTipoInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Tipo de instrumento no encontrado');
  
  const tipoNombre = getResult.Item.nombre;
  
  // Contar instrumentos asociados
  let instrumentosAfectados = 0;
  try {
    const instrumentosResult = await retryDB(
      () => db.send(new QueryCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'tipo_instrumento_id = :tipo',
        ExpressionAttributeValues: {
          ':pk': grupo_id,
          ':tipo': `TIPO_INST#${tipoId}`
        }
      })),
      { operation: 'countInstrumentos' }
    );
    instrumentosAfectados = (instrumentosResult.Items || []).length;
  } catch (err) {
    logger.warn('Could not count instrumentos', err);
  }
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `TIPO_INST#${tipoId}` }
    })),
    { operation: 'deleteTipoInstrumento' }
  );
  
  logger.info('Tipo de instrumento eliminado', { tipoId, instrumentosAfectados });
  
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
      await notifyTipoInstrumentoEliminado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        tipoNombre,
        instrumentosAfectados
      });
      logger.info('Notification sent for tipo instrumento deletion');
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for tipo instrumento deletion', notifError);
  }
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Tipo de instrumento eliminado correctamente" }) };
};

module.exports.handler = createAPIHandler(deleteTipoInstrumento, { rateLimit: { maxRequests: 15, windowSeconds: 60 } });
