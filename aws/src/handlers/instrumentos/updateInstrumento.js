// aws/src/handlers/instrumentos/updateInstrumento.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { NotFoundError } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");
const { notifyInstrumentoModificado } = require("../../utils/notificationHelper");

const updateInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  const instrumentoId = event.pathParameters?.id;
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  validate('updateInstrumento', { ...body, grupo_id, id: instrumentoId });
  
  const getResult = await retryDB(
    () => db.send(new GetCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` }
    })),
    { operation: 'getInstrumento' }
  );
  
  if (!getResult.Item) throw new NotFoundError('Instrumento no encontrado');
  
  const oldItem = getResult.Item;
  const cambios = {};
  
  if (oldItem.nombre !== body.nombre.trim()) {
    cambios.nombre = { old: oldItem.nombre, new: body.nombre.trim() };
  }
  
  // Obtener nombres de tipos para la notificación
  let tipoNombreNuevo = 'Sin tipo';
  let tipoNombreAnterior = 'Sin tipo';
  
  if (body.tipo_instrumento_id) {
    const nuevoTipoId = `TIPO_INST#${body.tipo_instrumento_id}`;
    if (oldItem.tipo_instrumento_id !== nuevoTipoId) {
      try {
        const [tipoAnterior, tipoNuevo] = await Promise.all([
          retryDB(() => db.send(new GetCommand({
            TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
            Key: { PK: grupo_id, SK: oldItem.tipo_instrumento_id }
          }))),
          retryDB(() => db.send(new GetCommand({
            TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
            Key: { PK: grupo_id, SK: nuevoTipoId }
          })))
        ]);
        
        tipoNombreAnterior = tipoAnterior.Item?.nombre || 'Sin tipo';
        tipoNombreNuevo = tipoNuevo.Item?.nombre || 'Sin tipo';
        
        cambios.tipo = { old: tipoNombreAnterior, new: tipoNombreNuevo };
      } catch (err) {
        logger.warn('Could not fetch tipo names', err);
      }
    }
  }
  
  const now = new Date().toISOString();
  let updateExpression = "SET nombre = :nombre, updated_at = :updated";
  let expressionValues = { ":nombre": body.nombre.trim(), ":updated": now };
  
  if (body.tipo_instrumento_id) {
    updateExpression += ", tipo_instrumento_id = :tipo";
    expressionValues[":tipo"] = `TIPO_INST#${body.tipo_instrumento_id}`;
  }
  
  await retryDB(
    () => db.send(new UpdateCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Key: { PK: grupo_id, SK: `INST#${instrumentoId}` },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues
    })),
    { operation: 'updateInstrumento' }
  );
  
  logger.info('Instrumento actualizado', { instrumentoId });
  
  // Enviar notificación solo si hubo cambios
  if (Object.keys(cambios).length > 0) {
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
        await notifyInstrumentoModificado({
          userSubs,
          grupoId: grupo_id,
          createdBy: userSub,
          instrumentoNombre: body.nombre.trim(),
          tipoNombre: tipoNombreNuevo,
          cambios
        });
        logger.info('Notification sent for instrumento update', { cambios });
      }
    } catch (notifError) {
      logger.warn('Failed to send notification for instrumento update', notifError);
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, instrumento: { id: instrumentoId, nombre: body.nombre.trim(), tipo_instrumento_id: body.tipo_instrumento_id, grupo_id, updated_at: now } })
  };
};

module.exports.handler = createAPIHandler(updateInstrumento, { rateLimit: { maxRequests: 40, windowSeconds: 60 } });
