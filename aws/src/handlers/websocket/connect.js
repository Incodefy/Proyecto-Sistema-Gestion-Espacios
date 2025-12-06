// handlers/websocket/connect.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const Logger = require('../../utils/logger');
const { retryDB } = require('../../utils/retry');
const { ValidationError } = require('../../utils/errors');
const { getSecurityHeaders } = require('../../middleware/securityHeaders');
const { validate } = require('../../utils/validator');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

/**
 * Handler para $connect de WebSocket
 * Guarda el connectionId en DynamoDB
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'wsConnect' });
  logger.info('Nueva conexión WebSocket', { connectionId: event.requestContext?.connectionId });

  try {
    const connectionId = event.requestContext?.connectionId;
    const queryParams = event.queryStringParameters || {};
    const grupoId = queryParams.grupo_id;

    if (!grupoId) {
      logger.warn('Conexión sin grupo_id');
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ error: 'grupo_id es requerido' })
      };
    }

    // ✅ VALIDACIÓN AJV
    const validationResult = validate('wsConnect', { grupo_id: grupoId, connectionId }, logger);
    if (!validationResult.valid) {
      logger.warn('Validación fallida', { errors: validationResult.errors });
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ error: validationResult.errors })
      };
    }

    await retryDB(
      () => docClient.send(new PutCommand({
        TableName: CONNECTIONS_TABLE,
        Item: {
          connectionId,
          grupo_id: grupoId,
          connected_at: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        }
      })),
      { operation: 'wsConnect', connectionId }
    );

    logger.info('Conexión guardada exitosamente', { connectionId, grupoId });

    return {
      statusCode: 200,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ message: 'Conectado', connectionId })
    };
  } catch (error) {
    logger.error('Error en connect', error);
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ error: 'Error al conectar' })
    };
  }
};
