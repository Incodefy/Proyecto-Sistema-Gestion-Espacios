// handlers/websocket/operationsStreamProcessor.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { Logger } = require('../../utils/logger');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

/**
 * Procesa cambios en OperationsTable (DynamoDB Stream) y notifica a clientes WebSocket suscritos
 * 
 * Flujo:
 * 1. Recibe evento del stream de OperationsTable
 * 2. Extrae operationId y cambios de estado
 * 3. Consulta conexiones WebSocket suscritas a esa operación
 * 4. Envía notificaciones a todas las conexiones activas
 * 5. Limpia conexiones obsoletas (status 410)
 * 
 * Tipos de notificaciones:
 * - OPERATION_UPDATED: Progreso actualizado
 * - OPERATION_COMPLETED: Operación exitosa
 * - OPERATION_FAILED: Operación fallida
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'operationsStreamProcessor' });
  logger.info('Procesando operation stream events', { recordCount: event.Records.length });

  if (!CONNECTIONS_TABLE || !WS_ENDPOINT) {
    logger.error('Configuración incompleta', { CONNECTIONS_TABLE, WS_ENDPOINT });
    return { statusCode: 500 };
  }

  const apiGateway = new ApiGatewayManagementApiClient({ endpoint: WS_ENDPOINT });

  for (const record of event.Records) {
    try {
      let operationData;
      const eventType = record.eventName; // INSERT, MODIFY, REMOVE

      if (record.eventName === 'REMOVE') {
        operationData = unmarshall(record.dynamodb.OldImage);
      } else {
        operationData = unmarshall(record.dynamodb.NewImage);
      }

      const operationId = operationData.operationId;
      if (!operationId) {
        logger.warn('Registro sin operationId', { eventType });
        continue;
      }

      logger.info(`Evento ${eventType} para operación ${operationId}`, { 
        status: operationData.status,
        progress: operationData.progress 
      });

      // Solo notificar cambios relevantes (no INSERT inicial en PENDING)
      if (eventType === 'INSERT' && operationData.status === 'PENDING') {
        logger.info('Ignorando INSERT inicial en PENDING', { operationId });
        continue;
      }

      // Obtener conexiones suscritas a esta operación
      const connections = await getSubscribedConnections(operationId, logger);
      logger.info(`${connections.length} conexiones suscritas a operación ${operationId}`);

      if (connections.length === 0) {
        continue;
      }

      // Construir mensaje según el tipo de evento y estado
      const message = buildNotificationMessage(eventType, operationData);

      // Enviar a todas las conexiones suscritas
      const sendResults = await Promise.allSettled(
        connections.map(conn => sendMessageToConnection(
          apiGateway,
          conn.connectionId,
          message,
          logger
        ))
      );

      // Contar éxitos/fallos
      const successful = sendResults.filter(r => r.status === 'fulfilled').length;
      const failed = sendResults.filter(r => r.status === 'rejected').length;
      logger.info(`Notificaciones enviadas para ${operationId}`, { successful, failed });

    } catch (error) {
      logger.error('Error procesando record', error);
    }
  }

  return { statusCode: 200 };
};

/**
 * Obtiene todas las conexiones WebSocket suscritas a una operación específica
 * 
 * ⚠️ OPTIMIZACIÓN PENDIENTE: Este Scan es ineficiente con muchas conexiones.
 * SOLUCIÓN RECOMENDADA: Crear tabla inversa OperationSubscriptionsTable:
 *   PK: operationId, SK: connectionId
 * Entonces hacer Query directo por operationId en lugar de Scan+FilterExpression
 * Mantener ambas tablas sincronizadas (write to both on subscribe/unsubscribe)
 */
async function getSubscribedConnections(operationId, logger) {
  try {
    // Escanear todas las conexiones que tengan esta operación en subscribedOperations
    // Nota: En producción con muchas conexiones, considerar usar un índice GSI
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    
    const result = await docClient.send(new ScanCommand({
      TableName: CONNECTIONS_TABLE,
      FilterExpression: 'contains(subscribedOperations, :operationId)',
      ExpressionAttributeValues: { ':operationId': operationId }
    }));

    return result.Items || [];
  } catch (error) {
    logger.error('Error obteniendo conexiones suscritas', error, { operationId });
    return [];
  }
}

/**
 * Construye el mensaje de notificación según el evento y estado
 */
function buildNotificationMessage(eventType, operationData) {
  const baseMessage = {
    operationId: operationData.operationId,
    type: operationData.type,
    status: operationData.status,
    progress: operationData.progress,
    updatedAt: operationData.updatedAt
  };

  // Mapear estado a tipo de notificación
  if (operationData.status === 'COMPLETED') {
    return {
      ...baseMessage,
      notificationType: 'OPERATION_COMPLETED',
      result: operationData.result,
      resourceId: operationData.resourceId,
      resourceUrl: operationData.resourceUrl
    };
  }

  if (operationData.status === 'FAILED') {
    return {
      ...baseMessage,
      notificationType: 'OPERATION_FAILED',
      error: operationData.error
    };
  }

  // PROCESSING o cualquier actualización de progreso
  return {
    ...baseMessage,
    notificationType: 'OPERATION_UPDATED'
  };
}

/**
 * Envía mensaje a una conexión WebSocket específica
 */
async function sendMessageToConnection(apiGateway, connectionId, message, logger) {
  try {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(message))
    }));
    logger.info('Mensaje enviado a conexión', { connectionId, type: message.notificationType });
  } catch (error) {
    if (error.statusCode === 410) {
      // Conexión obsoleta (cliente desconectado)
      logger.warn('Conexión obsoleta, eliminando', { connectionId });
      await deleteConnection(connectionId, logger);
    } else {
      logger.error('Error enviando mensaje', error, { connectionId });
      throw error; // Re-throw para Promise.allSettled
    }
  }
}

/**
 * Elimina una conexión obsoleta de la tabla
 */
async function deleteConnection(connectionId, logger) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
    logger.info('Conexión eliminada', { connectionId });
  } catch (error) {
    logger.error('Error eliminando conexión', error, { connectionId });
  }
}
