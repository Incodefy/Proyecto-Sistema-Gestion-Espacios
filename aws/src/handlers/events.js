// src/handlers/events.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const Logger = require("../utils/logger");
const { wasAlreadyProcessed, markAsProcessed } = require("../utils/idempotency");
const { getAmbassador } = require("../utils/awsAmbassador");
const { createCircuitBreaker } = require("../utils/circuitBreaker");
const { validate } = require("../utils/validator");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const ambassador = getAmbassador();

const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

module.exports.handlePersonalizationEvents = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'personalizationEvents' });
  logger.info('Procesando eventos de personalización', { recordCount: event.Records.length });

  const processedRecords = [];
  const failedRecords = [];

  for (const record of event.Records) {
    try {
      const envelope = JSON.parse(record.body);
      const snsMessage = JSON.parse(envelope.Message);
      const { eventType, eventId, timestamp, data } = snsMessage;

      logger.info('Procesando evento', { eventType, eventId });

      if (await wasAlreadyProcessed(eventId)) {
        logger.info('Evento duplicado detectado, omitiendo', { eventId });
        processedRecords.push({ eventType, eventId, status: "duplicate" });
        continue;
      }

      const handlerFn =
        eventType === "PERSONALIZATION_REQUESTED" ? handlePersonalizationRequested :
        eventType === "PERSONALIZATION_UPDATED" ? handlePersonalizationUpdated : null;

      if (!handlerFn) {
        logger.warn('Tipo de evento no reconocido', { eventType });
        failedRecords.push({ eventType, reason: "unknown_event_type" });
        continue;
      }

      if (!dynamoBreaker.shouldAllow()) {
        logger.warn('Circuit breaker abierto, evento pospuesto');
        throw new Error("CircuitBreakerOpen");
      }

      await retryWithJitter(
        async () => {
          await handlerFn(data, timestamp, logger);
          dynamoBreaker.reportSuccess();
          snsBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );

      await markAsProcessed(eventId);

      processedRecords.push({ eventType, eventId, status: "success" });
    } catch (error) {
      console.error("❌ Error procesando registro individual:", error.message);
      dynamoBreaker.reportFailure();
      snsBreaker.reportFailure();
      failedRecords.push({ error: error.message, recordId: record.messageId });
      throw error; // SQS reintentará y DLQ si excede maxReceiveCount
    }
  }

  console.log(`✅ Procesados: ${processedRecords.length}, ❌ Fallidos: ${failedRecords.length}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Eventos de personalización procesados",
      processed: processedRecords.length,
      failed: failedRecords.length,
      details: { processedRecords, failedRecords },
    }),
  };
};

/**
 * Procesa eventos cuando un usuario solicita su personalización
 */
async function handlePersonalizationRequested(data, timestamp) {
  const { userSub, userEmail, parametersCount } = data;

  console.log(`👤 Usuario ${userEmail} consultó su personalización (${parametersCount} parámetros)`);

  await logUserActivity({
    userSub,
    userEmail,
    action: "PERSONALIZATION_VIEW",
    metadata: { parametersCount },
    timestamp,
  });

  if (parametersCount === 0) {
    await publishSystemNotification("FIRST_PERSONALIZATION_ACCESS", {
      userEmail,
      message: "Usuario accedió por primera vez a personalización",
    });
  }
}

/**
 * Procesa eventos cuando un usuario actualiza su personalización
 */
async function handlePersonalizationUpdated(data, timestamp) {
  const { userSub, userEmail, updatedParameters } = data;

  console.log(`🧩 Usuario ${userEmail} actualizó personalización:`, updatedParameters);

  for (const param of updatedParameters) {
    await logUserActivity({
      userSub,
      userEmail,
      action: "PARAMETER_UPDATED",
      metadata: {
        parameter: param.key,
        newValue: param.value,
        previousValue: param.previousValue,
      },
      timestamp,
    });
  }

  const importantChanges = updatedParameters.filter((p) =>
    ["theme.mode", "locale.language"].includes(p.key)
  );

  if (importantChanges.length > 0) {
    await publishSystemNotification("IMPORTANT_PERSONALIZATION_CHANGE", {
      userEmail,
      changes: importantChanges,
      message: "Usuario realizó cambios importantes en personalización",
    });
  }
}

/**
 * ============================================================
 * 🔹 HANDLER: SYSTEM NOTIFICATIONS
 * ============================================================
 * Procesa notificaciones del sistema enviadas por SNS → SQS.
 * Aplica Idempotencia, Retry, Circuit Breaker y DLQ.
 */
module.exports.handleSystemNotifications = async (event) => {
  console.log("📩 Evento SQS de notificación del sistema recibido:", JSON.stringify(event, null, 2));

  const processedNotifications = [];
  const failedNotifications = [];

  for (const record of event.Records) {
    try {
      const envelope = JSON.parse(record.body);
      const snsMessage = JSON.parse(envelope.Message);
      const { eventId, type, data, timestamp } = snsMessage;

      console.log(`🔔 Procesando notificación: ${type} (ID: ${eventId})`);

      if (await wasAlreadyProcessed(eventId)) {
        console.log(`⏭️ Notificación duplicada, se omite: ${eventId}`);
        processedNotifications.push({ eventId, type, status: "duplicate" });
        continue;
      }

      if (!dynamoBreaker.shouldAllow()) {
        console.warn("⚠️ Circuit breaker abierto (DynamoDB). Notificación pausada.");
        throw new Error("CircuitBreakerOpen");
      }

      await retryWithJitter(
        async () => {
          await processSystemNotification(snsMessage);
          dynamoBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 400 }
      );

      await markAsProcessed(eventId);
      processedNotifications.push({ eventId, type, status: "success" });
    } catch (notifError) {
      logger.error('Error procesando notificación individual', notifError);
      dynamoBreaker.reportFailure();
      failedNotifications.push({ error: notifError.message, recordId: record.messageId });
      throw notifError;
    }
  }

  logger.info('Notificaciones procesadas', { 
    processed: processedNotifications.length, 
    failed: failedNotifications.length 
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Notificaciones del sistema procesadas correctamente",
      processed: processedNotifications.length,
      failed: failedNotifications.length,
      details: { processedNotifications, failedNotifications },
    }),
  };
};

/**
 * Procesa el contenido lógico de una notificación del sistema
 */
async function processSystemNotification(notification) {
  const { type, data, timestamp } = notification;

  switch (type) {
    case "FIRST_PERSONALIZATION_ACCESS":
      console.log(`🆕 Nuevo usuario en personalización: ${data.userEmail}`);
      await safeLogSystemEvent({
        event: "NEW_PERSONALIZATION_USER",
        userEmail: data.userEmail,
        message: data.message,
        timestamp,
      });
      break;

    case "IMPORTANT_PERSONALIZATION_CHANGE":
      console.log(`⚙️ Cambios importantes por ${data.userEmail}:`, data.changes);
      await safeLogSystemEvent({
        event: "IMPORTANT_CHANGE",
        userEmail: data.userEmail,
        changes: data.changes,
        message: data.message,
        timestamp,
      });
      break;

    default:
      console.log(`ℹ️ Notificación general del sistema (${type})`, data);
      await safeLogSystemEvent({
        event: "SYSTEM_NOTIFICATION",
        type: type,
        data: data,
        timestamp,
      });
  }
}

/**
 * Wrapper seguro con retry + breaker para registrar eventos del sistema
 */
async function safeLogSystemEvent(eventData) {
  await retryWithJitter(
    async () => {
      await logSystemEvent(eventData);
      dynamoBreaker.reportSuccess();
    },
    { maxAttempts: 3, baseDelayMs: 500 }
  ).catch((err) => {
    dynamoBreaker.reportFailure();
    console.error("Error registrando evento del sistema:", err.message);
    throw err;
  });
}

/**
 * Registra eventos del sistema en DynamoDB
 */
async function logSystemEvent(eventData) {
  const timestamp = eventData.timestamp || new Date().toISOString();
  const logId = `system-${eventData.event}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

  const logEntry = {
    id: logId,
    user_sub: "system",
    user_email: eventData.userEmail || "system",
    action: "SYSTEM_EVENT",
    metadata: {
      event: eventData.event,
      ...eventData,
    },
    timestamp,
    source: "system_notification",
  };

  await docClient.send(
    new PutCommand({
      TableName: process.env.ACTIVITY_LOGS_TABLE,
      Item: logEntry,
      ConditionExpression: "attribute_not_exists(id)",
    })
  );

  console.log("🪵 Evento del sistema registrado:", eventData.event);
  return logEntry;
}

/**
 * Publica notificación del sistema (Ambassador handles retry, circuit breaker, telemetry)
 */
async function publishSystemNotification(notificationType, data) {
  const notification = {
    type: notificationType,
    eventId: `${notificationType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    data,
  };

  try {
    await ambassador.publishToSNS({
      topicArn: process.env.SYSTEM_NOTIFICATIONS_TOPIC_ARN,
      message: notification,
      subject: `System Notification: ${notificationType}`
    });

    console.log(`📨 Notificación SNS enviada via Ambassador: ${notificationType}`);
    return true;
  } catch (err) {
    console.error("Error publicando notificación SNS:", err);
    throw err;
  }
}

/**
 * Función hash simple para generar IDs determinísticos
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Registra actividad de usuario en DynamoDB
 */
async function logUserActivity(activityData) {
  try {
    const ttlSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 días

    // ✅ VALIDACIÓN AJV antes de escribir
    const validationResult = validate('logUserActivity', {
      userSub: activityData.userSub,
      userEmail: activityData.userEmail,
      action: activityData.action,
      metadata: activityData.metadata || {},
      timestamp: activityData.timestamp || new Date().toISOString(),
      ipAddress: activityData.ipAddress || 'unknown',
      userAgent: activityData.userAgent || 'unknown',
      source: activityData.source || 'event_handler'
    });

    if (!validationResult.valid) {
      console.warn('⚠️ Validación fallida en logUserActivity:', validationResult.errors);
      throw new Error(`Validation failed: ${validationResult.errors}`);
    }

    const logEntry = {
      id: `${activityData.userSub}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_sub: activityData.userSub,
      user_email: activityData.userEmail,
      action: activityData.action,
      metadata: activityData.metadata || {},
      timestamp: activityData.timestamp || new Date().toISOString(),
      ip_address: activityData.ipAddress || 'unknown',
      user_agent: activityData.userAgent || 'unknown',
      source: activityData.source || 'event_handler',
      ttl: ttlSeconds
    };

    if (!dynamoBreaker.shouldAllow()) {
      console.warn("⚠️ Circuit breaker abierto (DynamoDB). Log no registrado.");
      throw new Error("CircuitBreakerOpen");
    }

    await retryWithJitter(
      async () => {
        await docClient.send(new PutCommand({
          TableName: process.env.ACTIVITY_LOGS_TABLE,
          Item: logEntry
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    console.log('[Events] 📊 Actividad de usuario registrada:', {
      action: logEntry.action,
      user: logEntry.user_email
    });

    return logEntry;
  } catch (error) {
    dynamoBreaker.reportFailure();
    console.error('[Events] ❌ Error registrando actividad de usuario:', error);
    // No lanzamos el error para que el evento principal no falle
    return null;
  }
}