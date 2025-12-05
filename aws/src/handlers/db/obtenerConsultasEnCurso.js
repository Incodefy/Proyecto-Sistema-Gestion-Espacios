const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const obtenerConsultasEnCurso = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerConsultasEnCurso' });
  const { hora_actual, estadosPermitidos } = event.queryStringParameters || {};
  
  if (!hora_actual || !estadosPermitidos || estadosPermitidos.length !== 2) {
    throw new ValidationError('Debe enviar hora_actual y 2 estados permitidos', 'MISSING_PARAMS');
  }

  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  const fechaFormateada = hoy.toISOString().split("T")[0];

  logger.info("Obteniendo consultas en curso", { fecha: fechaFormateada, hora_actual, estadosPermitidos });

  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      IndexName: "FechaIndex",
      KeyConditionExpression: "GSI2PK = :fecha",
      FilterExpression: "idEstado IN (:estado1, :estado2) AND horaInicio <= :hora_actual AND horaFin > :hora_actual",
      ExpressionAttributeValues: {
        ":fecha": `DATE#${fechaFormateada}`,
        ":estado1": estadosPermitidos[0],
        ":estado2": estadosPermitidos[1],
        ":hora_actual": hora_actual
      }
    })),
    { operation: 'obtenerConsultasEnCurso', fecha: fechaFormateada }
  );
  
  const items = data.Items || [];
  logger.info("Consultas en curso obtenidas", { count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerConsultasEnCurso, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });
