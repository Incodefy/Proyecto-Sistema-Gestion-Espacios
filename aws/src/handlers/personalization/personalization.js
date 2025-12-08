// src/handlers/personalization.js
const config = require('../../config/config');

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const { validate } = require("../../utils/validator");
const { successResponse, errorResponse } = require("../../utils/errorHandler");
const { Logger } = require("../../utils/logger");
const { createAPIHandler } = require("../../middleware/interceptors");
const { AuthorizationError, ValidationError } = require("../../utils/errorHandler");
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");

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

// Publicar eventos a SNS directamente
async function publishPersonalizationEvent(eventType, data, logger = console) {
  const eventId = `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const message = {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      data
    };

    const command = new PublishCommand({
      TopicArn: process.env.PERSONALIZATION_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: `Personalization Event: ${eventType}`
    });

    await snsClient.send(command);

    if (logger && logger.info) {
      logger.info("Evento SNS publicado", { eventType, eventId });
    } else {
      console.log("Evento SNS publicado", { eventType, eventId });
    }
    return true;

  } catch (error) {
    if (logger && logger.error) {
      logger.error("Error publicando evento SNS", error, { eventType });
    } else {
      console.error("Error publicando evento SNS", error, { eventType });
    }
    return false;
  }
}

async function getPersonalizationHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
  
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");
  
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
    
    console.log('🎨 GET - Variantes generadas:', {
      primary: finalParameters['theme.primary_color'],
      light: colorVariants.light,
      dark: colorVariants.dark
    });

    await publishPersonalizationEvent('PERSONALIZATION_REQUESTED', {
      userSub,
      userEmail,
      parametersCount: Object.keys(userParameters).length
    }, logger);

  logger.info("Personalización obtenida", { 
    userSub, 
    userParamsCount: Object.keys(userParameters).length,
    totalParams: Object.keys(finalParameters).length
  });

  return successResponse({
    user_sub: userSub,
    email: userEmail,
    global_parameters: globalParameters,
    user_parameters: userParameters,
    final_parameters: finalParameters,
    available_parameters: PERSONALIZATION_PARAMETERS
  });
}

module.exports.getPersonalization = createAPIHandler(getPersonalizationHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });

const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

async function setPersonalizationHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
  
  if (!userSub) throw new AuthorizationError("Usuario no autenticado");
  
  const { parameters } = JSON.parse(event.body || "{}");

  if (!parameters || typeof parameters !== 'object') {
    throw new ValidationError("parameters es obligatorio y debe ser un objeto");
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
      
      return successResponse({
        message: "Parámetros ya estaban actualizados",
        final_parameters: currentBody.final_parameters,
        already_processed: true
      });
    }

    const validParameters = {};
    const errors = [];
    
    console.log('🔍 PERSONALIZATION POST - Parámetros recibidos:', JSON.stringify(parameters, null, 2));
    
    for (const [key, value] of Object.entries(parameters)) {
      if (PERSONALIZATION_PARAMETERS[key]) {
        console.log(`📝 Validando ${key}:`, {
          value,
          type: PERSONALIZATION_PARAMETERS[key].type,
          options: PERSONALIZATION_PARAMETERS[key].options
        });
        
        if (validateParameter(key, value)) {
          // Normalizar colores a minúsculas antes de guardar
          if (PERSONALIZATION_PARAMETERS[key].type === 'color') {
            const normalized = value.toLowerCase();
            validParameters[key] = normalized;
            console.log(`✅ Color validado y normalizado: ${value} → ${normalized}`);
          } else {
            validParameters[key] = value;
            console.log(`✅ Parámetro validado: ${key} = ${value}`);
          }
        } else {
          console.log(`❌ Validación fallida para ${key}: ${value}`);
          errors.push(`Valor inválido para ${key}: ${value}`);
        }
      } else {
        console.log(`❌ Parámetro no permitido: ${key}`);
        errors.push(`Parámetro no permitido: ${key}`);
      }
    }
    
    console.log('📦 Parámetros válidos finales:', JSON.stringify(validParameters, null, 2));

    if (errors.length > 0) {
      logger.warn("Validación fallida en parámetros", { errors });
      throw new ValidationError(`Parámetros inválidos: ${errors.join(', ')}`);
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

      // ✅ VALIDACIÓN AJV antes de cada PutCommand
      const item = {
        user_sub: userSub,
        parameter_key: key,
        parameter_value: value
      };

      const validationResult = validate('personalizationParameter', item, logger);
      if (!validationResult.valid) {
        logger.warn('Validación fallida para parámetro personalización', { errors: validationResult.errors, item });
        throw new Error(`Validation failed for parameter ${key}: ${validationResult.errors}`);
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
    }, logger);

    const updatedResult = await module.exports.getPersonalization(event);
    const updatedBody = JSON.parse(updatedResult.body);

    logger.info("Parámetros de personalización actualizados", { 
      userSub, 
      updatedCount: savedParameters.length 
    });

    return successResponse({
      message: "Parámetros de personalización actualizados",
      saved_parameters: savedParameters,
      final_parameters: updatedBody.final_parameters
    });
}

module.exports.setPersonalization = createAPIHandler(setPersonalizationHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });

/**
 * Validación de valor del parámetro
 */
function validateParameter(key, value) {
  const config = PERSONALIZATION_PARAMETERS[key];
  if (!config) return false;
  
  switch (config.type) {
    case 'select':
      return config.options.includes(value);
    case 'color':
      // Normalizar color a minúsculas para comparación case-insensitive
      const normalizedValue = typeof value === 'string' ? value.toLowerCase() : value;
      const normalizedOptions = config.options.map(opt => opt.toLowerCase());
      return normalizedOptions.includes(normalizedValue);
    case 'number':
      const num = Number(value);
      return !isNaN(num) && num >= config.min && num <= config.max;
    default:
      return true;
  }
}
