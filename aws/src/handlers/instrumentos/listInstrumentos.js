// aws/src/handlers/instrumentos/listInstrumentos.js
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] GET /groups/{grupo_id}/instrumentos | ${TRACE_ID} ===`);
  
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

    // Consultar instrumentos del grupo
    const result = await db.send(
      new QueryCommand({
        TableName: process.env.INSTRUMENTOS_TABLE,
        KeyConditionExpression: "PK = :gid AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":gid": grupo_id,
          ":prefix": "INST#"
        }
      })
    );

    const instrumentos = (result.Items || []).map(item => ({
      id: item.SK.replace('INST#', ''),
      nombre: item.nombre,
      tipo_instrumento_id: item.tipo_instrumento_id?.replace('TIPO_INST#', '') || '',
      grupo_id: item.PK,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    console.log(`[${TRACE_ID}] ✅ Instrumentos encontrados:`, instrumentos.length);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true, 
        instrumentos,
        count: instrumentos.length,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error listando instrumentos:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al obtener instrumentos",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
