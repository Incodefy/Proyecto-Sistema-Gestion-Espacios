// aws/src/handlers/tipos-instrumentos/updateTipoInstrumento.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /groups/{grupo_id}/tipos-instrumentos/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const tipoId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Tipo ID:`, tipoId);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!grupo_id || !tipoId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id y tipo id son requeridos",
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
          error: "El nombre del tipo de instrumento es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que el tipo existe
    const getResult = await db.send(
      new GetCommand({
        TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `TIPO_INST#${tipoId}`
        }
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Tipo de instrumento no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    const now = new Date().toISOString();

    await db.send(
      new UpdateCommand({
        TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `TIPO_INST#${tipoId}`
        },
        UpdateExpression: "SET nombre = :nombre, updated_at = :updated",
        ExpressionAttributeValues: {
          ":nombre": body.nombre.trim(),
          ":updated": now
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Tipo de instrumento actualizado: ${tipoId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        tipo: {
          id: tipoId,
          nombre: body.nombre.trim(),
          grupo_id,
          updated_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando tipo de instrumento:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar tipo de instrumento",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
