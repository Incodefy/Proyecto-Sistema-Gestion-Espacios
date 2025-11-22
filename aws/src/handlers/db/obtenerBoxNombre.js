const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse, notFoundResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerBoxNombre' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerBoxNombre');
  const boxId = event.queryStringParameters?.boxId;

  if (!boxId) {
    logger.warn('Missing boxId parameter');
    endTrace();
    return errorResponse('Debe enviar ?boxId=valor', 400);
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
      logger.info('Box not found', { box_id: boxId });
      endTrace();
      return notFoundResponse(`Box ${boxId} no encontrado`);
    }

    logger.info('Box name retrieved', { box_id: boxId });
    endTrace();
    return successResponse({ nombre: data.Item.name || null });

  } catch (err) {
    logger.error('Error retrieving box name', err, { box_id: boxId });
    endTrace();
    return errorResponse('Error obteniendo box', 500);
  }
};
