/**
 * Event Projection Handler - Lambda que procesa eventos del Event Bus
 * y actualiza los Read Models
 */

const { getProjectionManager } = require("../utils/projections");
const Logger = require("../utils/logger");

/**
 * Handler para eventos SNS del Event Bus
 * Este Lambda se triggerea cuando hay nuevos eventos en SNS
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'eventProjection' });
  
  logger.info('Processing event projection', {
    recordCount: event.Records.length
  });

  const projectionManager = getProjectionManager();
  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SNS message
      const snsMessage = JSON.parse(record.Sns.Message);
      
      logger.info('Projecting event', {
        eventType: snsMessage.eventType,
        aggregateType: snsMessage.aggregateType,
        aggregateId: snsMessage.aggregateId,
        eventId: snsMessage.eventId
      });

      // Aplicar evento a las proyecciones
      await projectionManager.projectEvent(snsMessage);
      
      results.push({
        eventId: snsMessage.eventId,
        status: 'PROJECTED',
        eventType: snsMessage.eventType
      });

      logger.info('Event projected successfully', {
        eventId: snsMessage.eventId
      });

    } catch (error) {
      logger.error('Error projecting event', error, {
        recordId: record.Sns.MessageId
      });
      
      results.push({
        recordId: record.Sns.MessageId,
        status: 'FAILED',
        error: error.message
      });
      
      // No lanzar error - permitir que otros eventos se procesen
    }
  }

  logger.info('Event projection batch completed', {
    total: results.length,
    succeeded: results.filter(r => r.status === 'PROJECTED').length,
    failed: results.filter(r => r.status === 'FAILED').length
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Event projection completed',
      results
    })
  };
};
