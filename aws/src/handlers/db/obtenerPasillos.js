const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerPasillos' });

module.exports.handler = async () => {
  const endTrace = logger.startTrace('obtenerPasillos');

  const params = {
    TableName: process.env.SPACES_TABLE,
    FilterExpression: '#type = :typeVal',
    ExpressionAttributeNames: {
      '#type': 'type'
    },
    ExpressionAttributeValues: {
      ':typeVal': 'SPACE'
    }
  };

  try {
    const data = await client.send(new ScanCommand(params));

    // Mapear a formato legacy y ordenar
    const pasillos = (data.Items || []).map(item => ({
      idBox: item.id,
      nombre: item.name,
      grupo_id: item.grupo_id
    })).sort((a, b) => {
      if (a.idBox < b.idBox) return -1;
      if (a.idBox > b.idBox) return 1;
      return 0;
    });

    logger.info('Pasillos (SPACE) obtenidos', { count: pasillos.length });
    endTrace();
    return successResponse(pasillos, 200, { count: pasillos.length });
  } catch (err) {
    logger.error('Error obteniendo pasillos', err);
    endTrace();
    return errorResponse('Error obteniendo pasillos', 500);
  }
};
