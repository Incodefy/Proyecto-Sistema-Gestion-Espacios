const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerPasillos' });

module.exports.handler = async () => {
  const endTrace = logger.startTrace('obtenerPasillos');

  const params = {
    TableName: process.env.DB_CATALOGO,
    IndexName: "TipoEntidadIndex",
    KeyConditionExpression: "GSI1PK = :tipo",
    ExpressionAttributeValues: {
      ":tipo": "TIPO#PASILLO"
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));

    const itemsOrdenados = (data.Items || []).sort((a, b) => {
      if (a.idBox < b.idBox) return -1;
      if (a.idBox > b.idBox) return 1;
      return 0;
    });

    logger.info('Pasillos retrieved', { count: itemsOrdenados.length });
    endTrace();
    return successResponse(itemsOrdenados, 200, { count: itemsOrdenados.length });
  } catch (err) {
    logger.error('Error retrieving pasillos', err);
    endTrace();
    return errorResponse('Error obteniendo pasillos', 500);
  }
};
