const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /api/espacios/espacio/:id | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const espacioId = event.pathParameters.id; // Formato: SPACE#1 o SUBSPACE#1
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📦 Espacio ID:`, espacioId);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!body.nombre || !body.nombre.trim()) {
      console.warn(`[${TRACE_ID}] ⚠️ Nombre no proporcionado`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre es requerido",
          trace_id: TRACE_ID
        })
      };
    }

    // Necesitamos el grupo_id para la clave
    const grupoId = body.grupo_id || event.queryStringParameters?.grupo_id;
    if (!grupoId) {
      console.warn(`[${TRACE_ID}] ⚠️ grupo_id no proporcionado`);
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

    const timestamp = new Date().toISOString();

    console.log(`[${TRACE_ID}] 🔄 Actualizando espacio:`, espacioId);

    // Verificar que el espacio existe
    const getResult = await db.send(new GetCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { 
        PK: grupoId,
        SK: espacioId
      }
    }));

    if (!getResult.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Espacio no encontrado`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Espacio no encontrado",
          trace_id: TRACE_ID
        })
      };
    }

    await db.send(new UpdateCommand({
      TableName: process.env.SPACES_TABLE,
      Key: { 
        PK: grupoId,
        SK: espacioId
      },
      UpdateExpression: "SET nombre = :nombre, updated_at = :now",
      ExpressionAttributeValues: {
        ":nombre": body.nombre.trim(),
        ":now": timestamp
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Espacio actualizado exitosamente`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        espacio_id: espacioId,
        nombre: body.nombre.trim(),
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando espacio:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar el espacio",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
