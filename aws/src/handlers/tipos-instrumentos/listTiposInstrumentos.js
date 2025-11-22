// aws/src/handlers/tipos-instrumentos/listTiposInstrumentos.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] GET /groups/{grupo_id}/tipos-instrumentos | ${TRACE_ID} ===`);
  
  try {
    const grupo_id = event.pathParameters?.grupo_id;
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📂 Grupo ID:`, grupo_id);
    
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

    // Consultar tipos de instrumentos del grupo
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.TIPOS_INSTRUMENTOS_TABLE,
        KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":gid": grupo_id,
          ":prefix": "TIPO_INST#"
        }
      })
    );

    const tipos = (result.Items || []).map(item => ({
      id: item.SK.replace('TIPO_INST#', ''),
      nombre: item.nombre,
      grupo_id: item.PK,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    console.log(`[${TRACE_ID}] ✅ Tipos de instrumentos encontrados:`, tipos.length);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true, 
        tipos,
        count: tipos.length,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error listando tipos de instrumentos:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al obtener tipos de instrumentos",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
