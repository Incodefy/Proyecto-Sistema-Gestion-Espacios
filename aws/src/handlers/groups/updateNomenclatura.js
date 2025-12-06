const { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const db = DynamoDBDocumentClient.from(new (require("@aws-sdk/client-dynamodb").DynamoDBClient)());

// ✅ MEJORAS IMPLEMENTADAS
const { Logger } = require("../../utils/logger");
const { ValidationError, NotFoundError, successResponse } = require("../../utils/errorHandler");
const { createAPIHandler } = require("../../middleware/interceptors");

/**
 * PUT /grupos/{groupId}/nomenclatura
 * Actualiza la nomenclatura de un grupo
 */
async function updateNomenclaturaHandler(event, context, logger) {
  const userSub = event.userContext?.sub;
  const groupId = event.pathParameters?.groupId || event.pathParameters?.group_id;
  const { nomenclatura } = event.parsedBody;
  
  logger = logger.child({ groupId, userSub });
  logger.info('Updating group nomenclatura');
  
  // Validar nomenclatura
  if (!nomenclatura?.general || !nomenclatura?.especifico || !nomenclatura?.ocupante || !nomenclatura?.especialidad) {
    throw new ValidationError("La nomenclatura debe incluir 'general', 'especifico', 'ocupante' y 'especialidad'");
  }

  const campos = ['general', 'especifico', 'ocupante', 'especialidad', 'instrumento'];
  for (const campo of campos) {
    const valor = nomenclatura[campo];
    if (valor && valor.length > 50) {
      throw new ValidationError(`El campo '${campo}' no puede exceder 50 caracteres`);
    }
  }

  const timestamp = new Date().toISOString();

  // Obtener grupo actual
  logger.debug('Fetching current group');
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

  // Detectar cambios
  const cambios = [];
  campos.forEach(campo => {
    const valorAnterior = nomenclaturaAnterior[campo] || '';
    const valorNuevo = nomenclatura[campo] || '';
    
    if (valorAnterior !== valorNuevo) {
      cambios.push({
        campo,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo
      });
    }
  });

  logger.info('Changes detected', { changesCount: cambios.length });

  if (cambios.length === 0) {
    logger.info('No changes in nomenclatura');
    return successResponse({ 
      ok: true,
      message: 'No hay cambios en la nomenclatura'
    });
  }

  // Actualizar nomenclatura
  logger.debug('Updating nomenclatura in database');
  await db.send(new UpdateCommand({
    TableName: process.env.GROUPS_TABLE,
    Key: { group_id: groupId },
    UpdateExpression: "SET nomenclatura = :nom, updated_at = :now",
    ConditionExpression: "attribute_exists(group_id)",
    ExpressionAttributeValues: {
      ":nom": nomenclatura,
      ":now": timestamp
    }
  }));

  logger.info('Nomenclatura updated successfully');

  return successResponse({
    ok: true,
    message: "Nomenclatura actualizada correctamente",
    group_id: groupId,
    nomenclatura: nomenclatura,
    cambios
  });
}

module.exports.handler = createAPIHandler(updateNomenclaturaHandler, { 
  rateLimit: { 
    limit: 30, 
    window: 60,
    endpoint: 'updateNomenclatura'
  } 
});
