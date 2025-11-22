const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerEspaciosGenerales' });

/**
 * Obtiene todos los espacios generales (SPACE) de un grupo
 * Reemplazo de: obtenerPasillos.js
 */
module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerEspaciosGenerales');

  try {
    const grupoId = event.queryStringParameters?.grupo_id;
    
    if (!grupoId) {
      logger.warn("Missing grupo_id parameter");
      endTrace();
      return errorResponse("grupo_id es requerido", 400);
    }

    const params = {
      TableName: process.env.SPACES_TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": grupoId,
        ":sk": "SPACE#"
      }
    };

    const data = await client.send(new QueryCommand(params));

    const itemsOrdenados = (data.Items || []).sort((a, b) => {
      const numA = parseInt(a.SK.replace('SPACE#', ''));
      const numB = parseInt(b.SK.replace('SPACE#', ''));
      return numA - numB;
    });

    logger.info('Espacios generales obtenidos', { count: itemsOrdenados.length });
    endTrace();
    return successResponse(itemsOrdenados, 200, { count: itemsOrdenados.length });
  } catch (err) {
    logger.error('Error obteniendo espacios generales', err);
    endTrace();
    return errorResponse('Error obteniendo espacios generales', 500);
  }
};
