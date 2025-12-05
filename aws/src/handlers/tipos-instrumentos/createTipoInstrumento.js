// aws/src/handlers/tipos-instrumentos/createTipoInstrumento.js
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const createTipoInstrumento = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createTipoInstrumento' });
  const body = JSON.parse(event.body || "{}");
  const grupo_id = event.pathParameters?.grupo_id;
  
  validate('createTipoInstrumento', { ...body, grupo_id });
  
  const tipoId = crypto.randomUUID().substring(0, 8);
  const now = new Date().toISOString();
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  
  await retryDB(
    () => db.send(new PutCommand({
      TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
      Item: {
        PK: grupo_id,
        SK: `TIPO_INST#${tipoId}`,
        nombre: body.nombre.trim(),
        created_at: now,
        updated_at: now,
        created_by: userSub
      }
    })),
    { operation: 'createTipoInstrumento' }
  );
  
  logger.info('Tipo de instrumento creado', { tipoId });
  
  return {
    statusCode: 201,
    body: JSON.stringify({ ok: true, tipo: { id: tipoId, nombre: body.nombre.trim(), grupo_id, created_at: now } })
  };
};

module.exports.handler = createAPIHandler(createTipoInstrumento, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /groups/{grupo_id}/tipos-instrumentos | ${TRACE_ID} ===`);
  
  try {
    // Sanitizar evento
    const sanitized = sanitizeEvent(event);
    const userSub = sanitized.requestContext.authorizer.jwt.claims.sub;
    
    // Rate limiting: 20 tipos por minuto por usuario
    const rateLimitCheck = await checkRateLimit(userSub, 20, 60, 'create-tipo-instrumento');
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
          error: "El nombre del tipo de instrumento es requerido",
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

    const tipoId = crypto.randomUUID().substring(0, 8);
    const now = new Date().toISOString();

    await db.send(
      new PutCommand({
        TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
        Item: {
          PK: grupo_id,
          SK: `TIPO_INST#${tipoId}`,
          nombre: body.nombre.trim(),
          created_at: now,
          updated_at: now,
          created_by: userSub
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Tipo de instrumento creado: ${tipoId}`);

    return {
      statusCode: 201,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: true,
        tipo: {
          id: tipoId,
          nombre: body.nombre.trim(),
          grupo_id,
          created_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando tipo de instrumento:`, error);
    
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al crear tipo de instrumento",
        trace_id: TRACE_ID
      })
    };
  }
};
