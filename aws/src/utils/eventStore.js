/**
 * Event Store - Sistema de almacenamiento de eventos para CQRS/Event Sourcing
 * Almacena todos los eventos del sistema para audit trail y proyecciones
 * 
 * UPDATED: Integrado con Transactional Outbox Pattern
 * - EventStore + Outbox escritura atómica (TransactWriteItems)
 * - Garantiza consistencia eventual sin dual write problem
 */

const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { retryDB } = require("./retry");
const Logger = require("./logger");
const { getSnapshotStore } = require("./snapshotStore");
const { getOutboxStore } = require("./outboxStore");
const { getAmbassador } = require("./awsAmbassador");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ambassador = getAmbassador();

const EVENTS_TABLE = process.env.EVENTS_TABLE || `${process.env.SERVICE_NAME}-${process.env.STAGE}-events`;
const EVENT_BUS_TOPIC_ARN = process.env.EVENT_BUS_TOPIC_ARN;
const USE_OUTBOX = process.env.USE_OUTBOX !== 'false'; // Default true

/**
 * Clase EventStore para manejar event sourcing
 */
class EventStore {
  constructor(logger) {
    this.logger = logger || Logger.create({ handler: 'EventStore' });
    this.snapshotStore = getSnapshotStore();
    this.outboxStore = USE_OUTBOX ? getOutboxStore(logger) : null;
  }

  /**
   * Append event to event store
   * 
   * UPDATED: Usa Transactional Outbox Pattern
   * - Si USE_OUTBOX=true: EventStore + Outbox escritura ATÓMICA
   * - Si USE_OUTBOX=false: Fallback a comportamiento legacy (directo a SNS)
   * 
   * @param {Object} event - Event to store
   * @param {string} event.aggregateType - Tipo de agregado (Appointment, Group, etc)
   * @param {string} event.aggregateId - ID del agregado
   * @param {string} event.eventType - Tipo de evento (AppointmentCreated, etc)
   * @param {Object} event.data - Datos del evento
   * @param {Object} event.metadata - Metadatos (userId, correlationId, etc)
   */
  async appendEvent(event) {
    const {
      aggregateType,
      aggregateId,
      eventType,
      data,
      metadata = {}
    } = event;

    // Validación
    if (!aggregateType || !aggregateId || !eventType || !data) {
      throw new Error('Event must have aggregateType, aggregateId, eventType, and data');
    }

    const eventId = crypto.randomUUID();
    const timestamp = Date.now();
    const isoTimestamp = new Date(timestamp).toISOString();

    // Construir evento completo
    const eventRecord = {
      // Primary Key: aggregateType#aggregateId + timestamp
      PK: `${aggregateType}#${aggregateId}`,
      SK: `EVENT#${timestamp}#${eventId}`,
      
      // Event data
      eventId,
      aggregateType,
      aggregateId,
      eventType,
      timestamp,
      isoTimestamp,
      data,
      metadata: {
        ...metadata,
        userId: metadata.userId || metadata.userSub,
        correlationId: metadata.correlationId || crypto.randomUUID(),
        causationId: metadata.causationId || eventId
      },
      version: 1,
      
      // GSI para queries por tipo de evento
      GSI1PK: eventType,
      GSI1SK: isoTimestamp,
      
      // GSI para queries por agregado
      GSI2PK: aggregateType,
      GSI2SK: isoTimestamp,
      
      // TTL opcional (7 años por defecto para compliance)
      ttl: Math.floor(Date.now() / 1000) + (7 * 365 * 24 * 60 * 60)
    };

    this.logger.info('Appending event to store', {
      eventType,
      aggregateType,
      aggregateId,
      eventId,
      useOutbox: !!this.outboxStore
    });

    // TRANSACTIONAL OUTBOX PATTERN
    if (this.outboxStore) {
      // 1. Write EventStore + Outbox ATOMICALLY (TransactWriteItems)
      await this.outboxStore.appendEventWithOutbox(eventRecord, eventRecord);
      
      this.logger.info('Event + outbox written atomically', { eventId });
      
      // Outbox Processor publicará el evento a SNS asíncronamente
      // Garantía: exactly-once delivery via DynamoDB Streams + idempotencia
    } else {
      // FALLBACK: Legacy behavior (direct SNS publish)
      this.logger.warn('Outbox disabled, using legacy direct publish');
      
      // 1. Guardar evento en event store
      await retryDB(
        () => docClient.send(new PutCommand({
          TableName: EVENTS_TABLE,
          Item: eventRecord,
          ConditionExpression: 'attribute_not_exists(PK)'  // Prevent duplicates
        })),
        { operation: 'appendEvent' }
      );

      // 2. Publicar evento al event bus para proyecciones (DUAL WRITE - riesgo)
      await this.publishEventToBus(eventRecord);
      
      this.logger.info('Event appended successfully (legacy)', { eventId });
    }

    // 3. Check if snapshot should be created (every 100 events)
    const currentVersion = await this.getAggregateVersion(aggregateType, aggregateId);
    if (this.snapshotStore.shouldCreateSnapshot(currentVersion)) {
      this.logger.info('Snapshot threshold reached', {
        aggregateType,
        aggregateId,
        version: currentVersion
      });
      // Create snapshot asynchronously (don't block)
      this.createSnapshotAsync(aggregateType, aggregateId, currentVersion, metadata.userId)
        .catch(err => this.logger.error('Snapshot creation failed', { error: err.message }));
    }

    return {
      eventId,
      timestamp,
      aggregateId
    };
  }

  /**
   * Publish event to SNS for asynchronous projections
   * UPDATED: Uses Ambassador for circuit breaker, rate limiting, telemetry
   */
  async publishEventToBus(event) {
    if (!EVENT_BUS_TOPIC_ARN) {
      this.logger.warn('EVENT_BUS_TOPIC_ARN not configured, skipping event bus publish');
      return;
    }

    try {
      await ambassador.publishToSNS({
        topicArn: EVENT_BUS_TOPIC_ARN,
        message: event,
        subject: `Event: ${event.eventType}`,
        attributes: {
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId
        }
      });

      this.logger.debug('Event published to bus via Ambassador', { eventId: event.eventId });
    } catch (error) {
      this.logger.error('Failed to publish event to bus', error, {
        eventId: event.eventId
      });
      // No fallar si falla la publicación - el evento ya está guardado
    }
  }

  /**
   * Get all events for an aggregate (for rebuilding state)
   * @param {string} aggregateType - Tipo de agregado
   * @param {string} aggregateId - ID del agregado
   * @param {number} fromVersion - Versión inicial (opcional)
   */
  async getAggregateEvents(aggregateType, aggregateId, fromVersion = 0) {
    this.logger.debug('Fetching aggregate events', {
      aggregateType,
      aggregateId,
      fromVersion
    });

    const result = await retryDB(
      () => docClient.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: 'PK = :pk AND SK > :sk',
        ExpressionAttributeValues: {
          ':pk': `${aggregateType}#${aggregateId}`,
          ':sk': `EVENT#${fromVersion}`
        },
        ScanIndexForward: true  // Orden cronológico
      })),
      { operation: 'getAggregateEvents' }
    );

    return result.Items || [];
  }

  /**
   * Get events by type (for analytics/auditing)
   * @param {string} eventType - Tipo de evento
   * @param {number} limit - Límite de resultados
   */
  async getEventsByType(eventType, limit = 100) {
    const result = await retryDB(
      () => docClient.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        IndexName: 'EventTypeIndex',
        KeyConditionExpression: 'GSI1PK = :eventType',
        ExpressionAttributeValues: {
          ':eventType': eventType
        },
        Limit: limit,
        ScanIndexForward: false  // Más recientes primero
      })),
      { operation: 'getEventsByType' }
    );

    return result.Items || [];
  }

  /**
   * Rebuild aggregate state from events (Event Sourcing)
   * Optimized with snapshots - starts from latest snapshot instead of beginning
   * @param {string} aggregateType - Tipo de agregado
   * @param {string} aggregateId - ID del agregado
   * @param {Function} applyEvent - Función para aplicar eventos al estado
   */
  async rebuildAggregateState(aggregateType, aggregateId, applyEvent) {
    let state = {};
    let eventsProcessed = 0;
    let snapshotVersion = 0;

    // Try to load latest snapshot first
    const snapshot = await this.snapshotStore.getLatestSnapshot(aggregateType, aggregateId);
    
    if (snapshot) {
      state = snapshot.state;
      snapshotVersion = snapshot.version;
      this.logger.debug('Starting from snapshot', {
        aggregateType,
        aggregateId,
        snapshotVersion,
        snapshotId: snapshot.snapshotId
      });
    }

    // Get events after snapshot version
    const events = await this.getAggregateEvents(aggregateType, aggregateId, snapshotVersion);
    
    for (const event of events) {
      state = applyEvent(state, event);
      eventsProcessed++;
    }

    this.logger.debug('Aggregate state rebuilt', {
      aggregateType,
      aggregateId,
      snapshotVersion,
      eventsProcessed,
      totalVersion: snapshotVersion + eventsProcessed,
      optimizationSavings: snapshotVersion > 0 ? `${snapshotVersion} events skipped` : 'no snapshot'
    });

    return state;
  }

  /**
   * Get events for time-based queries (auditing)
   */
  async getEventsInTimeRange(aggregateType, startTime, endTime, limit = 100) {
    const result = await retryDB(
      () => docClient.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        IndexName: 'AggregateTypeIndex',
        KeyConditionExpression: 'GSI2PK = :type AND GSI2SK BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':type': aggregateType,
          ':start': new Date(startTime).toISOString(),
          ':end': new Date(endTime).toISOString()
        },
        Limit: limit
      })),
      { operation: 'getEventsInTimeRange' }
    );

    return result.Items || [];
  }

  /**
   * Get aggregate version (count of events)
   * Used to determine when to create snapshots
   */
  async getAggregateVersion(aggregateType, aggregateId) {
    const result = await retryDB(
      () => docClient.send(new QueryCommand({
        TableName: EVENTS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `${aggregateType}#${aggregateId}`
        },
        Select: 'COUNT'
      })),
      { operation: 'getAggregateVersion' }
    );

    return result.Count || 0;
  }

  /**
   * Create snapshot asynchronously
   * Called when aggregate reaches snapshot threshold (every 100 events)
   */
  async createSnapshotAsync(aggregateType, aggregateId, version, userId = 'system') {
    try {
      // Rebuild current state
      const state = await this.rebuildAggregateState(
        aggregateType,
        aggregateId,
        this.getApplyEventFunction(aggregateType)
      );

      // Save snapshot
      await this.snapshotStore.saveSnapshot(
        aggregateType,
        aggregateId,
        state,
        version,
        userId
      );

      this.logger.info('Snapshot created successfully', {
        aggregateType,
        aggregateId,
        version
      });
    } catch (error) {
      this.logger.error('Failed to create snapshot', {
        aggregateType,
        aggregateId,
        version,
        error: error.message
      });
      // Don't throw - snapshot creation is best-effort
    }
  }

  /**
   * Get the appropriate applyEvent function for an aggregate type
   * This is a simple implementation - in production you'd have a registry
   */
  getApplyEventFunction(aggregateType) {
    // Default implementation - accumulates all events in an array
    return (state, event) => {
      if (!state.events) {
        state.events = [];
      }
      state.events.push(event);
      
      // Apply business logic based on event type
      switch (event.eventType) {
        case EventTypes.APPOINTMENT_CREATED:
          return { ...state, ...event.data, status: 'active' };
        case EventTypes.APPOINTMENT_UPDATED:
          return { ...state, ...event.data };
        case EventTypes.APPOINTMENT_DELETED:
          return { ...state, status: 'deleted', deletedAt: event.timestamp };
        case EventTypes.GROUP_CREATED:
          return { ...state, ...event.data, members: [] };
        case EventTypes.MEMBER_INVITED:
          return {
            ...state,
            members: [...(state.members || []), event.data]
          };
        default:
          return state;
      }
    };
  }
}

/**
 * Event types for the system
 */
const EventTypes = {
  // Appointments
  APPOINTMENT_CREATED: 'AppointmentCreated',
  APPOINTMENT_UPDATED: 'AppointmentUpdated',
  APPOINTMENT_DELETED: 'AppointmentDeleted',
  APPOINTMENT_COMPLETED: 'AppointmentCompleted',
  APPOINTMENT_CANCELLED: 'AppointmentCancelled',

  // Groups
  GROUP_CREATED: 'GroupCreated',
  GROUP_UPDATED: 'GroupUpdated',
  GROUP_DELETED: 'GroupDeleted',
  MEMBER_INVITED: 'MemberInvited',
  MEMBER_JOINED: 'MemberJoined',
  MEMBER_REMOVED: 'MemberRemoved',
  MEMBER_ROLE_UPDATED: 'MemberRoleUpdated',

  // Spaces
  SPACE_CREATED: 'SpaceCreated',
  SPACE_UPDATED: 'SpaceUpdated',
  SPACE_DELETED: 'SpaceDeleted',

  // Occupants
  OCCUPANT_CREATED: 'OccupantCreated',
  OCCUPANT_UPDATED: 'OccupantUpdated',
  OCCUPANT_DELETED: 'OccupantDeleted',

  // Notifications
  NOTIFICATION_CREATED: 'NotificationCreated',
  NOTIFICATION_READ: 'NotificationRead',
  NOTIFICATION_DELETED: 'NotificationDeleted'
};

module.exports = {
  EventStore,
  EventTypes
};
