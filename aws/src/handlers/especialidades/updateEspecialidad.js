// aws/src/handlers/especialidades/updateEspecialidad.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { NotFoundError } = require("../../utils/errorHandler");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyEspecialidadModificada } = require("../../utils/notificationHelper");

const updateEspecialidad = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateEspecialidad' });
  
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const especialidadId = event.pathParameters?.id;
  
  validate('updateEspecialidad', body);
  
  logger.info('Actualizando especialidad', { grupo_id, especialidadId });
  
  // Verificar existencia
  const getResult = await retryDB(
    () => db.send(
      new GetCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        }
      })
    ),
    { operation: 'getEspecialidad' }
  );
  
  if (!getResult.Item) {
    throw new NotFoundError('Especialidad no encontrada');
  }
  
  const nombreAnterior = getResult.Item.nombre;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  const now = new Date().toISOString();
  
  await retryDB(
    () => db.send(
      new UpdateCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        },
        UpdateExpression: "SET nombre = :nombre, updated_at = :updated",
        ExpressionAttributeValues: {
          ":nombre": body.nombre.trim(),
          ":updated": now
        }
      })
    ),
    { operation: 'updateEspecialidad' }
  );
  
  logger.info('Especialidad actualizada exitosamente', { especialidadId });
  
  // Enviar notificación solo si el nombre cambió
  if (nombreAnterior !== body.nombre.trim()) {
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
        await notifyEspecialidadModificada({
          userSubs,
          grupoId: grupo_id,
          createdBy: userSub,
          especialidadNombre: body.nombre.trim(),
          nombreAnterior,
          tipoEspecialidad: 'Especialidad'
        });
        logger.info('Notification sent for especialidad update');
      }
    } catch (notifError) {
      logger.warn('Failed to send notification for especialidad update', notifError);
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      ok: true,
      especialidad: {
        id: especialidadId,
        nombre: body.nombre.trim(),
        grupo_id,
        updated_at: now
      }
    })
  };
};

module.exports.handler = createAPIHandler(updateEspecialidad, {
  rateLimit: { maxRequests: 40, windowSeconds: 60 }
});
