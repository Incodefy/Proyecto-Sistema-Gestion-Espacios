const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerNotificaciones' });

module.exports.handler = async () => {
  const endTrace = logger.startTrace('obtenerNotificaciones');

  const params = {
    TableName: process.env.DB_NOTIFICACION,
    Limit: 50
  };

  try {
    const data = await client.send(new ScanCommand(params));

    const items = data.Items || [];

    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    logger.info('Notificaciones retrieved', { count: items.length });
    endTrace();
    return successResponse(items, 200, { count: items.length });

  } catch (err) {
    logger.error('Error retrieving notificaciones', err);
    endTrace();
    return errorResponse('Error obteniendo notificaciones', 500);
  }
};
