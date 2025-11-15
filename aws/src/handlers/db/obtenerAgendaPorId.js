const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse, notFoundResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerAgendaPorId' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerAgendaPorId');
  const idAgenda = event.queryStringParameters?.idAgenda;

  if (!idAgenda) {
    logger.warn("Consulta sin idAgenda");
    endTrace();
    return errorResponse("Debe enviar ?idAgenda=valor", 400);
  }

  logger.info("Obteniendo agenda por ID", { idAgenda });

  const params = {
    TableName: process.env.DB_AGENDA,
    IndexName: "GSI3_IdAgenda",
    KeyConditionExpression: "GSI3PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `IDAGENDA#${idAgenda}`
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));

    if (!data.Items || data.Items.length === 0) {
      logger.warn("Agenda no encontrada", { idAgenda });
      endTrace();
      return notFoundResponse("Agenda no encontrada");
    }

    logger.info("Agenda obtenida por ID", { idAgenda });
    endTrace();

    return successResponse(data.Items[0]);

  } catch (err) {
    logger.error("Error obteniendo agenda por ID", err, { idAgenda });
    endTrace();
    return errorResponse("Error interno obteniendo agenda", 500, { details: err.message });
  }
};
