const { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyNomenclaturaActualizada } = require('../../utils/notificationHelper');

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
    
    if (!body.nomenclatura || !body.nomenclatura.general || !body.nomenclatura.especifico || !body.nomenclatura.ocupante || !body.nomenclatura.especialidad) {
      console.warn(`[${TRACE_ID}] ⚠️ Nomenclatura incompleta`);
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: false, 
          error: "La nomenclatura debe incluir 'general', 'especifico', 'ocupante' y 'especialidad'",
          trace_id: TRACE_ID
        })
      };
    }

    const timestamp = new Date().toISOString();

    console.log(`[${TRACE_ID}] 🔍 Obteniendo nomenclatura actual del grupo...`);

    // Obtener la nomenclatura actual del grupo
    const currentGroup = await db.send(new GetCommand({
      TableName: process.env.GROUPS_TABLE,
      Key: { group_id: groupId }
    }));

    if (!currentGroup.Item) {
      console.warn(`[${TRACE_ID}] ⚠️ Grupo no encontrado`);
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

    const nomenclaturaAnterior = currentGroup.Item.nomenclatura || {
      general: '',
      especifico: '',
      ocupante: '',
      especialidad: '',
      instrumento: ''
    };
    const nomenclaturaNueva = body.nomenclatura;

    console.log(`[${TRACE_ID}] 📊 Nomenclatura anterior:`, nomenclaturaAnterior);
    console.log(`[${TRACE_ID}] 📊 Nomenclatura nueva:`, nomenclaturaNueva);

    // Detectar qué campos cambiaron
    const cambiosDetallados = [];
    const campos = ['general', 'especifico', 'ocupante', 'especialidad', 'instrumento'];
    
    campos.forEach(campo => {
      const valorAnterior = nomenclaturaAnterior[campo] || '';
      const valorNuevo = nomenclaturaNueva[campo] || '';
      
      if (valorAnterior !== valorNuevo) {
        cambiosDetallados.push({
          campo,
          valor_anterior: valorAnterior,
          valor_nuevo: valorNuevo
        });
      }
    });

    console.log(`[${TRACE_ID}] 🔄 ${cambiosDetallados.length} cambios detectados`);

    if (cambiosDetallados.length === 0) {
      console.log(`[${TRACE_ID}] ℹ️ No hay cambios en la nomenclatura`);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ok: true,
          message: 'No hay cambios en la nomenclatura',
          trace_id: TRACE_ID
        })
      };
    }

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

    // Notificar a todos los miembros del grupo
    try {
      const membersResult = await db.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :gid',
        ExpressionAttributeValues: { ':gid': groupId }
      }));

      const userSubs = (membersResult.Items || []).map(m => m.user_sub);
      
      if (userSubs.length > 0) {
        await notifyNomenclaturaActualizada({
          userSubs,
          grupoId: groupId,
          createdBy: userSub,
          cambios: cambiosDetallados,
          grupoNombre: currentGroup.Item.name || 'Sin nombre'
        });
        console.log(`[${TRACE_ID}] 📬 Notificaciones enviadas a ${userSubs.length} miembros`);
      }
    } catch (notifError) {
      console.error(`[${TRACE_ID}] ⚠️ Error enviando notificaciones:`, notifError);
      // No fallar si las notificaciones fallan
    }

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
