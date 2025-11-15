// src/handlers/personalization.js
const config = require('../../config/config');

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse, unauthorizedResponse, validationErrorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'personalization' });
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
      logger.warn("Circuit breaker abierto para SNS", { eventType });
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

    logger.info("Evento SNS publicado", { eventType, eventId });
    return true;

  } catch (error) {
    snsBreaker.reportFailure();
    logger.error("Error publicando evento SNS", error, { eventType });
    return false;
  }
}

/**
 * GET /personalization
 * Obtener parámetros globales y específicos del usuario
 */
module.exports.getPersonalization = async (event) => {
  const endTrace = logger.startTrace('getPersonalization');

  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userSub) {
      logger.warn("Intento sin usuario autenticado");
      endTrace();
      return unauthorizedResponse("Usuario no autenticado");
    }

    logger.info("Obteniendo personalización", { userSub, userEmail });

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

    logger.info("Personalización obtenida", { 
      userSub, 
      userParamsCount: Object.keys(userParameters).length,
      totalParams: Object.keys(finalParameters).length
    });
    endTrace();

    return successResponse({
      user_sub: userSub,
      email: userEmail,
      global_parameters: globalParameters,
      user_parameters: userParameters,
      final_parameters: finalParameters,
      available_parameters: PERSONALIZATION_PARAMETERS
    });

  } catch (err) {
    logger.error("Error obteniendo personalización", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500, { details: err.message });
  }
};

const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

/**
 * POST /personalization
 * Establecer parámetros específicos del usuario
 */
module.exports.setPersonalization = async (event) => {
  const endTrace = logger.startTrace('setPersonalization');

  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userSub) {
      logger.warn("Intento sin usuario autenticado");
      endTrace();
      return unauthorizedResponse("Usuario no autenticado");
    }

    const { parameters } = JSON.parse(event.body || "{}");

    if (!parameters || typeof parameters !== 'object') {
      logger.warn("Parámetros inválidos en setPersonalization", { received: typeof parameters });
      endTrace();
      return errorResponse("parameters es obligatorio y debe ser un objeto", 400);
    }

    const paramsHash = require('crypto')
      .createHash('sha256')
      .update(JSON.stringify(parameters))
      .digest('hex')
      .substring(0, 16);

    const timestamp = new Date().toISOString();
    const idempotencyKey = `setPersonalization-${userSub}-${paramsHash}-${timestamp}`;
    
    if (await wasAlreadyProcessed(idempotencyKey)) {
      logger.info("Actualización ya procesada (idempotencia)", { idempotencyKey });
      
      // Retornar el estado actual
      const currentState = await module.exports.getPersonalization(event);
      const currentBody = JSON.parse(currentState.body);
      endTrace();
      
      return successResponse({
        message: "Parámetros ya estaban actualizados",
        final_parameters: currentBody.data.final_parameters,
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
      logger.warn("Validación fallida en parámetros", { errors });
      endTrace();
      return validationErrorResponse(errors);
    }

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

    const savedParameters = [];

    for (const [key, value] of Object.entries(validParameters)) {
      if (!dynamoBreaker.shouldAllow()) {
        logger.warn("Circuit breaker abierto - escritura pausada");
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

    await markAsProcessed(idempotencyKey);

    await publishPersonalizationEvent('PERSONALIZATION_UPDATED', {
      userSub,
      userEmail,
      updatedParameters: savedParameters,
      timestamp,
      idempotencyKey
    });

    const updatedResult = await module.exports.getPersonalization(event);
    const updatedBody = JSON.parse(updatedResult.body);

    logger.info("Parámetros de personalización actualizados", { 
      userSub, 
      updatedCount: savedParameters.length 
    });
    endTrace();

    return successResponse({
      message: "Parámetros de personalización actualizados",
      saved_parameters: savedParameters,
      final_parameters: updatedBody.data.final_parameters
    });

  } catch (err) {
    logger.error("Error en setPersonalization", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500, { details: err.message });
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
