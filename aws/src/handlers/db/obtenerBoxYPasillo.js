const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse, notFoundResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerBoxYPasillo' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerBoxYPasillo');
  const boxId = event.queryStringParameters?.boxId;
  const grupoId = event.queryStringParameters?.grupo_id;

  if (!boxId) {
    logger.warn('Missing boxId parameter');
    endTrace();
    return errorResponse('Debe enviar ?boxId=valor', 400);
  }

  if (!grupoId) {
    logger.warn('Missing grupo_id parameter');
    endTrace();
    return errorResponse('Debe enviar ?grupo_id=valor', 400);
  }

  const params = {
    TableName: process.env.SPACES_TABLE,
    Key: {
      id: boxId
    }
  };

  try {
    const data = await client.send(new GetCommand(params));

    if (!data.Item) {
      logger.info('Espacio específico not found', { box_id: boxId, grupo_id: grupoId });
      endTrace();
      return notFoundResponse(`Espacio específico ${boxId} no existe en grupo ${grupoId}`);
    }

    const espacioEspecifico = data.Item;
    
    // Verificar que pertenece al grupo correcto
    if (espacioEspecifico.grupo_id !== grupoId) {
      logger.warn('Space does not belong to requested group', { box_id: boxId, grupo_id: grupoId, actual_grupo: espacioEspecifico.grupo_id });
      endTrace();
      return notFoundResponse(`Espacio específico ${boxId} no existe en grupo ${grupoId}`);
    }
    
    // Obtener el nombre del espacio general (parent) si existe
    let pasilloNombre = null;
    if (espacioEspecifico.parent_id) {
      try {
        const parentData = await client.send(new GetCommand({
          TableName: process.env.SPACES_TABLE,
          Key: {
            id: espacioEspecifico.parent_id
          }
        }));
        
        if (parentData.Item) {
          pasilloNombre = parentData.Item.name;
        }
      } catch (parentErr) {
        logger.warn('Could not fetch parent space name', { parent: espacioEspecifico.parent_id });
      }
    }

    const item = {
      idBox: boxId,
      nombre: espacioEspecifico.name,
      estado: 1, // Siempre habilitado por defecto
      idPasillo: espacioEspecifico.parent_id || null,
      pasilloNombre: pasilloNombre
    };

    logger.info('Espacio específico retrieved', { box_id: boxId, grupo_id: grupoId, parent: espacioEspecifico.parent_id });
    endTrace();
    return successResponse(item);

  } catch (err) {
    logger.error('Error retrieving box and pasillo', err, { box_id: boxId, grupo_id: grupoId });
    endTrace();
    return errorResponse('Error interno obteniendo box', 500);
  }
};
