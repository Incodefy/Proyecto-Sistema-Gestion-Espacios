const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerConsultasEnCurso' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerConsultasEnCurso');
  const { hora_actual, estadosPermitidos } = event.queryStringParameters || {};

  if (!hora_actual || !estadosPermitidos || estadosPermitidos.length !== 2) {
    logger.warn("Parámetros faltantes o inválidos", { hora_actual, estadosPermitidos });
    endTrace();
    return errorResponse("Debe enviar hora_actual y 2 estados permitidos", 400);
  }

  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  const fechaFormateada = hoy.toISOString().split("T")[0];

  logger.info("Obteniendo consultas en curso", { 
    fecha: fechaFormateada, 
    hora_actual, 
    estadosPermitidos 
  });

  const params = {
    TableName: process.env.DB_AGENDA,
    IndexName: "FechaIndex",
    KeyConditionExpression: "GSI2PK = :fecha",
    FilterExpression:
      "idEstado IN (:estado1, :estado2) AND horaInicio <= :hora_actual AND horaFin > :hora_actual",
    ExpressionAttributeValues: {
      ":fecha": `DATE#${fechaFormateada}`,
      ":estado1": estadosPermitidos[0],
      ":estado2": estadosPermitidos[1],
      ":hora_actual": hora_actual,
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));
    
    logger.info("Consultas en curso obtenidas", { count: data.Items?.length || 0 });
    endTrace();

    return successResponse(data.Items || [], 200, { count: data.Items?.length || 0 });

  } catch (err) {
    logger.error("Error obteniendo consultas en curso", err);
    endTrace();
    return errorResponse("Error obteniendo consultas en curso", 500, { details: err.message });
  }
};
