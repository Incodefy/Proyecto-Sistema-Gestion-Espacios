const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] PUT /groups/:groupId/nomenclatura | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const groupId = event.pathParameters.groupId;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📦 Group ID:`, groupId);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!body.nomenclatura || !body.nomenclatura.general || !body.nomenclatura.especifico) {
      console.warn(`[${TRACE_ID}] ⚠️ Nomenclatura incompleta`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "La nomenclatura debe incluir 'general' y 'especifico'",
          trace_id: TRACE_ID
        })
      };
    }

    const timestamp = new Date().toISOString();

    console.log(`[${TRACE_ID}] 💾 Actualizando nomenclatura del grupo:`, groupId);

    // Actualizar la nomenclatura del grupo
    await db.send(new UpdateCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: groupId },
      UpdateExpression: "SET nomenclatura = :nom, updated_at = :now",
      ConditionExpression: "attribute_exists(group_id)",
      ExpressionAttributeValues: {
        ":nom": body.nomenclatura,
        ":now": timestamp
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Nomenclatura actualizada exitosamente`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: 'Nomenclatura actualizada correctamente',
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando nomenclatura:`, error);
    
    // Si el grupo no existe
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Grupo no encontrado",
          trace_id: TRACE_ID
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al actualizar la nomenclatura",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
