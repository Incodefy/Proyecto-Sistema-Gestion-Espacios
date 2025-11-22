// aws/src/handlers/ocupantes/deleteOcupante.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] DELETE /groups/{grupo_id}/ocupantes/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const ocupanteId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Ocupante ID:`, ocupanteId);
    
    if (!grupo_id || !ocupanteId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id y ocupante id son requeridos",
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que el ocupante existe antes de eliminar
    const getResult = await db.send(
      new GetCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        }
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Ocupante no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    await db.send(
      new DeleteCommand({
        TableName: process.env.OCCUPANTS_TABLE,
        Key: {
          PK: grupo_id,
          SK: `OCCUPANT#${ocupanteId}`
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Ocupante eliminado: ${ocupanteId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: "Ocupante eliminado exitosamente",
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error eliminando ocupante:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al eliminar ocupante",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
