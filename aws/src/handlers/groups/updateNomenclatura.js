const { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());
const { notifyNomenclaturaActualizada } = require('../../utils/notificationHelper');
const Logger = require("../../utils/logger");
const { createAPIHandler } = require("../../utils/interceptors");
const { successResponse } = require("../../utils/response");
const { ValidationError, NotFoundError } = require("../../utils/errors");

async function updateNomenclaturaHandler(event, logger) {
  const userSub = event.requestContext.authorizer.jwt.claims.sub;
  const groupId = event.pathParameters?.groupId;
  const body = JSON.parse(event.body || "{}");
  
  logger.info('Actualizando nomenclatura', { groupId, userSub });
  
  if (!body.nomenclatura || !body.nomenclatura.general || !body.nomenclatura.especifico || !body.nomenclatura.ocupante || !body.nomenclatura.especialidad) {
    throw new ValidationError("La nomenclatura debe incluir 'general', 'especifico', 'ocupante' y 'especialidad'");
  }

  const campos = ['general', 'especifico', 'ocupante', 'especialidad', 'instrumento'];
  for (const campo of campos) {
    const valor = body.nomenclatura[campo];
    if (valor && valor.length > 50) {
      throw new ValidationError(`El campo '${campo}' no puede exceder 50 caracteres`);
    }
  }

  const timestamp = new Date().toISOString();

  logger.debug('Obteniendo nomenclatura actual del grupo', { groupId });

  const currentGroup = await db.send(new GetCommand({
    TableName: process.env.GROUPS_TABLE,
    Key: { group_id: groupId }
  }));

  if (!currentGroup.Item) {
    throw new NotFoundError("Grupo no encontrado");
  }

  const nomenclaturaAnterior = currentGroup.Item.nomenclatura || {
    general: '',
    especifico: '',
    ocupante: '',
    especialidad: '',
    instrumento: ''
  };
  const nomenclaturaNueva = body.nomenclatura;

  logger.debug('Nomenclatura anterior vs nueva', { anterior: nomenclaturaAnterior, nueva: nomenclaturaNueva });
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
        headers: getSecurityHeaders(),
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
      headers: getSecurityHeaders(),
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
        headers: getSecurityHeaders(),
        body: JSON.stringify({ 
          ok: false, 
          error: "Grupo no encontrado",
          trace_id: TRACE_ID
        })
      };
    }
    
    logger.info('Nomenclatura actualizada exitosamente', { groupId, cambiosCount: cambios.length });
    
    return successResponse({
      ok: true,
      message: "Nomenclatura actualizada correctamente",
      group_id: groupId,
      nomenclatura: nomenclaturaNueva,
      cambios,
      affected_spaces: affectedSpaces,
      notificaciones_enviadas: cambios.length > 0
    });
}

module.exports.handler = createAPIHandler(updateNomenclaturaHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });
