// aws/src/handlers/tipos-instrumentos/createTipoInstrumento.js
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyTipoInstrumentoCreado } = require("../../utils/notificationHelper");

const createTipoInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createTipoInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('createTipoInstrumento', { ...body, grupo_id });
  
  const tipoId = crypto.randomUUID().substring(0, 8);
  const now = new Date().toISOString();
  
  await retryDB(
    () => db.send(new PutCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Item: {
        PK: grupo_id,
        SK: `TIPO_INST#${tipoId}`,
        nombre: body.nombre.trim(),
        created_at: now,
        updated_at: now,
        created_by: userSub
      }
    })),
    { operation: 'createTipoInstrumento' }
  );
  
  logger.info('Tipo de instrumento creado', { tipoId });
  
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
      await notifyTipoInstrumentoCreado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        tipoNombre: body.nombre.trim()
      });
      logger.info('Notification sent for tipo instrumento creation');
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for tipo instrumento creation', notifError);
  }
  
  return {
    statusCode: 201,
    body: JSON.stringify({ ok: true, tipo: { id: tipoId, nombre: body.nombre.trim(), grupo_id, created_at: now } })
  };
};

module.exports.handler = createAPIHandler(createTipoInstrumento, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });
