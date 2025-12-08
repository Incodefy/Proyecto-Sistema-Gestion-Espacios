/**
 * OperationStore - Rastrea estado de operaciones asíncronas
 * 
 * Implementa Async Request-Reply Pattern:
 * - Tracking de operaciones CQRS que retornan 202 Accepted
 * - Status endpoint para polling del cliente
 * - Integración con WebSocket (notificaciones opcionales)
 * 
 * Tabla DynamoDB:
 * PK: OPERATION#<operationId>
 * SK: METADATA
 * GSI1: USER#<userId> / CREATED#<timestamp> (para listar operaciones del usuario)
 * 
 * Atributos:
 * - operationId: UUID
 * - type: CreateAppointment | UpdateAppointment | DeleteAppointment | etc
 * - status: PENDING | PROCESSING | COMPLETED | FAILED
 * - progress: 0-100
 * - result: {...} (si COMPLETED)
 * - error: {...} (si FAILED)
 * - userId: user-sub
 * - correlationId: UUID (para tracing)
 * - resourceId: ID del recurso creado (si aplica)
 * - resourceUrl: URL del recurso (si aplica)
 * - createdAt: ISO timestamp
 * - updatedAt: ISO timestamp
 * - ttl: 7 días (auto-cleanup)
 * - connectionId: WebSocket connectionId (opcional, para notificaciones)
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { retryDB } = require("./retry");
const { Logger } = require("./logger");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const OPERATIONS_TABLE = process.env.OPERATIONS_TABLE || `${process.env.SERVICE_NAME}-${process.env.STAGE}-operations`;

/**
 * Estados de operación
 */
const OperationStatus = {
  PENDING: 'PENDING',       // Operación creada, no iniciada
  PROCESSING: 'PROCESSING', // Operación en proceso
  COMPLETED: 'COMPLETED',   // Operación completada exitosamente
  FAILED: 'FAILED'          // Operación falló
};

/**
 * Clase OperationStore
 */
class OperationStore {
  constructor(logger) {
    this.logger = logger || Logger.create({ handler: 'OperationStore' });
  }

  /**
   * Crear registro de operación
   * 
   * @param {Object} operation - Datos de la operación
   * @param {string} operation.operationId - ID único (UUID)
   * @param {string} operation.type - Tipo de operación (CreateAppointment, etc)
   * @param {string} operation.userId - ID del usuario que inició la operación
   * @param {string} [operation.correlationId] - ID de correlación (opcional)
   * @param {string} [operation.connectionId] - WebSocket connectionId (opcional)
   * @param {Object} [operation.metadata] - Metadatos adicionales (opcional)
   * @returns {Promise<Object>} - Operación creada
   */
  async createOperation(operation) {
    const {
      operationId = crypto.randomUUID(),
      type,
      userId,
      correlationId = crypto.randomUUID(),
      connectionId,
      metadata = {}
    } = operation;

    // Validación
    if (!type || !userId) {
      throw new Error('type and userId are required');
    }

    const timestamp = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 días

    const operationRecord = {
      // Primary Key
      PK: `OPERATION#${operationId}`,
      SK: 'METADATA',
      
      // GSI1 para queries por usuario
      GSI1PK: `USER#${userId}`,
      GSI1SK: `CREATED#${timestamp}`,
      
      // Operation data
      operationId,
      type,
      status: OperationStatus.PENDING,
      progress: 0,
      userId,
      correlationId,
      connectionId,
      metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
      ttl
    };

    this.logger.debug('Creating operation', { operationId, type, userId });

    await retryDB(
      () => docClient.send(new PutCommand({
        TableName: OPERATIONS_TABLE,
        Item: operationRecord
      })),
      { operation: 'createOperation', operationId }
    );

    this.logger.info('Operation created', { operationId, type, status: OperationStatus.PENDING });

    return operationRecord;
  }

  /**
   * Actualizar operación
   * 
   * @param {string} operationId - ID de la operación
   * @param {Object} updates - Campos a actualizar
   * @param {string} [updates.status] - Nuevo status
   * @param {number} [updates.progress] - Progreso (0-100)
   * @param {Object} [updates.result] - Resultado (si COMPLETED)
   * @param {Object} [updates.error] - Error (si FAILED)
   * @param {string} [updates.resourceId] - ID del recurso creado
   * @param {string} [updates.resourceUrl] - URL del recurso
   * @returns {Promise<Object>} - Operación actualizada
   */
  async updateOperation(operationId, updates) {
    if (!operationId) {
      throw new Error('operationId is required');
    }

    const timestamp = new Date().toISOString();
    
    // Construir UpdateExpression dinámicamente
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Siempre actualizar updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = timestamp;

    // Agregar otros campos
    if (updates.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = updates.status;
    }

    if (updates.progress !== undefined) {
      updateExpressions.push('#progress = :progress');
      expressionAttributeNames['#progress'] = 'progress';
      expressionAttributeValues[':progress'] = Math.min(100, Math.max(0, updates.progress));
    }

    if (updates.result !== undefined) {
      updateExpressions.push('#result = :result');
      expressionAttributeNames['#result'] = 'result';
      expressionAttributeValues[':result'] = updates.result;
    }

    if (updates.error !== undefined) {
      updateExpressions.push('#error = :error');
      expressionAttributeNames['#error'] = 'error';
      expressionAttributeValues[':error'] = updates.error;
    }

    if (updates.resourceId !== undefined) {
      updateExpressions.push('#resourceId = :resourceId');
      expressionAttributeNames['#resourceId'] = 'resourceId';
      expressionAttributeValues[':resourceId'] = updates.resourceId;
    }

    if (updates.resourceUrl !== undefined) {
      updateExpressions.push('#resourceUrl = :resourceUrl');
      expressionAttributeNames['#resourceUrl'] = 'resourceUrl';
      expressionAttributeValues[':resourceUrl'] = updates.resourceUrl;
    }

    this.logger.debug('Updating operation', { operationId, updates });

    const response = await retryDB(
      () => docClient.send(new UpdateCommand({
        TableName: OPERATIONS_TABLE,
        Key: {
          PK: `OPERATION#${operationId}`,
          SK: 'METADATA'
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      })),
      { operation: 'updateOperation', operationId }
    );

    this.logger.info('Operation updated', { operationId, status: updates.status });

    return response.Attributes;
  }

  /**
   * Marcar operación como completada
   * 
   * @param {string} operationId - ID de la operación
   * @param {Object} result - Resultado de la operación
   * @param {string} [resourceId] - ID del recurso creado
   * @param {string} [resourceUrl] - URL del recurso
   * @returns {Promise<Object>} - Operación actualizada
   */
  async completeOperation(operationId, result, resourceId = null, resourceUrl = null) {
    this.logger.info('Completing operation', { operationId });

    const updates = {
      status: OperationStatus.COMPLETED,
      progress: 100,
      result,
      resourceId,
      resourceUrl
    };

    const operation = await this.updateOperation(operationId, updates);

    // Si hay connectionId, notificar vía WebSocket
    if (operation.connectionId) {
      await this._notifyViaWebSocket(operation.connectionId, {
        type: 'OPERATION_COMPLETED',
        operationId,
        result,
        resourceId,
        resourceUrl
      });
    }

    return operation;
  }

  /**
   * Marcar operación como fallida
   * 
   * @param {string} operationId - ID de la operación
   * @param {Object} error - Error de la operación
   * @param {string} error.code - Código de error
   * @param {string} error.message - Mensaje de error
   * @param {boolean} [error.retryable] - Si es retryable
   * @returns {Promise<Object>} - Operación actualizada
   */
  async failOperation(operationId, error) {
    this.logger.error('Failing operation', { operationId, error });

    const updates = {
      status: OperationStatus.FAILED,
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'Operation failed',
        retryable: error.retryable !== false,
        timestamp: new Date().toISOString()
      }
    };

    const operation = await this.updateOperation(operationId, updates);

    // Si hay connectionId, notificar vía WebSocket
    if (operation.connectionId) {
      await this._notifyViaWebSocket(operation.connectionId, {
        type: 'OPERATION_FAILED',
        operationId,
        error: updates.error
      });
    }

    return operation;
  }

  /**
   * Obtener operación por ID
   * 
   * @param {string} operationId - ID de la operación
   * @returns {Promise<Object|null>} - Operación o null si no existe
   */
  async getOperation(operationId) {
    if (!operationId) {
      throw new Error('operationId is required');
    }

    this.logger.debug('Getting operation', { operationId });

    const response = await retryDB(
      () => docClient.send(new GetCommand({
        TableName: OPERATIONS_TABLE,
        Key: {
          PK: `OPERATION#${operationId}`,
          SK: 'METADATA'
        }
      })),
      { operation: 'getOperation', operationId }
    );

    return response.Item || null;
  }

  /**
   * Listar operaciones de un usuario
   * 
   * @param {string} userId - ID del usuario
   * @param {Object} options - Opciones de paginación
   * @param {number} [options.limit=20] - Límite de resultados
   * @param {Object} [options.lastEvaluatedKey] - Último key evaluado (paginación)
   * @returns {Promise<Object>} - { operations: [], lastEvaluatedKey }
   */
  async listUserOperations(userId, options = {}) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const { limit = 20, lastEvaluatedKey } = options;

    this.logger.debug('Listing user operations', { userId, limit });

    const params = {
      TableName: OPERATIONS_TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`
      },
      ScanIndexForward: false, // Más recientes primero
      Limit: limit
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await retryDB(
      () => docClient.send(new QueryCommand(params)),
      { operation: 'listUserOperations', userId }
    );

    return {
      operations: response.Items || [],
      lastEvaluatedKey: response.LastEvaluatedKey
    };
  }

  /**
   * Notificar vía WebSocket (si está disponible)
   * 
   * @private
   * @param {string} connectionId - WebSocket connectionId
   * @param {Object} message - Mensaje a enviar
   */
  async _notifyViaWebSocket(connectionId, message) {
    try {
      // Importar dinámicamente para evitar dependencia circular
      const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
      
      const endpoint = process.env.WEBSOCKET_ENDPOINT;
      if (!endpoint) {
        this.logger.warn('WebSocket endpoint not configured', { connectionId });
        return;
      }

      const apiGatewayManagementApi = new ApiGatewayManagementApiClient({
        endpoint
      });

      await apiGatewayManagementApi.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify(message)
        })
      );

      this.logger.info('WebSocket notification sent', { connectionId, type: message.type });
    } catch (error) {
      // No fallar si WebSocket falla
      this.logger.warn('Failed to send WebSocket notification', { 
        connectionId, 
        error: error.message 
      });
    }
  }
}

// ========== EXPORTS ==========

/**
 * Factory para crear instancia singleton del store
 */
let _instance = null;

function getOperationStore(logger) {
  if (!_instance) {
    _instance = new OperationStore(logger);
  }
  return _instance;
}

/**
 * Resetear singleton (para testing)
 */
function resetOperationStore() {
  _instance = null;
}

module.exports = {
  OperationStore,
  getOperationStore,
  resetOperationStore,
  OperationStatus
};
