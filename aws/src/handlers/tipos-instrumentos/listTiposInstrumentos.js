// aws/src/handlers/tipos-instrumentos/listTiposInstrumentos.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");

const tiposCache = new Cache({ ttl: 300, maxSize: 200 });

const listTiposInstrumentos = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listTiposInstrumentos' });
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('listTiposInstrumentos', { grupo_id });
  
  const cacheKey = `tipos:${grupo_id}`;
  const cached = tiposCache.get(cacheKey);
  if (cached) {
    logger.info('Tipos desde cache', { count: cached.length });
    return { statusCode: 200, body: JSON.stringify({ ok: true, tipos: cached, count: cached.length, cached: true }) };
  }
  
  const result = await retryDB(
    () => db.send(new QueryCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":gid": grupo_id, ":prefix": "TIPO_INST#" }
    })),
    { operation: 'listTiposInstrumentos' }
  );
  
  const tipos = (result.Items || []).map(item => ({
    id: item.SK.replace('TIPO_INST#', ''),
    nombre: item.nombre,
    grupo_id: item.PK,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
  
  tiposCache.set(cacheKey, tipos);
  logger.info('Tipos obtenidos y cacheados', { count: tipos.length });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, tipos, count: tipos.length }) };
};

module.exports.handler = createAPIHandler(listTiposInstrumentos, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] GET /groups/{grupo_id}/tipos-instrumentos | ${TRACE_ID} ===`);
  
  try {
    // Sanitizar evento
    const sanitized = sanitizeEvent(event);
    const userSub = sanitized.requestContext.authorizer.jwt.claims.sub;
    const grupo_id = sanitized.pathParameters?.grupo_id;
    
    // Rate limiting: 100 solicitudes por minuto por usuario
    const rateLimitCheck = await checkRateLimit(userSub, 100, 60, 'list-tipos-instrumentos');
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ 
          ok: false, 
          error: 'Demasiadas solicitudes. Intente más tarde.',
          trace_id: TRACE_ID
        })
      };
    }
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    
    if (!grupo_id) {
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Consultar tipos de instrumentos del grupo
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
        KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":gid": grupo_id,
          ":prefix": "TIPO_INST#"
        }
      })
    );

    const tipos = (result.Items || []).map(item => ({
      id: item.SK.replace('TIPO_INST#', ''),
      nombre: item.nombre,
      grupo_id: item.PK,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    console.log(`[${TRACE_ID}] ✅ Tipos de instrumentos encontrados:`, tipos.length);

    return {
      statusCode: 200,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: true, 
        tipos,
        count: tipos.length,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error listando tipos de instrumentos:`, error);
    
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al obtener tipos de instrumentos",
        trace_id: TRACE_ID
      })
    };
  }
};
