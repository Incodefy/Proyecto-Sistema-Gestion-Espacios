const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] DELETE /api/grupos/miembro/:id | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const miembroSub = event.pathParameters.id;
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 🎯 Miembro Sub:`, miembroSub);
    
    // Obtener grupo_id del query parameter
    const grupoId = event.queryStringParameters?.grupo_id;
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

    // TODO: Verificar que el usuario que hace la petición tiene permisos de admin/owner

    // Verificar que el miembro existe y no es el owner
    const memberResult = await db.send(new GetCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      }
    }));

    if (!memberResult.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Miembro no encontrado`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Miembro no encontrado en el grupo",
          trace_id: TRACE_ID
        })
      };
    }

    if (memberResult.Item.role === 'owner') {
      console.warn(`[${TRACE_ID}] ⚠️ Intento de remover al owner`);
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "No se puede remover al propietario del grupo",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] 🗑️ Removiendo miembro del grupo`);

    await db.send(new DeleteCommand({
      TableName: process.env.GROUP_MEMBERS_TABLE,
      Key: { 
        group_id: grupoId,
        user_sub: miembroSub
      }
    }));

    console.log(`[${TRACE_ID}] ✅ Miembro removido exitosamente`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        message: 'Miembro removido correctamente',
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error removiendo miembro:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al remover el miembro",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
