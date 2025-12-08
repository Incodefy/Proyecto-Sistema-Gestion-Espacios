// aws/src/handlers/especialidades/createEspecialidad.js
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { ValidationError } = require("../../utils/errorHandler");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyEspecialidadCreada } = require("../../utils/notificationHelper");

const createEspecialidad = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createEspecialidad' });
  
  // Validar input
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('createEspecialidad', { ...body, grupo_id });
  
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  const especialidadId = crypto.randomUUID().substring(0, 8);
  const now = new Date().toISOString();
  
  logger.info('Creando especialidad', { 
    grupo_id, 
    especialidadId,
    nombre: body.nombre.trim()
  });
  
  await retryDB(
    () => db.send(
      new PutCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Item: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`,
          nombre: body.nombre.trim(),
          created_at: now,
          updated_at: now,
          created_by: userSub
        }
      })
    ),
    { operation: 'createEspecialidad' }
  );
  
  logger.info('Especialidad creada exitosamente', { especialidadId });
  
  // Enviar notificación a todos los miembros del grupo
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
      await notifyEspecialidadCreada({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        especialidadNombre: body.nombre.trim(),
        tipoEspecialidad: 'Especialidad'
      });
      logger.info('Notification sent for especialidad creation', { userSubs: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for especialidad creation', notifError);
  }
  
  return {
    statusCode: 201,
    body: JSON.stringify({ 
      ok: true,
      especialidad: {
        id: especialidadId,
        nombre: body.nombre.trim(),
        grupo_id,
        created_at: now
      }
    })
  };
};

module.exports.handler = createAPIHandler(createEspecialidad, {
  rateLimit: { maxRequests: 20, windowSeconds: 60 }
});
