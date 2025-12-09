// aws/src/handlers/instrumentos/createInstrumento.js
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyInstrumentoCreado } = require("../../utils/notificationHelper");

const createInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('createInstrumento', { ...body, grupo_id });
  
  const instrumentoId = crypto.randomUUID().substring(0, 8);
  const now = new Date().toISOString();
  
  // Obtener nombre del tipo de instrumento
  let tipoNombre = 'Sin tipo';
  try {
    const tipoResult = await retryDB(
      () => db.send(new GetCommand({
        TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
        Key: { PK: grupo_id, SK: `TIPO_INST#${body.tipo_instrumento_id}` }
      })),
      { operation: 'getTipoInstrumento' }
    );
    if (tipoResult.Item) {
      tipoNombre = tipoResult.Item.nombre;
    }
  } catch (err) {
    logger.warn('Could not fetch tipo instrumento name', err);
  }
  
  await retryDB(
    () => db.send(new PutCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Item: {
        PK: grupo_id,
        SK: `INST#${instrumentoId}`,
        nombre: body.nombre.trim(),
        tipo_instrumento_id: `TIPO_INST#${body.tipo_instrumento_id}`,
        created_at: now,
        updated_at: now,
        created_by: userSub
      }
    })),
    { operation: 'createInstrumento' }
  );
  
  logger.info('Instrumento creado', { instrumentoId });
  
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
      await notifyInstrumentoCreado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        instrumentoNombre: body.nombre.trim(),
        tipoNombre
      });
      logger.info('Notification sent for instrumento creation');
    }
  } catch (notifError) {
    logger.warn('Failed to send notification for instrumento creation', notifError);
  }
  
  return {
    statusCode: 201,
    body: JSON.stringify({ ok: true, instrumento: { id: instrumentoId, nombre: body.nombre.trim(), tipo_instrumento_id: body.tipo_instrumento_id, grupo_id, created_at: now } })
  };
};

module.exports.handler = createAPIHandler(createInstrumento, { rateLimit: { maxRequests: 25, windowSeconds: 60 } });
