/**
 * Outbox Store - Transactional Outbox Pattern
 * 
 * Garantiza la consistencia eventual entre cambios de estado y publicación de eventos
 * mediante escritura atómica en DynamoDB.
 * 
 * Problema resuelto (Dual Write Problem):
 * - Sin Outbox: Write State → Publish Event (si falla, inconsistencia)
 * - Con Outbox: Write State + Write Outbox (transacción atómica) → Processor publica
 * 
 * Flujo:
 * 1. Comando genera evento
 * 2. EventStore + Outbox escritura TRANSACCIONAL (TransactWriteItems)
 * 3. DynamoDB Streams detecta nuevo mensaje en Outbox
 * 4. Lambda Processor publica a SNS/EventBridge
 * 5. Consumer con deduplicación procesa evento exactly-once
 */

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { retryWithJitter } = require("./retry");
const { createCircuitBreaker } = require("./circuitBreaker");
const Logger = require("./logger");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const OUTBOX_TABLE = process.env.OUTBOX_TABLE || `${process.env.SERVICE_NAME}-${process.env.STAGE}-outbox`;
const EVENTS_TABLE = process.env.EVENTS_TABLE || `${process.env.SERVICE_NAME}-${process.env.STAGE}-events`;

const breaker = createCircuitBreaker({ failureThreshold: 5, cooldownMs: 30000 });

/**
 * Estados del Outbox Message
 */
const OutboxStatus = {
  PENDING: 'PENDING',       // Esperando publicación
  PROCESSING: 'PROCESSING', // Siendo procesado por relay
  PUBLISHED: 'PUBLISHED',   // Publicado exitosamente
  FAILED: 'FAILED'          // Fallo después de retries
};

/**
 * Clase OutboxStore para Transactional Outbox Pattern
 */
class OutboxStore {
  constructor(logger) {
    this.logger = logger || Logger.create({ handler: 'OutboxStore' });
  }

  /**
   * Escribe evento al EventStore Y al Outbox en una transacción atómica
   * 
   * CRÍTICO: Usa TransactWriteItems para garantizar atomicidad
   * Si falla cualquier write, ambos se revierten
   * 
   * @param {Object} eventRecord - Evento del EventStore
   * @param {Object} payload - Payload para publicar a SNS/EventBridge
   */
  async appendEventWithOutbox(eventRecord, payload) {
    if (!breaker.shouldAllow()) {
      const error = new Error('Circuit breaker open, rejecting outbox write');
      this.logger.error('Circuit breaker triggered', { error: error.message });
      throw error;
    }

    const outboxId = crypto.randomUUID();
    const timestamp = Date.now();
    const isoTimestamp = new Date(timestamp).toISOString();

    // Construir mensaje Outbox
    const outboxMessage = {
      PK: `OUTBOX#${timestamp}`,
      SK: outboxId,
      outboxId,
      eventId: eventRecord.eventId,
      aggregateType: eventRecord.aggregateType,
      aggregateId: eventRecord.aggregateId,
      eventType: eventRecord.eventType,
      status: OutboxStatus.PENDING,
      createdAt: isoTimestamp,
      payload: payload || eventRecord,
      retryCount: 0,
      maxRetries: 3,
      ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 días
      version: 1
    };

    this.logger.info('Writing event + outbox transactionally', {
      eventId: eventRecord.eventId,
      outboxId,
      eventType: eventRecord.eventType
    });

    try {
      // TRANSACCIÓN ATÓMICA: EventStore + Outbox
      await retryWithJitter(
        async () => {
          await docClient.send(new TransactWriteCommand({
            TransactItems: [
              {
                // 1. Write to EventStore
                Put: {
                  TableName: EVENTS_TABLE,
                  Item: eventRecord,
                  ConditionExpression: 'attribute_not_exists(PK)'
                }
              },
              {
                // 2. Write to Outbox
                Put: {
                  TableName: OUTBOX_TABLE,
                  Item: outboxMessage,
                  ConditionExpression: 'attribute_not_exists(PK)'
                }
              }
            ]
          }));
          breaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 500 }
      );

      this.logger.info('Event + outbox written successfully', {
        eventId: eventRecord.eventId,
        outboxId
      });

      return {
        eventId: eventRecord.eventId,
        outboxId,
        timestamp,
        status: 'PENDING_PUBLICATION'
      };

    } catch (error) {
      breaker.reportFailure();
      
      if (error.name === 'TransactionCanceledException') {
        this.logger.error('Transaction failed - duplicate or condition violation', {
          error: error.message,
          eventId: eventRecord.eventId
        });
      } else {
        this.logger.error('Failed to write event + outbox', {
          error: error.message,
          eventId: eventRecord.eventId
        });
      }
      
      throw error;
    }
  }

  /**
   * Obtiene mensajes PENDING del Outbox para procesamiento
   * Usado por el Outbox Processor Lambda
   * 
   * @param {number} limit - Límite de mensajes a obtener
   */
  async getPendingMessages(limit = 10) {
    this.logger.debug('Fetching pending outbox messages', { limit });

    try {
      const result = await retryWithJitter(
        async () => {
          return await docClient.send(new QueryCommand({
            TableName: OUTBOX_TABLE,
            IndexName: 'StatusIndex',
            KeyConditionExpression: '#status = :pending',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':pending': OutboxStatus.PENDING
            },
            Limit: limit,
            ScanIndexForward: true // Orden cronológico (más antiguos primero)
          }));
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );

      const messages = result.Items || [];
      this.logger.debug('Pending messages retrieved', { count: messages.length });
      
      return messages;

    } catch (error) {
      this.logger.error('Failed to fetch pending messages', { error: error.message });
      throw error;
    }
  }

  /**
   * Marca mensaje como PROCESSING (evita procesamiento duplicado)
   * 
   * @param {string} outboxId - ID del mensaje
   * @param {string} pk - Partition key del mensaje
   */
  async markAsProcessing(pk, outboxId) {
    this.logger.debug('Marking message as PROCESSING', { outboxId });

    try {
      await retryWithJitter(
        async () => {
          await docClient.send(new UpdateCommand({
            TableName: OUTBOX_TABLE,
            Key: { PK: pk, SK: outboxId },
            UpdateExpression: 'SET #status = :processing, #updatedAt = :now',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
              ':processing': OutboxStatus.PROCESSING,
              ':now': new Date().toISOString(),
              ':pending': OutboxStatus.PENDING
            },
            ConditionExpression: '#status = :pending' // Solo si aún está PENDING
          }));
        },
        { maxAttempts: 2, baseDelayMs: 200 }
      );

      this.logger.debug('Message marked as PROCESSING', { outboxId });

    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Message already processing or published', { outboxId });
      } else {
        this.logger.error('Failed to mark as processing', { error: error.message, outboxId });
        throw error;
      }
    }
  }

  /**
   * Marca mensaje como PUBLISHED después de publicación exitosa
   * 
   * @param {string} pk - Partition key
   * @param {string} outboxId - ID del mensaje
   * @param {Object} metadata - Metadatos de publicación (MessageId, timestamp, etc)
   */
  async markAsPublished(pk, outboxId, metadata = {}) {
    this.logger.debug('Marking message as PUBLISHED', { outboxId });

    try {
      await retryWithJitter(
        async () => {
          await docClient.send(new UpdateCommand({
            TableName: OUTBOX_TABLE,
            Key: { PK: pk, SK: outboxId },
            UpdateExpression: 'SET #status = :published, #publishedAt = :now, #metadata = :metadata',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#publishedAt': 'publishedAt',
              '#metadata': 'publishMetadata'
            },
            ExpressionAttributeValues: {
              ':published': OutboxStatus.PUBLISHED,
              ':now': new Date().toISOString(),
              ':metadata': metadata
            }
          }));
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );

      this.logger.info('Message marked as PUBLISHED', { outboxId, metadata });

    } catch (error) {
      this.logger.error('Failed to mark as published', { error: error.message, outboxId });
      throw error;
    }
  }

  /**
   * Marca mensaje como FAILED después de exceder retries
   * 
   * @param {string} pk - Partition key
   * @param {string} outboxId - ID del mensaje
   * @param {string} errorMessage - Mensaje de error
   */
  async markAsFailed(pk, outboxId, errorMessage) {
    this.logger.error('Marking message as FAILED', { outboxId, errorMessage });

    try {
      await retryWithJitter(
        async () => {
          await docClient.send(new UpdateCommand({
            TableName: OUTBOX_TABLE,
            Key: { PK: pk, SK: outboxId },
            UpdateExpression: 'SET #status = :failed, #failedAt = :now, #error = :error, #retryCount = #retryCount + :inc',
            ExpressionAttributeNames: {
              '#status': 'status',
              '#failedAt': 'failedAt',
              '#error': 'lastError',
              '#retryCount': 'retryCount'
            },
            ExpressionAttributeValues: {
              ':failed': OutboxStatus.FAILED,
              ':now': new Date().toISOString(),
              ':error': errorMessage,
              ':inc': 1
            }
          }));
        },
        { maxAttempts: 2, baseDelayMs: 200 }
      );

      this.logger.warn('Message marked as FAILED - needs manual review', { outboxId });

    } catch (error) {
      this.logger.error('Failed to mark as failed (ironic)', { error: error.message, outboxId });
      // No throw - already in error handling
    }
  }

  /**
   * Incrementa retry count (para reintentos)
   * 
   * @param {string} pk - Partition key
   * @param {string} outboxId - ID del mensaje
   */
  async incrementRetryCount(pk, outboxId) {
    try {
      await docClient.send(new UpdateCommand({
        TableName: OUTBOX_TABLE,
        Key: { PK: pk, SK: outboxId },
        UpdateExpression: 'SET #retryCount = #retryCount + :inc, #status = :pending',
        ExpressionAttributeNames: {
          '#retryCount': 'retryCount',
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':inc': 1,
          ':pending': OutboxStatus.PENDING
        }
      }));
    } catch (error) {
      this.logger.error('Failed to increment retry count', { error: error.message, outboxId });
    }
  }

  /**
   * Obtiene estadísticas del Outbox (para monitoreo)
   */
  async getStats() {
    // TODO: Implementar query por cada status
    return {
      pending: 0,
      processing: 0,
      published: 0,
      failed: 0
    };
  }
}

// Singleton instance
let outboxStoreInstance = null;

/**
 * Factory function para obtener instancia singleton
 */
function getOutboxStore(logger) {
  if (!outboxStoreInstance) {
    outboxStoreInstance = new OutboxStore(logger);
  }
  return outboxStoreInstance;
}

module.exports = {
  OutboxStore,
  getOutboxStore,
  OutboxStatus
};
