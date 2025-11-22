const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse, notFoundResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerMedicoNombre' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerMedicoNombre');
  const medicoId = event.queryStringParameters?.medicoId;

  if (!medicoId) {
    logger.warn('Missing medicoId parameter');
    endTrace();
    return errorResponse('Debe enviar ?medicoId=valor', 400);
  }

  const params = {
    TableName: process.env.OCCUPANTS_TABLE,
    Key: {
      id: medicoId
    }
  };

  try {
    const data = await client.send(new GetCommand(params));

    if (!data.Item) {
      logger.info('Medico not found', { medico_id: medicoId });
      endTrace();
      return notFoundResponse(`Médico ${medicoId} no encontrado`);
    }

    logger.info('Medico name retrieved', { medico_id: medicoId });
    endTrace();
    return successResponse({ nombre: data.Item.name || null });

  } catch (err) {
    logger.error('Error retrieving medico name', err, { medico_id: medicoId });
    endTrace();
    return errorResponse('Error obteniendo médico', 500);
  }
};
