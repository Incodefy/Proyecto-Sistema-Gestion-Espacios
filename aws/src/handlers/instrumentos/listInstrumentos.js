// aws/src/handlers/instrumentos/listInstrumentos.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");

const instrumentosCache = new Cache({ ttl: 240, maxSize: 300 });

const listInstrumentos = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listInstrumentos' });
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('listInstrumentos', { grupo_id });
  
  const cacheKey = `instrumentos:${grupo_id}`;
  const cached = instrumentosCache.get(cacheKey);
  if (cached) {
    logger.info('Instrumentos desde cache', { count: cached.length });
    return { statusCode: 200, body: JSON.stringify({ ok: true, instrumentos: cached, count: cached.length, cached: true }) };
  }
  
  const result = await retryDB(
    () => db.send(new QueryCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":gid": grupo_id, ":prefix": "INST#" }
    })),
    { operation: 'listInstrumentos' }
  );
  
  const instrumentos = (result.Items || []).map(item => ({
    id: item.SK.replace('INST#', ''),
    nombre: item.nombre,
    tipo_instrumento_id: item.tipo_instrumento_id?.replace('TIPO_INST#', '') || '',
    grupo_id: item.PK,
    created_at: item.created_at,
    updated_at: item.updated_at
  }));
  
  instrumentosCache.set(cacheKey, instrumentos);
  logger.info('Instrumentos obtenidos y cacheados', { count: instrumentos.length });
  
  return { statusCode: 200, body: JSON.stringify({ ok: true, instrumentos, count: instrumentos.length }) };
};

module.exports.handler = createAPIHandler(listInstrumentos, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] GET /groups/{grupo_id}/instrumentos | ${TRACE_ID} ===`);
  
  try {
    // Sanitizar evento
    const sanitized = sanitizeEvent(event);
    const userSub = sanitized.requestContext.authorizer.jwt.claims.sub;
    const grupo_id = sanitized.pathParameters?.grupo_id;
    
    // Rate limiting: 100 solicitudes por minuto por usuario
    const rateLimitCheck = await checkRateLimit(userSub, 100, 60, 'list-instrumentos');
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

    // Consultar instrumentos del grupo
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":gid": grupo_id,
          ":prefix": "INST#"
        }
      })
    );

    const instrumentos = (result.Items || []).map(item => ({
      id: item.SK.replace('INST#', ''),
      nombre: item.nombre,
      tipo_instrumento_id: item.tipo_instrumento_id?.replace('TIPO_INST#', '') || '',
      grupo_id: item.PK,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    console.log(`[${TRACE_ID}] ✅ Instrumentos encontrados:`, instrumentos.length);

    return {
      statusCode: 200,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: true, 
        instrumentos,
        count: instrumentos.length,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error listando instrumentos:`, error);
    
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al obtener instrumentos",
        trace_id: TRACE_ID
      })
    };
  }
};
