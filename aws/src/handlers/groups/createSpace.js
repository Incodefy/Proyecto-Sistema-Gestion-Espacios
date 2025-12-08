const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyEspacioCreado } = require('../../utils/notificationHelper');
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { ValidationError, ConflictError } = require("../../utils/errorHandler");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const createSpace = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createSpace' });
  
  const body = JSON.parse(event.body || "{}");
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  const userEmail = event.requestContext.authorizer.jwt.claims.email;
  
  validate('createSpace', body);
  
  const { grupo_id, nombre, tipo, pertenece_a } = body;
  
  logger.info('Creando espacio', { grupo_id, nombre, tipo });
  
  if (tipo === 'especifico' && !pertenece_a) {
    throw new ValidationError("Los espacios específicos deben tener 'pertenece_a'");
  }
  
  const timestamp = new Date().toISOString();
  
  const queryResult = await retryDB(
    () => db.send(new QueryCommand({
      TableName: process.env.SPACES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': grupo_id }
    })),
    { operation: 'listSpaces' }
  );
  
  const existingSpaces = queryResult.Items || [];
  let nextId;
  
  if (tipo === 'general') {
    const generalSpaces = existingSpaces.filter(s => s.SK?.startsWith('SPACE#'));
    const maxIdx = generalSpaces.reduce((max, s) => {
      const num = parseInt(s.SK.split('#')[1]);
      return num > max ? num : max;
    }, 0);
    nextId = `SPACE#${maxIdx + 1}`;
  } else {
    const specificSpaces = existingSpaces.filter(s => s.SK?.startsWith('SUBSPACE#'));
    const maxIdx = specificSpaces.reduce((max, s) => {
      const num = parseInt(s.SK.split('#')[1]);
      return num > max ? num : max;
    }, 0);
    nextId = `SUBSPACE#${maxIdx + 1}`;
  }
  
  logger.info('Asignando ID de espacio', { espacioId: nextId });
  
  const item = {
    PK: grupo_id,
    SK: nextId,
    tipo: tipo,
    nombre: nombre.trim(),
    created_at: timestamp,
    created_by: userEmail || userSub
  };
  
  if (tipo === 'especifico') {
    item.parent = pertenece_a;
  }
  
  await retryDB(
    () => db.send(new PutCommand({
      TableName: process.env.SPACES_TABLE,
      Item: item
    })),
    { operation: 'createSpace' }
  );
  
  logger.info('Espacio creado exitosamente', { espacioId: nextId });
  
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
      await notifyEspacioCreado({
        userSubs,
        grupoId: grupo_id,
        createdBy: userSub,
        espacioId: nextId,
        espacioNombre: nombre.trim(),
        espacioTipo: tipo
      });
      logger.info('Notificaciones enviadas', { count: userSubs.length });
    }
  } catch (notifError) {
    logger.warn('Error enviando notificaciones', { error: notifError.message });
  }
  
  return {
    statusCode: 201,
    body: JSON.stringify({ 
      ok: true,
      espacio_id: nextId,
      grupo_id,
      nombre: nombre.trim(),
      tipo,
      pertenece_a: pertenece_a || null
    })
  };
};

module.exports.handler = createAPIHandler(createSpace, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });
