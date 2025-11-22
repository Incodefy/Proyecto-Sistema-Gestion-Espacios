const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const crypto = require("crypto");

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /groups | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const userEmail = event.requestContext.authorizer.jwt.claims.email;
    const userName = event.requestContext.authorizer.jwt.claims['cognito:username'] || userEmail?.split('@')[0] || 'Usuario';
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

    // Nomenclatura con valores predeterminados o personalizados
    const nomenclatura = body.nomenclatura || {
      general: 'Pasillo',
      especifico: 'Box',
      ocupante: 'Médico',
      especialidad: 'Especialidad'
    };

    console.log(`[${TRACE_ID}] 💾 Guardando grupo:`, groupId);
    console.log(`[${TRACE_ID}] 📝 Nomenclatura:`, nomenclatura);

    // 1️⃣ Crear el grupo
    await db.send(
    new PutCommand({
        TableName: process.env.GROUPS_TABLE,
        Item: {
            group_id: groupId,
            nombre: body.name.trim(),
            owner_sub: userSub,
            configured: false,
            nomenclatura: nomenclatura,
            created_at: now,
            updated_at: now
        }
    })
    );

    // 2️⃣ Registrar al creador como miembro del grupo con rol owner
    await db.send(
    new PutCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        Item: {
            group_id: groupId,
            user_sub: userSub,
            user_email: userEmail,
            user_name: userName,
            role: "owner",
            added_at: now,
            updated_by: userSub
        }
    })
    );
    
    console.log(`[${TRACE_ID}] 👑 Usuario asignado como owner del grupo`);

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