// handlers/websocket/streamProcessor.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const Logger = require('../../utils/logger');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

/**
 * Procesa eventos de DynamoDB Stream y notifica a clientes WebSocket
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'streamProcessor' });
  logger.info('Procesando stream events', { recordCount: event.Records.length });

  for (const record of event.Records) {
    try {
      let appointmentData;
      let eventType = record.eventName;

      if (record.eventName === 'REMOVE') {
        appointmentData = unmarshall(record.dynamodb.OldImage);
      } else {
        appointmentData = unmarshall(record.dynamodb.NewImage);
      }

      const grupoId = appointmentData.grupo_id || appointmentData.PK;
      logger.info(`Evento ${eventType} para grupo ${grupoId}`);

      const connections = await getConnectionsByGroup(grupoId, logger);
      logger.info(`${connections.length} conexiones activas para el grupo`);

      const message = JSON.stringify({
        type: eventType,
        data: appointmentData
      });

      await Promise.all(
        connections.map(conn => sendMessageToConnection(conn.connectionId, message, logger))
      );

    } catch (error) {
      logger.error('Error procesando record', error);
    }
  }

  return { statusCode: 200 };
};

async function getConnectionsByGroup(grupoId, logger) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'GrupoIndex',
      KeyConditionExpression: 'grupo_id = :grupoId',
      ExpressionAttributeValues: { ':grupoId': grupoId }
    }));
    return result.Items || [];
  } catch (error) {
    logger.error('Error obteniendo conexiones', error, { grupoId });
    return [];
  }
}

async function sendMessageToConnection(connectionId, message, logger) {
  const apiGateway = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

  try {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(message)
    }));
    logger.info('Mensaje enviado', { connectionId });
  } catch (error) {
    if (error.statusCode === 410) {
      logger.warn('Conexión obsoleta', { connectionId });
    } else {
      logger.error('Error enviando mensaje', error, { connectionId });
    }
  }
}
