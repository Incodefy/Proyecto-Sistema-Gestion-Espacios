// aws/src/handlers/especialidades/updateEspecialidad.js
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /groups/{grupo_id}/especialidades/{id} | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const especialidadId = event.pathParameters?.id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    console.log(`[${TRACE_ID}] 🆔 Especialidad ID:`, especialidadId);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
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

    if (!body.nombre || !body.nombre.trim()) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre de la especialidad es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Verificar que la especialidad existe
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

    const now = new Date().toISOString();

    await db.send(
      new UpdateCommand({
        TableName: process.env.ESPECIALIDADES_TABLE,
        Key: {
          PK: grupo_id,
          SK: `ESP#${especialidadId}`
        },
        UpdateExpression: "SET nombre = :nombre, updated_at = :updated",
        ExpressionAttributeValues: {
          ":nombre": body.nombre.trim(),
          ":updated": now
        }
      })
    );

    console.log(`[${TRACE_ID}] ✅ Especialidad actualizada: ${especialidadId}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        especialidad: {
          id: especialidadId,
          nombre: body.nombre.trim(),
          grupo_id,
          updated_at: now
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando especialidad:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar especialidad",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
