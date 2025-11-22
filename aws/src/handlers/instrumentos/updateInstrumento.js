// aws/src/handlers/instrumentos/updateInstrumento.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /groups/{grupo_id}/instrumentos/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const instrumentoId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Instrumento ID:`, instrumentoId);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!grupo_id || !instrumentoId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id y instrumento id son requeridos",
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

    // Verificar que el instrumento existe
    const getResult = await db.send(
      new GetCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `INST#${instrumentoId}`
        }
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Instrumento no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    const now = new Date().toISOString();
    let updateExpression = "SET nombre = :nombre, updated_at = :updated";
    let expressionValues = {
      ":nombre": body.nombre.trim(),
      ":updated": now
    };

    // Actualizar tipo si se proporciona
    if (body.tipo_instrumento_id) {
      updateExpression += ", tipo_instrumento_id = :tipo";
      expressionValues[":tipo"] = `TIPO_INST#${body.tipo_instrumento_id}`;
    }

    await db.send(
      new UpdateCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `INST#${instrumentoId}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues
      })
    );

    console.log(`[${TRACE_ID}] ✅ Instrumento actualizado: ${instrumentoId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        instrumento: {
          id: instrumentoId,
          nombre: body.nombre.trim(),
          tipo_instrumento_id: body.tipo_instrumento_id,
          grupo_id,
          updated_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando instrumento:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar instrumento",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
