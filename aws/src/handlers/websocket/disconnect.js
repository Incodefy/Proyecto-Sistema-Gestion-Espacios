// handlers/websocket/disconnect.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { Logger } = require('../../utils/logger');
const { retryDB } = require('../../utils/retry');
const { getSecurityHeaders } = require('../../middleware/securityHeaders');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

/**
 * Handler para $disconnect de WebSocket
 * Elimina el connectionId de DynamoDB
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'wsDisconnect' });
  const connectionId = event.requestContext?.connectionId;
  
  logger.info('Desconectando WebSocket', { connectionId });

  try {
    await retryDB(
      () => docClient.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
      })),
      { operation: 'wsDisconnect', connectionId }
    );

    logger.info('Conexión eliminada exitosamente', { connectionId });

    return {
      statusCode: 200,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ message: 'Desconectado' })
    };
  } catch (error) {
    logger.error('Error en disconnect', error, { connectionId });
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ error: 'Error al desconectar' })
    };
  }
};
