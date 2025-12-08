const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { Logger } = require('../../utils/logger');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'groupMembersStreamProcessor' });
  logger.info('Procesando eventos de GroupMembers', { recordCount: event.Records.length });

  if (!CONNECTIONS_TABLE || !WS_ENDPOINT) {
    logger.error('Variables de entorno faltantes');
    return { statusCode: 500, body: 'Configuration error' };
  }

  const apiGateway = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

  for (const record of event.Records) {
    const eventName = record.eventName;
    logger.info('Evento recibido', { eventName });

    if (!['INSERT', 'MODIFY', 'REMOVE'].includes(eventName)) continue;

    const newImage = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
    const oldImage = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
    const memberData = newImage || oldImage;

    if (!memberData) {
      logger.warn('Sin datos en el record');
      continue;
    }

    const grupo_id = memberData.group_id;
    if (!grupo_id) {
      logger.warn('No se encontró grupo_id');
      continue;
    }

    logger.info('Procesando grupo', { grupo_id });

    let messageType, messageData;

    if (eventName === 'INSERT') {
      messageType = 'MEMBER_ADDED';
      messageData = {
        email: memberData.user_email,
        nombre: memberData.user_name || memberData.user_email?.split('@')[0],
        rol: memberData.role,
        user_sub: memberData.user_sub
      };
    } else if (eventName === 'MODIFY') {
      const roleChanged = oldImage.role !== newImage.role;
      if (roleChanged) {
        messageType = 'ROLE_CHANGED';
        messageData = {
          email: newImage.user_email,
          nombre: newImage.user_name || newImage.user_email?.split('@')[0],
          oldRole: oldImage.role,
          newRole: newImage.role,
          user_sub: newImage.user_sub
        };
      } else {
        messageType = 'MEMBER_MODIFIED';
        messageData = {
          email: newImage.user_email,
          nombre: newImage.user_name || newImage.user_email?.split('@')[0],
          rol: newImage.role,
          user_sub: newImage.user_sub,
          changes: getChanges(oldImage, newImage)
        };
      }
    } else if (eventName === 'REMOVE') {
      messageType = 'MEMBER_REMOVED';
      messageData = {
        email: oldImage.user_email,
        nombre: oldImage.user_name || oldImage.user_email?.split('@')[0],
        rol: oldImage.role,
        user_sub: oldImage.user_sub
      };
    }

    try {
      const { Items: connections } = await dynamodb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'GrupoIndex',
        KeyConditionExpression: 'grupo_id = :grupo_id',
        ExpressionAttributeValues: { ':grupo_id': grupo_id }
      }));

      logger.info(`Enviando a ${connections?.length || 0} conexiones`);

      await Promise.all((connections || []).map(async (conn) => {
        try {
          await apiGateway.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: JSON.stringify({ type: messageType, data: messageData })
          }));
          logger.info('Mensaje enviado', { connectionId: conn.connectionId });
        } catch (err) {
          if (err.statusCode === 410) {
            logger.warn('Conexión obsoleta', { connectionId: conn.connectionId });
          } else {
            logger.error('Error enviando mensaje', err, { connectionId: conn.connectionId });
          }
        }
      }));
    } catch (error) {
      logger.error('Error consultando conexiones', error);
    }
  }

  return { statusCode: 200, body: 'OK' };
};

function getChanges(oldImage, newImage) {
  if (!oldImage || !newImage) return {};
  const changes = {};
  const fields = ['user_name', 'role', 'joined_at'];
  for (const field of fields) {
    if (oldImage[field] !== newImage[field]) {
      changes[field] = { old: oldImage[field], new: newImage[field] };
    }
  }
  return changes;
}
