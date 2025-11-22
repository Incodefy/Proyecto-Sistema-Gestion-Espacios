// src/handlers/groups/verifyInvitation.js
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] GET /api/invitaciones/verificar | ${TRACE_ID} ===`);
  
  try {
    const token = event.queryStringParameters?.token;
    
    if (!token) {
      console.warn(`[${TRACE_ID}] ⚠️ Token no proporcionado`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Token de invitación requerido",
          trace_id: TRACE_ID
        })
      };
    }

    console.log(`[${TRACE_ID}] 🔍 Verificando invitación con token:`, token.substring(0, 8) + '...');

    // Buscar invitación en DynamoDB
    const result = await db.send(new GetCommand({
      TableName: process.env.GROUP_INVITATIONS_TABLE,
      Key: { token }
    }));

    if (!result.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Invitación no encontrada`);
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Invitación no encontrada o ha expirado",
          trace_id: TRACE_ID
        })
      };
    }

    const invitation = result.Item;

    // Verificar que esté pendiente
    if (invitation.status !== 'pending') {
      console.warn(`[${TRACE_ID}] ⚠️ Invitación ya ${invitation.status}`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: invitation.status === 'ACCEPTED' 
            ? 'Esta invitación ya fue aceptada' 
            : 'Esta invitación no está disponible',
          trace_id: TRACE_ID
        })
      };
    }

    // Obtener información del grupo
    const groupResult = await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: invitation.group_id }
    }));

    console.log(`[${TRACE_ID}] ✅ Invitación válida`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        invitation: {
          email: invitation.invited_email,
          role: invitation.role,
          group_id: invitation.group_id,
          group_name: groupResult.Item?.name || 'sin nombre',
          created_at: invitation.created_at
        },
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error verificando invitación:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al verificar la invitación",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
