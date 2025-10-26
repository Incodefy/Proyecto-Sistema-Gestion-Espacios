// src/handlers/personalization.js
const config = require('../../config/config');

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({});

// Parámetros disponibles para personalización
const PERSONALIZATION_PARAMETERS = config.personalization.parameters;

// Parámetros globales (por defecto)
const getGlobalParameters = () => {
  const params = config.personalization.parameters;
  return Object.fromEntries(
    Object.entries(params).map(([key, cfg]) => [key, cfg.default])
  );
};

const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");

const snsBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 15000 });

// Publicar eventos a SNS
async function publishPersonalizationEvent(eventType, data) {
  const eventId = `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const message = {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      data
    };

    if (!snsBreaker.shouldAllow()) {
      console.warn("⚠️ Circuit breaker abierto para SNS, evento no enviado:", eventType);
      throw new Error("CircuitBreakerOpen");
    }

    await retryWithJitter(
      async () => {
        await snsClient.send(new PublishCommand({
          TopicArn: process.env.PERSONALIZATION_TOPIC_ARN,
          Message: JSON.stringify(message),
          Subject: `Personalization Event: ${eventType}`
        }));
        snsBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 400 }
    );

    console.log(`📨 Evento SNS publicado correctamente: ${eventType}`);
    return true;

  } catch (error) {
    snsBreaker.reportFailure();
    console.error(`❌ Error publicando evento SNS (${eventType}):`, error.message);
    return false;
  }
}

/**
 * GET /personalization
 * Obtener parámetros globales y específicos del usuario
 */
module.exports.getPersonalization = async (event) => {
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userSub) {
      return response(401, { ok: false, error: "Usuario no autenticado" });
    }

    const result = await docClient.send(new QueryCommand({
      TableName: process.env.PARAMETERS_TABLE,
      KeyConditionExpression: "user_sub = :userSub",
      ExpressionAttributeValues: { ":userSub": userSub }
    }));

    const userParameters = {};
    (result.Items || []).forEach(item => {
      userParameters[item.parameter_key] = item.parameter_value;
    });

    const globalParameters = getGlobalParameters();
    const finalParameters = { ...globalParameters, ...userParameters };

    Object.entries(PERSONALIZATION_PARAMETERS).forEach(([key, config]) => {
      if (!(key in finalParameters)) {
        finalParameters[key] = config.default;
      }
    });

    const colorVariants = config.personalization.generateColorVariants(finalParameters['theme.primary_color']);
    finalParameters['theme.primary_color_light'] = colorVariants.light;
    finalParameters['theme.primary_color_dark'] = colorVariants.dark;

    await publishPersonalizationEvent('PERSONALIZATION_REQUESTED', {
      userSub,
      userEmail,
      parametersCount: Object.keys(userParameters).length
    });

    return response(200, {
      ok: true,
      user_sub: userSub,
      email: userEmail,
      global_parameters: globalParameters,
      user_parameters: userParameters,
      final_parameters: finalParameters,
      available_parameters: PERSONALIZATION_PARAMETERS
    });

  } catch (err) {
    console.error("Error obteniendo personalización:", err);
    return response(500, { 
      ok: false, 
      error: "Error interno del servidor",
      details: err.message 
    });
  }
};

const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

/**
 * POST /personalization
 * Establecer parámetros específicos del usuario
 */
module.exports.setPersonalization = async (event) => {
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userSub) {
      return response(401, { ok: false, error: "Usuario no autenticado" });
    }

    const { parameters } = JSON.parse(event.body || "{}");

    if (!parameters || typeof parameters !== 'object') {
      return response(400, { 
        ok: false, 
        error: "parameters es obligatorio y debe ser un objeto" 
      });
    }

    // ✅ AGREGAR: Idempotencia basada en el hash de parámetros
    const paramsHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(parameters))
      .digest('hex')
      .substring(0, 16);
    
    const idempotencyKey = `setPersonalization-${userSub}-${paramsHash}`;
    
    if (await wasAlreadyProcessed(idempotencyKey)) {
      console.log(`[Personalization] ⏭️ Actualización ya procesada: ${idempotencyKey}`);
      
      // Retornar el estado actual
      const currentState = await module.exports.getPersonalization(event);
      return response(200, {
        ok: true,
        message: "Parámetros ya estaban actualizados",
        final_parameters: JSON.parse(currentState.body).final_parameters,
        already_processed: true
      });
    }

    const validParameters = {};
    const errors = [];
    
    for (const [key, value] of Object.entries(parameters)) {
      if (PERSONALIZATION_PARAMETERS[key]) {
        if (validateParameter(key, value)) {
          validParameters[key] = value;
        } else {
          errors.push(`Valor inválido para ${key}: ${value}`);
        }
      } else {
        errors.push(`Parámetro no permitido: ${key}`);
      }
    }

    if (errors.length > 0) {
      return response(400, { ok: false, errors });
    }

    // ✅ AGREGAR: Retry a la consulta de valores anteriores
    const previousResult = await retryWithJitter(
      async () => {
        if (!dynamoBreaker.shouldAllow()) {
          throw new Error("CircuitBreakerOpen");
        }
        const res = await docClient.send(new QueryCommand({
          TableName: process.env.PARAMETERS_TABLE,
          KeyConditionExpression: "user_sub = :userSub",
          ExpressionAttributeValues: { ":userSub": userSub }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const previousValues = {};
    (previousResult.Items || []).forEach(item => {
      previousValues[item.parameter_key] = item.parameter_value;
    });

    const timestamp = new Date().toISOString();
    const savedParameters = [];

    for (const [key, value] of Object.entries(validParameters)) {
      if (!dynamoBreaker.shouldAllow()) {
        console.warn("⚠️ Circuit breaker abierto (DynamoDB), escritura omitida temporalmente.");
        throw new Error("CircuitBreakerOpen");
      }

      await retryWithJitter(
        async () => {
          await docClient.send(new PutCommand({
            TableName: process.env.PARAMETERS_TABLE,
            Item: {
              user_sub: userSub,
              parameter_key: key,
              parameter_value: value,
              updated_at: timestamp,
              email: userEmail
            }
          }));
          dynamoBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );

      savedParameters.push({
        key,
        value,
        previousValue: previousValues[key] || null
      });
    }

    // ✅ Marcar como procesado DESPUÉS de escritura exitosa
    await markAsProcessed(idempotencyKey);

    await publishPersonalizationEvent('PERSONALIZATION_UPDATED', {
      userSub,
      userEmail,
      updatedParameters: savedParameters,
      timestamp,
      idempotencyKey  // ✅ Agregar para trazabilidad
    });

    const updatedResult = await module.exports.getPersonalization(event);
    const finalParameters = JSON.parse(updatedResult.body).final_parameters;

    return response(200, {
      ok: true,
      message: "Parámetros de personalización actualizados",
      saved_parameters: savedParameters,
      final_parameters: finalParameters
    });

  } catch (err) {
    console.error("Error en setPersonalization:", err);
    return response(500, { 
      ok: false, 
      error: "Error interno del servidor",
      details: err.message
    });
  }
};

/**
 * Validación de valor del parámetro
 */
function validateParameter(key, value) {
  const config = PERSONALIZATION_PARAMETERS[key];
  if (!config) return false;
  
  switch (config.type) {
    case 'select':
    case 'color':
      return config.options.includes(value);
    case 'number':
      const num = Number(value);
      return !isNaN(num) && num >= config.min && num <= config.max;
    default:
      return true;
  }
}

/**
 * Respuesta HTTP estandarizada
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}