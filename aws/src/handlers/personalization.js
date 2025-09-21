// src/handlers/personalization.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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

// Parámetros globales (configuración por defecto de la organización)
const getGlobalParameters = () => ({
  "theme.mode": "light",
  "theme.primary_color": "#1a3c7c", 
  "locale.language": "es"
});

// Función para generar colores derivados del color principal
const generateColorVariants = (primaryColor) => {
  const colorVariants = {
    "#1a3c7c": {
      light: "#375ca1",
      dark: "#142c59"
    },
    "#d53232ff": {
      light: "#e76464ff", 
      dark: "#ad2424ff"
    },
    "#059669": {
      light: "#1ec78fff",
      dark: "#068d67ff"
    },
    "#7c3aed": {
      light: "#946cf2ff",
      dark: "#6028bbff"
    },
    "#ea580c": {
      light: "#f3893dff",
      dark: "#c25125ff"
    }
  };

  return colorVariants[primaryColor] || {
    light: primaryColor + "cc",
    dark: primaryColor + "dd"
  };
};

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

    // Obtener parámetros específicos del usuario
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.PARAMETERS_TABLE,
      KeyConditionExpression: "user_sub = :userSub",
      ExpressionAttributeValues: {
        ":userSub": userSub
      }
    }));

    // Convertir parámetros del usuario a objeto
    const userParameters = {};
    (result.Items || []).forEach(item => {
      userParameters[item.parameter_key] = item.parameter_value;
    });

    // Parámetros globales de la organización
    const globalParameters = getGlobalParameters();

    // Parámetros finales: globales sobrescritos por usuario
    const finalParameters = {
      ...globalParameters,
      ...userParameters
    };

    // Aplicar valores por defecto a parámetros no configurados
    Object.entries(PERSONALIZATION_PARAMETERS).forEach(([key, config]) => {
      if (!(key in finalParameters)) {
        finalParameters[key] = config.default;
      }
    });

    // Generar colores derivados
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
 * POST /personalization
 * Establecer parámetros específicos del usuario
 */
module.exports.setPersonalization = async (event) => {
  try {
    console.log("📝 Recibiendo petición:", JSON.stringify(event, null, 2));
    
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    console.log("👤 Usuario:", { userSub, userEmail });
    
    let requestBody;
    
    try {
      requestBody = JSON.parse(event.body || "{}");
      console.log("📦 Body parseado:", requestBody);
    } catch (e) {
      console.error("❌ Error parseando body:", e);
      return response(400, { ok: false, error: "Body inválido" });
    }

    const { parameters } = requestBody;
    
    if (!userSub) {
      console.error("❌ Usuario no autenticado");
      return response(401, { ok: false, error: "Usuario no autenticado" });
    }

    if (!parameters || typeof parameters !== 'object') {
      console.error("❌ Parámetros inválidos:", parameters);
      return response(400, { ok: false, error: "parameters es obligatorio y debe ser un objeto" });
    }

    // Validar parámetros
    const validParameters = {};
    const errors = [];
    
    console.log("🔍 Validando parámetros:", parameters);
    
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
      console.error("❌ Errores de validación:", errors);
      return response(400, { ok: false, errors });
    }

    // Guardar parámetros válidos
    const timestamp = new Date().toISOString();
    const savedParameters = [];

    console.log("💾 Guardando parámetros en DynamoDB...");
    console.log("📊 Tabla:", process.env.PARAMETERS_TABLE);

    for (const [key, value] of Object.entries(validParameters)) {
      console.log(`💾 Guardando ${key}: ${value}`);
      
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
      savedParameters.push({ key, value });
    }

    console.log("✅ Parámetros guardados:", savedParameters);

    // Obtener los parámetros actualizados
    const updatedParameters = await module.exports.getPersonalization(event);
    const finalParameters = JSON.parse(updatedParameters.body).final_parameters;

    return response(200, {
      ok: true,
      message: "Parámetros de personalización actualizados",
      saved_parameters: savedParameters,
      updated_count: savedParameters.length,
      final_parameters: finalParameters
    });

  } catch (err) {
    console.error("❌ Error en setPersonalization:", err);
    console.error("❌ Stack trace:", err.stack);
    return response(500, { 
      ok: false, 
      error: "Error interno del servidor",
      details: err.message
    });
  }
};

/**
 * Validar valor de parámetro
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