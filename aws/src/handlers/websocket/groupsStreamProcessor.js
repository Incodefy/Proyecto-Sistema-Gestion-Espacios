const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { Logger } = require('../../utils/logger');

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

/**
 * Procesa eventos de DynamoDB Streams de la tabla GROUPS
 * Detecta cambios en nomenclatura y envía notificaciones WebSocket
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'groupsStreamProcessor' });
  logger.info('Procesando eventos de Groups', { recordCount: event.Records.length });

  if (!CONNECTIONS_TABLE || !WS_ENDPOINT) {
    logger.error('Variables de entorno faltantes');
    return { statusCode: 500, body: 'Configuration error' };
  }

  const apiGateway = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

  for (const record of event.Records) {
    const eventName = record.eventName;
    logger.info('Evento recibido', { eventName });

    // Solo procesar MODIFY (cambios en grupos existentes)
    if (eventName !== 'MODIFY') continue;

    const newImage = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
    const oldImage = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;

    if (!newImage || !oldImage) {
      logger.warn('Sin datos en el record');
      continue;
    }

    const group_id = newImage.group_id;
    if (!group_id) {
      logger.warn('No se encontró group_id');
      continue;
    }

    // Detectar si hubo cambios en la nomenclatura
    const oldNomenclatura = oldImage.nomenclatura || {};
    const newNomenclatura = newImage.nomenclatura || {};

    const cambiosNomenclatura = detectarCambiosNomenclatura(oldNomenclatura, newNomenclatura);

    if (cambiosNomenclatura.length === 0) {
      logger.info('No hay cambios en nomenclatura, ignorando', { group_id });
      continue;
    }

    logger.info('Cambios detectados en nomenclatura', { 
      group_id, 
      cambiosCount: cambiosNomenclatura.length 
    });

    // Preparar mensaje WebSocket
    const messageData = {
      grupo_id: group_id,
      grupo_nombre: newImage.nombre || 'el grupo',
      cambios: cambiosNomenclatura,
      timestamp: new Date().toISOString()
    };

    // Enviar a todas las conexiones WebSocket del grupo
    try {
      const { Items: connections } = await dynamodb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'GrupoIndex',
        KeyConditionExpression: 'grupo_id = :grupo_id',
        ExpressionAttributeValues: { ':grupo_id': group_id }
      }));

      logger.info(`Enviando a ${connections?.length || 0} conexiones`, { group_id });

      await Promise.all((connections || []).map(async (conn) => {
        try {
          await apiGateway.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: JSON.stringify({ 
              type: 'NOMENCLATURA_ACTUALIZADA', 
              data: messageData 
            })
          }));
          logger.info('Mensaje enviado', { connectionId: conn.connectionId });
        } catch (err) {
          if (err.statusCode === 410) {
            logger.warn('Conexión obsoleta', { connectionId: conn.connectionId });
            // TODO: Eliminar conexión obsoleta de la tabla
          } else {
            logger.error('Error enviando mensaje', err, { connectionId: conn.connectionId });
          }
        }
      }));

      logger.info('Notificaciones WebSocket enviadas exitosamente', { 
        group_id, 
        connectionCount: connections?.length || 0 
      });
    } catch (error) {
      logger.error('Error consultando conexiones o enviando mensajes', error);
    }
  }

  return { statusCode: 200, body: 'OK' };
};

/**
 * Detecta cambios entre dos objetos de nomenclatura
 * @param {Object} oldNom - Nomenclatura anterior
 * @param {Object} newNom - Nomenclatura nueva
 * @returns {Array} Array de cambios { campo, valor_anterior, valor_nuevo }
 */
function detectarCambiosNomenclatura(oldNom, newNom) {
  const campos = ['general', 'especifico', 'ocupante', 'especialidad', 'instrumento'];
  const cambios = [];

  for (const campo of campos) {
    const oldVal = oldNom[campo] || '';
    const newVal = newNom[campo] || '';

    if (oldVal !== newVal) {
      cambios.push({
        campo,
        valor_anterior: oldVal,
        valor_nuevo: newVal
      });
    }
  }

  return cambios;
}
