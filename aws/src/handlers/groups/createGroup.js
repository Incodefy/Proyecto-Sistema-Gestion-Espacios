const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /groups | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    if (!body.name || !body.name.trim()) {
      console.warn(`[${TRACE_ID}] ⚠️ Nombre no proporcionado`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El nombre del grupo es requerido",
          trace_id: TRACE_ID
        })
      };
    }
    
    const groupId = `grp_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    console.log(`[${TRACE_ID}] 💾 Guardando grupo:`, groupId);

    // 1️⃣ Crear el grupo
    await db.send(
    new PutCommand({
        TableName: process.env.GROUPS_TABLE,
        Item: {
            group_id: groupId,
            nombre: body.name.trim(),
            owner_sub: userSub,
            configured: false,
            nomenclatura: null,
            created_at: now,
            updated_at: now
        }
    })
    );

    // 2️⃣ Registrar al creador como miembro del grupo
    await db.send(
    new PutCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Item: {
            group_id: groupId,
            nombre: body.name.trim(),
            user_sub: userSub,
            role: "owner",
            added_at: now
        }
    })
    );

    console.log(`[${TRACE_ID}] ✅ Grupo creado exitosamente`);

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true, 
        group_id: groupId,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando grupo:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al crear el grupo",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};