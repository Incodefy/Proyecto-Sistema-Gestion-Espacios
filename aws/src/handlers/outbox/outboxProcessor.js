/**
 * Outbox Processor - Event Relay Lambda
 * 
 * Procesador asíncrono que:
 * 1. Lee mensajes PENDING del Outbox (via DynamoDB Streams)
 * 2. Publica eventos a SNS/EventBridge
 * 3. Marca mensajes como PUBLISHED o FAILED
 * 4. Implementa retry con exponential backoff
 * 
 * Triggering:
 * - DynamoDB Streams en OutboxTable (NEW_IMAGE)
 * - Procesa mensajes en batch
 * - Garantiza exactly-once con deduplicación
 * 
 * Garantías:
 * ✅ At-least-once delivery (DynamoDB Streams retry)
 * ✅ Exactly-once processing (deduplicación en consumers)
 * ✅ Ordering per aggregate (mismo PK)
 * ✅ Dead Letter Queue para mensajes fallidos
 * 
 * UPDATED: Uses Ambassador for SNS publishing
 */

const { getOutboxStore, OutboxStatus } = require("../utils/outboxStore");
const { wasAlreadyProcessed, markAsProcessed } = require("../utils/idempotency");
const { getAmbassador } = require("../utils/awsAmbassador");
const Logger = require("../utils/logger");

const ambassador = getAmbassador();
const EVENT_BUS_TOPIC_ARN = process.env.EVENT_BUS_TOPIC_ARN;

const logger = Logger.create({ handler: 'OutboxProcessor' });
const outboxStore = getOutboxStore(logger);

/**
 * Handler para DynamoDB Stream trigger
 * Procesa mensajes del Outbox y los publica a SNS
 */
exports.processOutboxStream = async (event) => {
  logger.info('Outbox processor invoked', {
    recordCount: event.Records.length
  });

  const results = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0
  };

  // Procesar cada registro del stream
  for (const record of event.Records) {
    try {
      // Solo procesar INSERT y MODIFY
      if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
        logger.debug('Skipping non-insert/modify event', { eventName: record.eventName });
        results.skipped++;
        continue;
      }

      const newImage = record.dynamodb.NewImage;
      if (!newImage) {
        logger.warn('No NewImage in record', { record });
        results.skipped++;
        continue;
      }

      // Parsear DynamoDB record
      const outboxMessage = unmarshall(newImage);

      // Solo procesar mensajes PENDING
      if (outboxMessage.status !== OutboxStatus.PENDING) {
        logger.debug('Skipping non-pending message', {
          outboxId: outboxMessage.outboxId,
          status: outboxMessage.status
        });
        results.skipped++;
        continue;
      }

      // Verificar si ya fue procesado (idempotencia)
      const idempotencyKey = `outbox-${outboxMessage.outboxId}`;
      if (await wasAlreadyProcessed(idempotencyKey)) {
        logger.info('Message already processed (idempotent)', {
          outboxId: outboxMessage.outboxId
        });
        results.skipped++;
        continue;
      }

      // Procesar mensaje
      const success = await processMessage(outboxMessage);
      
      if (success) {
        results.published++;
        await markAsProcessed(idempotencyKey);
      } else {
        results.failed++;
      }

      results.processed++;

    } catch (error) {
      logger.error('Error processing stream record', {
        error: error.message,
        record: JSON.stringify(record)
      });
      results.failed++;
    }
  }

  logger.info('Outbox processing complete', results);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Outbox processing complete',
      results
    })
  };
};

/**
 * Handler alternativo: polling manual (para testing o fallback)
 * Puede ejecutarse via CloudWatch Events cada N minutos
 */
exports.processOutboxPolling = async () => {
  logger.info('Outbox polling processor invoked');

  try {
    // Obtener mensajes PENDING
    const pendingMessages = await outboxStore.getPendingMessages(10);

    logger.info('Pending messages retrieved', {
      count: pendingMessages.length
    });

    const results = {
      processed: 0,
      published: 0,
      failed: 0,
      skipped: 0
    };

    // Procesar cada mensaje
    for (const message of pendingMessages) {
      try {
        // Verificar idempotencia
        const idempotencyKey = `outbox-${message.outboxId}`;
        if (await wasAlreadyProcessed(idempotencyKey)) {
          logger.info('Message already processed', { outboxId: message.outboxId });
          results.skipped++;
          continue;
        }

        // Procesar
        const success = await processMessage(message);
        
        if (success) {
          results.published++;
          await markAsProcessed(idempotencyKey);
        } else {
          results.failed++;
        }

        results.processed++;

      } catch (error) {
        logger.error('Error processing message', {
          error: error.message,
          outboxId: message.outboxId
        });
        results.failed++;
      }
    }

    logger.info('Polling processing complete', results);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Polling complete',
        results
      })
    };

  } catch (error) {
    logger.error('Polling processor failed', { error: error.message });
    throw error;
  }
};

/**
 * Procesa un mensaje individual del Outbox
 * 
 * @param {Object} message - Mensaje del Outbox
 * @returns {boolean} - True si publicación exitosa
 */
async function processMessage(message) {
  const { outboxId, PK, eventId, eventType, aggregateType, aggregateId, payload, retryCount, maxRetries } = message;

  logger.info('Processing outbox message', {
    outboxId,
    eventId,
    eventType,
    retryCount
  });

  try {
    // 1. Marcar como PROCESSING
    await outboxStore.markAsProcessing(PK, outboxId);

    // 2. Publicar a SNS/EventBridge via Ambassador
    if (!EVENT_BUS_TOPIC_ARN) {
      logger.error('EVENT_BUS_TOPIC_ARN not configured');
      throw new Error('Event bus not configured');
    }

    const publishResult = await ambassador.publishToSNS({
      topicArn: EVENT_BUS_TOPIC_ARN,
      message: payload,
      subject: `Event: ${eventType}`,
      attributes: {
        eventType,
        aggregateType,
        aggregateId,
        eventId,
        outboxId
      }
    });

    logger.info('Event published to SNS via Ambassador', {
      outboxId,
      eventId,
      messageId: publishResult.MessageId
    });

    // 3. Marcar como PUBLISHED
    await outboxStore.markAsPublished(PK, outboxId, {
      snsMessageId: publishResult.MessageId,
      publishedAt: new Date().toISOString()
    });

    return true;

  } catch (error) {
    logger.error('Failed to process outbox message', {
      error: error.message,
      outboxId,
      eventId,
      retryCount
    });

    // Verificar si excedimos retries
    if (retryCount >= maxRetries) {
      logger.error('Max retries exceeded, marking as FAILED', {
        outboxId,
        retryCount,
        maxRetries
      });

      await outboxStore.markAsFailed(PK, outboxId, error.message);
      return false;
    }

    // Incrementar retry count y volver a PENDING
    await outboxStore.incrementRetryCount(PK, outboxId);
    
    logger.warn('Message will be retried', {
      outboxId,
      retryCount: retryCount + 1,
      maxRetries
    });

    return false;
  }
}

/**
 * Unmarshall DynamoDB record (convierte tipos DynamoDB a JS)
 */
function unmarshall(dynamoRecord) {
  const item = {};
  for (const [key, value] of Object.entries(dynamoRecord)) {
    // Parsear tipos DynamoDB (S = String, N = Number, etc)
    if (value.S !== undefined) {
      item[key] = value.S;
    } else if (value.N !== undefined) {
      item[key] = Number(value.N);
    } else if (value.M !== undefined) {
      item[key] = unmarshall(value.M);
    } else if (value.L !== undefined) {
      item[key] = value.L.map(v => unmarshall({ item: v }).item);
    } else if (value.BOOL !== undefined) {
      item[key] = value.BOOL;
    } else if (value.NULL !== undefined) {
      item[key] = null;
    }
  }
  return item;
}

module.exports = {
  processOutboxStream,
  processOutboxPolling
};
