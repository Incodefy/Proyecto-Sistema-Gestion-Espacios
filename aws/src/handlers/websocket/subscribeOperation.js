// handlers/websocket/subscribeOperation.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { Logger } = require('../../utils/logger');
const { retryDB } = require('../../utils/retry');
const { getSecurityHeaders } = require('../../middleware/securityHeaders');
const { getOperationStore } = require('../../utils/operationStore');
const { validate } = require('../../utils/validator');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

/**
 * Handler para suscribirse a notificaciones de operaciones asíncronas
 * 
 * Mensaje esperado:
 * {
 *   "action": "subscribeOperation",
 *   "operationId": "uuid-de-la-operacion",
 *   "userId": "user-sub-from-jwt" (opcional, se validará)
 * }
 * 
 * Funcionalidad:
 * 1. Valida que la operación existe
 * 2. Valida que el usuario tiene acceso a la operación
 * 3. Almacena la suscripción en CONNECTIONS_TABLE
 * 4. Si la operación ya está completa/fallida, envía el estado inmediatamente
 * 
 * Beneficios sobre polling:
 * - Notificación instantánea cuando la operación cambia de estado
 * - Reduce carga del servidor (no hay polling constante)
 * - Mejor experiencia de usuario (feedback inmediato)
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'wsSubscribeOperation' });
  
  try {
    const connectionId = event.requestContext?.connectionId;
    const body = JSON.parse(event.body || '{}');
    const { operationId, userId } = body;

    logger.info('Suscripción a operación solicitada', { connectionId, operationId, userId });

    // ✅ VALIDACIÓN AJV
    const validationResult = validate('wsSubscribeOperation', { operationId, userId }, logger);
    if (!validationResult.valid) {
      logger.warn('Validación fallida', { errors: validationResult.errors });
      return buildResponse(400, { error: validationResult.errors });
    }

    // Obtener la operación para validar existencia y ownership
    const operationStore = getOperationStore(logger);
    const operation = await operationStore.getOperation(operationId);

    if (!operation) {
      logger.warn('Operación no encontrada', { operationId });
      return buildResponse(404, { error: 'Operación no encontrada o expirada' });
    }

    // Validar ownership (si se provee userId)
    if (userId && operation.userId !== userId) {
      logger.warn('Usuario no autorizado para la operación', { operationId, userId, ownerId: operation.userId });
      return buildResponse(403, { error: 'No autorizado para esta operación' });
    }

    // Actualizar la conexión con la suscripción a la operación
    await retryDB(
      () => docClient.send(new UpdateCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId },
        UpdateExpression: 'SET subscribedOperations = list_append(if_not_exists(subscribedOperations, :empty), :operationId), lastActivity = :now',
        ExpressionAttributeValues: {
          ':operationId': [operationId],
          ':empty': [],
          ':now': new Date().toISOString()
        }
      })),
      { operation: 'subscribeOperation', connectionId, operationId }
    );

    logger.info('Suscripción guardada exitosamente', { connectionId, operationId });

    // Si la operación ya está completa o fallida, enviar estado inmediatamente
    const response = {
      type: 'SUBSCRIPTION_CONFIRMED',
      operationId,
      currentStatus: operation.status,
      message: 'Suscripción exitosa'
    };

    if (operation.status === 'COMPLETED' || operation.status === 'FAILED') {
      response.finalState = {
        status: operation.status,
        result: operation.result,
        error: operation.error,
        updatedAt: operation.updatedAt
      };
      response.message = 'Suscripción exitosa (operación ya finalizada)';
    }

    return buildResponse(200, response);

  } catch (error) {
    logger.error('Error en subscribeOperation', error);
    return buildResponse(500, { 
      error: 'Error al suscribirse a la operación',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Construye respuesta HTTP para WebSocket
 */
function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: getSecurityHeaders(),
    body: JSON.stringify(body)
  };
}
