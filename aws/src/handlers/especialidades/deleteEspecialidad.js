// aws/src/handlers/especialidades/deleteEspecialidad.js
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] DELETE /groups/{grupo_id}/especialidades/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const especialidadId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Especialidad ID:`, especialidadId);
    
    if (!grupo_id || !especialidadId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id y especialidad id son requeridos",
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que la especialidad existe antes de eliminar
    const getResult = await db.send(
      new GetCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        }
      })
    );

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Especialidad no encontrada",
          trace_id: TRACE_ID
        })
      };
    }

    await db.send(
      new DeleteCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Especialidad eliminada: ${especialidadId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: "Especialidad eliminada exitosamente",
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error eliminando especialidad:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al eliminar especialidad",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
