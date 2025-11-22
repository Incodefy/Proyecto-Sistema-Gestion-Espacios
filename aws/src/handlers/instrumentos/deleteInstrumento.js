// aws/src/handlers/instrumentos/deleteInstrumento.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] DELETE /groups/{grupo_id}/instrumentos/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const instrumentoId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Instrumento ID:`, instrumentoId);
    
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

    await db.send(
      new DeleteCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `INST#${instrumentoId}`
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Instrumento eliminado: ${instrumentoId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: "Instrumento eliminado correctamente",
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error eliminando instrumento:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al eliminar instrumento",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
