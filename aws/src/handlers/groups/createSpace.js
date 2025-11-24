const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyEspacioCreado } = require('../../utils/notificationHelper');

exports.handler = async (event) => {
  const TRACE_ID = `lambda-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Lambda] POST /api/espacios/espacio | ${TRACE_ID} ===`);
  
  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const userEmail = event.requestContext.authorizer.jwt.claims.email;
    const body = JSON.parse(event.body || "{}");
    
    console.log(`[${TRACE_ID}] 👤 User:`, userSub);
    console.log(`[${TRACE_ID}] 📥 Body:`, body);
    
    const { grupo_id, nombre, tipo, pertenece_a } = body;
    
    if (!grupo_id || !nombre || !tipo) {
      console.warn(`[${TRACE_ID}] ⚠️ Datos incompletos`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "grupo_id, nombre y tipo son requeridos",
          trace_id: TRACE_ID
        })
      };
    }

    // Validar tipo
    if (!['general', 'especifico'].includes(tipo)) {
      console.warn(`[${TRACE_ID}] ⚠️ Tipo inválido:`, tipo);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "El tipo debe ser 'general' o 'especifico'",
          trace_id: TRACE_ID
        })
      };
    }

    // Si es específico, debe tener pertenece_a
    if (tipo === 'especifico' && !pertenece_a) {
      console.warn(`[${TRACE_ID}] ⚠️ Espacio específico sin pertenece_a`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "Los espacios específicos deben tener 'pertenece_a'",
          trace_id: TRACE_ID
        })
      };
    }

    const timestamp = new Date().toISOString();

    // Obtener el siguiente índice para el tipo de espacio
    const queryResult = await db.send(new QueryCommand({
      TableName: process.env.SPACES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': grupo_id
      }
    }));

    const existingSpaces = queryResult.Items || [];
    let nextId;

    if (tipo === 'general') {
      const generalSpaces = existingSpaces.filter(s => s.SK?.startsWith('SPACE#'));
      const maxIdx = generalSpaces.reduce((max, s) => {
        const num = parseInt(s.SK.split('#')[1]);
        return num > max ? num : max;
      }, 0);
      nextId = `SPACE#${maxIdx + 1}`;
    } else {
      const specificSpaces = existingSpaces.filter(s => s.SK?.startsWith('SUBSPACE#'));
      const maxIdx = specificSpaces.reduce((max, s) => {
        const num = parseInt(s.SK.split('#')[1]);
        return num > max ? num : max;
      }, 0);
      nextId = `SUBSPACE#${maxIdx + 1}`;
    }

    console.log(`[${TRACE_ID}] 💾 Creando espacio:`, nextId);

    const item = {
      PK: grupo_id,
      SK: nextId,
      tipo: tipo,
      nombre: nombre.trim(),
      created_at: timestamp,
      created_by: userEmail || userSub
    };

    if (tipo === 'especifico') {
      item.parent = pertenece_a;
    }

    await db.send(new PutCommand({
      TableName: process.env.SPACES_TABLE,
      Item: item
    }));

    console.log(`[${TRACE_ID}] ✅ Espacio creado exitosamente`);

    // Notificar a todos los miembros del grupo
    try {
      const membersResult = await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': grupo_id }
      }));

      const userSubs = (membersResult.Items || []).map(m => m.user_sub);
      
      if (userSubs.length > 0) {
        await notifyEspacioCreado({
          userSubs,
          grupoId: grupo_id,
          createdBy: userSub,
          espacioId: nextId,
          espacioNombre: nombre.trim(),
          espacioTipo: tipo
        });
        console.log(`[${TRACE_ID}] 📬 Notificaciones enviadas a ${userSubs.length} miembros`);
      }
    } catch (notifError) {
      console.error(`[${TRACE_ID}] ⚠️ Error enviando notificaciones:`, notifError);
      // No fallar si las notificaciones fallan
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: true,
        espacio_id: nextId,
        grupo_id,
        nombre: nombre.trim(),
        tipo,
        pertenece_a: pertenece_a || null,
        trace_id: TRACE_ID
      })
    };

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando espacio:`, error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: "Error al crear el espacio",
        details: error.message,
        trace_id: TRACE_ID
      })
    };
  }
};
