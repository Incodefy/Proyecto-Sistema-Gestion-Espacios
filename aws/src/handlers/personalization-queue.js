// src/handlers/personalization.js - VERSIÓN CON COLAS
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

// Parámetros disponibles para personalización
const PERSONALIZATION_PARAMETERS = {
  "theme.mode": { 
    type: "select", 
    options: ["light", "dark"], 
    default: "light",
    name: "Modo de tema"
  },
  "theme.primary_color": { 
    type: "color", 
    options: ["#1a3c7c", "#d53232ff", "#059669", "#7c3aed", "#ea580c"], 
    default: "#1a3c7c",
    name: "Color principal"
  },
  "locale.language": { 
    type: "select", 
    options: ["es", "en"], 
    default: "es",
    name: "Idioma"
  }
};

const getGlobalParameters = () => ({
  "theme.mode": "light",
  "theme.primary_color": "#1a3c7c", 
  "locale.language": "es"
});

const generateColorVariants = (primaryColor) => {
  const colorVariants = {
    "#1a3c7c": { light: "#375ca1", dark: "#142c59" },
    "#d53232ff": { light: "#e76464ff", dark: "#ad2424ff" },
    "#059669": { light: "#1ec78fff", dark: "#068d67ff" },
    "#7c3aed": { light: "#946cf2ff", dark: "#6028bbff" },
    "#ea580c": { light: "#f3893dff", dark: "#c25125ff" }
  };
  return colorVariants[primaryColor] || { light: primaryColor + "cc", dark: primaryColor + "dd" };
};

/**
 * GET /personalization - Sin cambios
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

    const colorVariants = generateColorVariants(finalParameters['theme.primary_color']);
    finalParameters['theme.primary_color_light'] = colorVariants.light;
    finalParameters['theme.primary_color_dark'] = colorVariants.dark;

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
    console.error("Error getting personalization:", err);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * POST /personalization - NUEVA VERSIÓN CON COLA
 * Ya no guarda directamente, sino que publica evento en SQS
 */
module.exports.setPersonalizationWithQueue = async (event) => {
  try {
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    const { parameters } = JSON.parse(event.body || "{}");
    
    if (!userSub) {
      return response(401, { ok: false, error: "Usuario no autenticado" });
    }

    if (!parameters || typeof parameters !== 'object') {
      return response(400, { ok: false, error: "parameters es obligatorio" });
    }

    // Validar parámetros
    const validParameters = {};
    const errors = [];
    
    Object.entries(parameters).forEach(([key, value]) => {
      if (PERSONALIZATION_PARAMETERS[key]) {
        if (validateParameter(key, value)) {
          validParameters[key] = value;
        } else {
          errors.push(`Valor inválido para ${key}: ${value}`);
        }
      } else {
        errors.push(`Parámetro no permitido: ${key}`);
      }
    });

    if (errors.length > 0) {
      return response(400, { ok: false, errors });
    }

    // Crear evento para la cola
    const eventMessage = {
      eventType: "personalization.update.requested",
      eventId: `${userSub}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: userSub,
      userEmail: userEmail,
      parameters: validParameters,
      metadata: {
        source: "api",
        requestId: event.requestContext?.requestId,
        userAgent: event.headers?.["user-agent"]
      }
    };

    // Publicar evento en SQS
    console.log("📤 Enviando evento a SQS:", eventMessage);
    
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: process.env.PERSONALIZATION_QUEUE_URL,
      MessageBody: JSON.stringify(eventMessage),
      MessageAttributes: {
        eventType: {
          StringValue: eventMessage.eventType,
          DataType: "String"
        },
        userId: {
          StringValue: userSub,
          DataType: "String"
        }
      }
    }));

    return response(202, {
      ok: true,
      message: "Solicitud de actualización enviada a procesamiento",
      event_id: eventMessage.eventId,
      queued: true,
      parameters_count: Object.keys(validParameters).length
    });

  } catch (err) {
    console.error("Error queuing personalization update:", err);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * WORKER SQS - Procesa eventos de personalización
 */
module.exports.processPersonalizationEvent = async (event) => {
  console.log("🔄 Worker procesando eventos:", event.Records?.length || 0);

  const results = [];
  
  for (const record of event.Records || []) {
    try {
      const message = JSON.parse(record.body);
      console.log("📨 Procesando mensaje:", message.eventType, message.eventId);

      const result = await processPersonalizationMessage(message);
      results.push({ messageId: record.messageId, success: true, result });
      
    } catch (err) {
      console.error("❌ Error procesando mensaje:", record.messageId, err);
      results.push({ messageId: record.messageId, success: false, error: err.message });
      
      // Re-throw para que SQS reintente o envíe a DLQ
      throw err;
    }
  }

  console.log("✅ Worker completado:", results.length, "mensajes procesados");
  return { processedMessages: results };
};

/**
 * Función que realiza el procesamiento real de personalización
 */
async function processPersonalizationMessage(message) {
  const { eventType, userId, userEmail, parameters, timestamp, eventId } = message;
  
  console.log(`🎨 Procesando ${eventType} para usuario ${userEmail}`);

  // 1. Guardar parámetros en DynamoDB
  const savedParameters = [];
  const updateTimestamp = new Date().toISOString();

  for (const [key, value] of Object.entries(parameters)) {
    await docClient.send(new PutCommand({
      TableName: process.env.PARAMETERS_TABLE,
      Item: {
        user_sub: userId,
        parameter_key: key,
        parameter_value: value,
        updated_at: updateTimestamp,
        event_id: eventId
      }
    }));
    savedParameters.push({ key, value });
  }

  // 2. Realizar acciones adicionales (esto es lo valioso del desacoplamiento)
  await performAdditionalActions(message, savedParameters);

  console.log(`✅ Personalización actualizada para ${userEmail}:`, savedParameters.length, "parámetros");
  
  return {
    userId,
    userEmail,
    savedParameters,
    processedAt: updateTimestamp,
    eventId
  };
}

/**
 * Acciones adicionales que se ejecutan tras actualizar personalización
 * Aquí es donde se ve el valor del desacoplamiento
 */
async function performAdditionalActions(message, savedParameters) {
  const { userId, userEmail, parameters } = message;

  // Acción 1: Log de auditoría
  console.log("📊 Registrando en auditoría:", { userId, userEmail, changes: savedParameters.length });
  
  // Acción 2: Invalidar cache (simulado)
  console.log("🗑️ Invalidando cache de personalización para:", userId);
  
  // Acción 3: Notificar a analytics (simulado)
  if (parameters['theme.mode']) {
    console.log("📈 Enviando evento a analytics - cambio de tema:", parameters['theme.mode']);
  }
  
  // Acción 4: Notificar cambios críticos
  if (parameters['locale.language']) {
    console.log("🌐 Cambio de idioma detectado, notificando sistemas dependientes");
  }
  
  // Acción 5: Webhooks o integraciones externas (simulado)
  console.log("🔗 Ejecutando webhooks de personalización");

  // En un sistema real, aquí podrías:
  // - Enviar notificaciones push
  // - Actualizar sistemas de recomendaciones
  // - Sincronizar con otros microservicios
  // - Generar reportes
  // - Enviar emails de confirmación
}

/**
 * WORKER DLQ - Maneja mensajes que fallaron múltiples veces
 */
module.exports.processDLQMessage = async (event) => {
  console.log("💀 Procesando mensajes de DLQ:", event.Records?.length || 0);
  
  for (const record of event.Records || []) {
    try {
      const message = JSON.parse(record.body);
      console.error("💀 Mensaje fallido múltiples veces:", message.eventId);
      
      // Acciones para mensajes fallidos:
      // 1. Registrar en logs de errores
      // 2. Notificar a administradores
      // 3. Intentar procesamiento manual
      // 4. Guardar en tabla de errores para investigación
      
      console.log("📧 Notificando administradores sobre fallo en personalización");
      
    } catch (err) {
      console.error("❌ Error incluso procesando DLQ:", err);
    }
  }
  
  return { dlqMessagesProcessed: event.Records?.length || 0 };
};

/**
 * Función para validar parámetro
 */
function validateParameter(key, value) {
  const config = PERSONALIZATION_PARAMETERS[key];
  if (!config) return false;
  
  switch (config.type) {
    case 'select':
      return config.options.includes(value);
    case 'color':
      return config.options.includes(value);
    default:
      return true;
  }
}

/**
 * Función auxiliar para respuestas HTTP
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body)
  };
}