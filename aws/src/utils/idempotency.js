// src/utils/idempotency.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { retryWithJitter } = require("./retry");
const { createCircuitBreaker } = require("./circuitBreaker");

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME =
  process.env.PROCESSED_MESSAGES_TABLE ||
  `${process.env.SERVICE_NAME || 'service'}-${process.env.STAGE || 'dev'}-processed-messages`;

const breaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 15000 });

if (!TABLE_NAME) {
  console.warn("[Idempotency] ⚠️ Tabla de mensajes procesados no definida.");
}

/**
 * Verifica si un mensaje ya fue procesado
 */
async function wasAlreadyProcessed(messageId) {
  if (!messageId) return false;

  try {
    if (!breaker.shouldAllow()) {
      console.warn("[Idempotency] Circuit breaker activo, omitiendo verificación temporal.");
      return false;
    }

    const result = await retryWithJitter(
      async () => {
        const res = await docClient.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { message_id: messageId },
          })
        );
        breaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    return !!result.Item;
  } catch (err) {
    breaker.reportFailure();
    console.error("[Idempotency] Error verificando idempotencia:", err);
    return false;
  }
}

/**
 * Marca un mensaje como procesado
 */
async function markAsProcessed(messageId) {
  if (!messageId) return;

  const now = new Date().toISOString();
  const ttlSeconds = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 días

  try {
    if (!breaker.shouldAllow()) {
      console.warn("[Idempotency] Circuit breaker activo, omitiendo registro temporal.");
      return;
    }

    await retryWithJitter(
      async () => {
        await docClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: {
              message_id: messageId,
              processed_at: now,
              ttl: ttlSeconds,
            },
            ConditionExpression: "attribute_not_exists(message_id)",
          })
        );
        breaker.reportSuccess();
        console.log(`[Idempotency] ✅ Mensaje marcado como procesado: ${messageId}`);
      },
      { maxAttempts: 3, baseDelayMs: 400 }
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      console.log(`[Idempotency] Mensaje ya estaba registrado: ${messageId}`);
    } else {
      breaker.reportFailure();
      console.error("[Idempotency] Error marcando mensaje procesado:", err);
    }
  }
}

module.exports = {
  wasAlreadyProcessed,
  markAsProcessed,
};
