// src/handlers/events.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

// === Utils ===
const { wasAlreadyProcessed, markAsProcessed } = require("../utils/idempotency");
const { retryWithJitter } = require("../utils/retry");
const { createCircuitBreaker } = require("../utils/circuitBreaker");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({});

// === Circuit Breakers ===
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });
const snsBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 15000 });

/**
 * ============================================================
 * 🔹 HANDLER: PERSONALIZATION EVENTS
 * ============================================================
 * Procesa mensajes provenientes del tópico de personalización.
 * Usa SQS como cola intermedia, con DLQ, Idempotencia, Retry y Circuit Breaker.
 */
module.exports.handlePersonalizationEvents = async (event) => {
  console.log("📥 Evento SQS de personalización recibido:", JSON.stringify(event, null, 2));

  const processedRecords = [];
  const failedRecords = [];

  for (const record of event.Records) {
    try {
      // 1. Parsear mensaje SNS dentro del body SQS
      const envelope = JSON.parse(record.body);
      const snsMessage = JSON.parse(envelope.Message);
      const { eventType, eventId, timestamp, data } = snsMessage;

      console.log(`🔹 Procesando evento: ${eventType} (ID: ${eventId})`);

      // 2. Idempotencia
      if (await wasAlreadyProcessed(eventId)) {
        console.log(`⏭️ Evento duplicado detectado, se omite: ${eventId}`);
        processedRecords.push({ eventType, eventId, status: "duplicate" });
        continue;
      }

      // 3. Seleccionar handler según tipo
      const handlerFn =
        eventType === "PERSONALIZATION_REQUESTED"
          ? handlePersonalizationRequested
          : eventType === "PERSONALIZATION_UPDATED"
          ? handlePersonalizationUpdated
          : null;

      if (!handlerFn) {
        console.warn(`⚠️ Tipo de evento no reconocido: ${eventType}`);
        failedRecords.push({ eventType, reason: "unknown_event_type" });
        continue;
      }

      // 4. Circuit breaker activo?
      if (!dynamoBreaker.shouldAllow() || !snsBreaker.shouldAllow()) {
        console.warn("⚠️ Circuit breaker abierto. Evento pospuesto.");
        throw new Error("CircuitBreakerOpen");
      }

      // 5. Retry + jitter
      await retryWithJitter(
        async () => {
          await handlerFn(data, timestamp);
          dynamoBreaker.reportSuccess();
          snsBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );

      // 6. Marcar como procesado
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
      console.error("❌ Error procesando notificación individual:", notifError.message);
      dynamoBreaker.reportFailure();
      failedNotifications.push({ error: notifError.message, recordId: record.messageId });
      throw notifError;
    }
  }

  console.log(`📊 Notificaciones procesadas: ✅${processedNotifications.length} / ❌${failedNotifications.length}`);

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
 * Publica notificación del sistema (SNS protegido por breaker y retry)
 */
async function publishSystemNotification(notificationType, data) {
  const notification = {
    type: notificationType,
    eventId: `${notificationType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    data,
  };

  await retryWithJitter(
    async () => {
      await snsClient.send(
        new PublishCommand({
          TopicArn: process.env.SYSTEM_NOTIFICATIONS_TOPIC_ARN,
          Message: JSON.stringify(notification),
          Subject: `System Notification: ${notificationType}`,
        })
      );
      snsBreaker.reportSuccess();
    },
    { maxAttempts: 3, baseDelayMs: 300 }
  ).catch((err) => {
    snsBreaker.reportFailure();
    console.error("Error publicando notificación SNS:", err);
    throw err;
  });

  console.log(`📨 Notificación SNS enviada: ${notificationType}`);
  return true;
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