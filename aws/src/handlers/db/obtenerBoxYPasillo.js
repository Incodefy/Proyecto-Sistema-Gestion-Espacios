const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse, notFoundResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerBoxYPasillo' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerBoxYPasillo');
  const boxId = event.queryStringParameters?.boxId;

  if (!boxId) {
    logger.warn('Missing boxId parameter');
    endTrace();
    return errorResponse('Debe enviar ?boxId=valor', 400);
  }

  const params = {
    TableName: process.env.DB_CATALOGO,
    Key: {
      PK: `BOX#${boxId}`,
      SK: "#"
    }
  };

  try {
    const data = await client.send(new GetCommand(params));

    if (!data.Item) {
      logger.info('Box not found', { box_id: boxId });
      endTrace();
      return notFoundResponse(`BOX#${boxId} no existe`);
    }

    const item = {
      idBox: data.Item.idBox,
      nombre: data.Item.nombre,
      estado: data.Item.estado,
      idPasillo: data.Item.idPasillo,
      pasilloNombre: data.Item.pasilloNombre
    };

    logger.info('Box with pasillo retrieved', { box_id: boxId, pasillo_id: item.idPasillo });
    endTrace();
    return successResponse(item);

  } catch (err) {
    logger.error('Error retrieving box and pasillo', err, { box_id: boxId });
    endTrace();
    return errorResponse('Error interno obteniendo box', 500);
  }
};
