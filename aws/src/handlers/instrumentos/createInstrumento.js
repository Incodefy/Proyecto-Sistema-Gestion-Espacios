// aws/src/handlers/instrumentos/createInstrumento.js
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const createInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('createInstrumento', { ...body, grupo_id });
  
  const instrumentoId = crypto.randomUUID().substring(0, 8);
  const now = new Date().toISOString();
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  await retryDB(
    () => db.send(new PutCommand({
      TableName: process.env.INSTRUMENTOS_TABLE,
      Item: {
        PK: grupo_id,
        SK: `INST#${instrumentoId}`,
        nombre: body.nombre.trim(),
        tipo_instrumento_id: `TIPO_INST#${body.tipo_instrumento_id}`,
        created_at: now,
        updated_at: now,
        created_by: userSub
      }
    })),
    { operation: 'createInstrumento' }
  );
  
  logger.info('Instrumento creado', { instrumentoId });
  
  return {
    statusCode: 201,
    body: JSON.stringify({ ok: true, instrumento: { id: instrumentoId, nombre: body.nombre.trim(), tipo_instrumento_id: body.tipo_instrumento_id, grupo_id, created_at: now } })
  };
};

module.exports.handler = createAPIHandler(createInstrumento, { rateLimit: { maxRequests: 25, windowSeconds: 60 } });

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /groups/{grupo_id}/instrumentos | ${TRACE_ID} ===`);
  
  try {
    // Sanitizar evento
    const sanitized = sanitizeEvent(event);
    const userSub = sanitized.requestContext.authorizer.jwt.claims.sub;
    
    // Rate limiting: 25 instrumentos por minuto por usuario
    const rateLimitCheck = await checkRateLimit(userSub, 25, 60, 'create-instrumento');
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
    
    const grupo_id = sanitized.pathParameters?.grupo_id;
    const body = JSON.parse(sanitized.body || "{}");
    
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

    if (!body.nombre || !body.nombre.trim()) {
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre del instrumento es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Validar longitud máxima del nombre (100 caracteres)
    if (body.nombre.trim().length > 100) {
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre no puede exceder 100 caracteres",
          trace_id: TRACE_ID
        })
      };
    }

    if (!body.tipo_instrumento_id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El tipo de instrumento es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    const instrumentoId = crypto.randomUUID().substring(0, 8);
    const now = new Date().toISOString();

    await db.send(
      new PutCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        Item: {
          PK: grupo_id,
          SK: `INST#${instrumentoId}`,
          nombre: body.nombre.trim(),
          tipo_instrumento_id: `TIPO_INST#${body.tipo_instrumento_id}`,
          created_at: now,
          updated_at: now,
          created_by: userSub
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Instrumento creado: ${instrumentoId}`);

    return {
      statusCode: 201,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: true,
        instrumento: {
          id: instrumentoId,
          nombre: body.nombre.trim(),
          tipo_instrumento_id: body.tipo_instrumento_id,
          grupo_id,
          created_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando instrumento:`, error);
    
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al crear instrumento",
        trace_id: TRACE_ID
      })
    };
  }
};
