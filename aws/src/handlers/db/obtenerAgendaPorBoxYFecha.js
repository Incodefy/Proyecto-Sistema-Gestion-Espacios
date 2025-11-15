const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerAgendaPorBoxYFecha' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerAgendaPorBoxYFecha');
  const boxId = event.queryStringParameters?.boxId;
  const fecha = event.queryStringParameters?.fecha;

  if (!boxId || !fecha) {
    logger.warn('Missing required parameters', { has_boxId: !!boxId, has_fecha: !!fecha });
    endTrace();
    return errorResponse('Debe enviar ?boxId=<valor>&fecha=<YYYY-MM-DD>', 400);
  }

  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!fechaRegex.test(fecha)) {
    logger.warn('Invalid date format', { fecha });
    endTrace();
    return errorResponse('La fecha debe tener formato YYYY-MM-DD.', 400);
  }

  const pk = `BOX#${boxId}#DATE#${fecha}`;

  const params = {
    TableName: process.env.DB_AGENDA,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": pk
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));

    logger.info('Agenda items retrieved', { box_id: boxId, fecha, count: data.Items?.length || 0 });
    endTrace();
    return successResponse(data.Items || [], 200, { count: data.Items?.length || 0 });

  } catch (err) {
    logger.error('Error retrieving agenda by box and date', err, { box_id: boxId, fecha });
    endTrace();
    return errorResponse('Error obteniendo agendas por box y fecha.', 500);
  }
};
