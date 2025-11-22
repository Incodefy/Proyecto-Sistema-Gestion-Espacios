// aws/src/handlers/instrumentos/createInstrumento.js
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /groups/{grupo_id}/instrumentos | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!grupo_id) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre del instrumento es requerido",
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al crear instrumento",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
