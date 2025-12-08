const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { notifyEspacioCreado, notifyEspacioModificado, notifyEspacioEliminado } = require("../../utils/notificationHelper");
const { Logger } = require('../../utils/logger');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'spacesStreamProcessor' });
  logger.info('Procesando eventos de Spaces', { recordCount: event.Records.length });

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
    const spaceData = newImage || oldImage;

    if (!spaceData) {
      logger.warn('Sin datos en el record');
      continue;
    }

    const grupo_id = spaceData.PK?.replace('GROUP#', '');
    if (!grupo_id) {
      logger.warn('No se encontró grupo_id');
      continue;
    }

    logger.info('Procesando espacio', { grupo_id });

    let messageType, messageData;
    const isGeneralSpace = spaceData.SK?.startsWith('GENERALSPACE#');
    const spaceType = isGeneralSpace ? 'general' : 'específico';

    if (eventName === 'INSERT') {
      messageType = 'SPACE_CREATED';
      messageData = { type: spaceType, nombre: spaceData.nombre, id: spaceData.SK };
    } else if (eventName === 'MODIFY') {
      messageType = 'SPACE_MODIFIED';
      messageData = {
        type: spaceType,
        nombre: spaceData.nombre,
        id: spaceData.SK,
        changes: getChanges(oldImage, newImage)
      };
    } else if (eventName === 'REMOVE') {
      messageType = 'SPACE_DELETED';
      messageData = { type: spaceType, nombre: oldImage.nombre, id: oldImage.SK };
    }

    let groupMembers = [];
    try {
      const { Items: members } = await dynamodb.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :group_id',
        ExpressionAttributeValues: { ':group_id': grupo_id }
      }));
      groupMembers = members || [];
      logger.info(`${groupMembers.length} miembros encontrados para notificar`);
    } catch (error) {
      logger.error('Error obteniendo miembros del grupo', error);
    }

    if (groupMembers.length > 0) {
      const userSubs = groupMembers.map(m => m.user_sub).filter(Boolean);
      const createdBy = spaceData.created_by || 'system';
      try {
        if (eventName === 'INSERT') {
          await notifyEspacioCreado({
            userSubs, grupoId: grupo_id, createdBy,
            espacioId: spaceData.SK, espacioNombre: spaceData.nombre, espacioTipo: spaceType
          });
          logger.info('Notificaciones de espacio creado guardadas');
        } else if (eventName === 'MODIFY') {
          const changes = getChanges(oldImage, newImage);
          if (Object.keys(changes).length > 0) {
            await notifyEspacioModificado({
              userSubs, grupoId: grupo_id, createdBy,
              espacioId: spaceData.SK, espacioNombre: spaceData.nombre, espacioTipo: spaceType,
              cambios: changes
            });
            logger.info('Notificaciones de espacio modificado guardadas');
          }
        } else if (eventName === 'REMOVE') {
          await notifyEspacioEliminado({
            userSubs, grupoId: grupo_id, createdBy: oldImage.created_by || 'system',
            espacioId: oldImage.SK, espacioNombre: oldImage.nombre, espacioTipo: spaceType
          });
          logger.info('Notificaciones de espacio eliminado guardadas');
        }
      } catch (error) {
        logger.error('Error guardando notificaciones', error);
      }
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
  const fields = ['nombre', 'capacidad', 'descripcion', 'estado'];
  
  for (const field of fields) {
    if (oldImage[field] !== newImage[field]) {
      changes[field] = {
        old: oldImage[field],
        new: newImage[field]
      };
    }
  }
  
  return changes;
}
