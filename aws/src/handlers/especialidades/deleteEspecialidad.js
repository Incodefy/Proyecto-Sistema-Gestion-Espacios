// aws/src/handlers/especialidades/deleteEspecialidad.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyEspecialidadEliminada } = require("../../utils/notificationHelper");

const deleteEspecialidad = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteEspecialidad' });
  const grupo_id = event.pathParameters?.grupo_id;
  const especialidadId = event.pathParameters?.id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('deleteEspecialidad', { grupo_id, id: especialidadId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.ESPECIALIDADES_TABLE,
      Key: { PK: grupo_id, SK: `ESP#${especialidadId}` }
    })),
    { operation: 'getEspecialidad' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Especialidad no encontrada');
  
  const especialidadNombre = getResult.Item.nombre;
  
  await retryDB(
    () => db.send(new DeleteCommand({
      TableName: process.env.ESPECIALIDADES_TABLE,
      Key: { PK: grupo_id, SK: `ESP#${especialidadId}` }
    })),
    { operation: 'deleteEspecialidad' }
  );
  
  logger.info('Especialidad eliminada', { especialidadId });
  
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
      await notifyEspecialidadEliminada({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        especialidadNombre,
        tipoEspecialidad: 'Especialidad'
      });
      logger.info('Notification sent for especialidad deletion');
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for especialidad deletion', notifError);
  }
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Especialidad eliminada exitosamente" }) };
};

module.exports.handler = createAPIHandler(deleteEspecialidad, { rateLimit: { maxRequests: 15, windowSeconds: 60 } });
