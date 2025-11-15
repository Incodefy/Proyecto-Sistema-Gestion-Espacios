const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerBoxesDisponibles' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerBoxesDisponibles');
  let body = null;

  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      logger.warn("Body inválido recibido");
      endTrace();
      return errorResponse("El body debe ser un JSON válido", 400);
    }
  }

  const boxes = body?.boxes;
  logger.info("Obteniendo boxes disponibles", { filterCount: boxes?.length || 0 });

  const params = {
    TableName: process.env.DB_CATALOGO
  };

  if (Array.isArray(boxes) && boxes.length > 0) {
    const placeholders = boxes.map((_, i) => `:b${i}`).join(", ");
    params.FilterExpression = `idBox IN (${placeholders})`;
    params.ExpressionAttributeValues = boxes.reduce((acc, box, index) => {
      acc[`:b${index}`] = box;
      return acc;
    }, {});
  }

  try {
    const data = await client.send(new ScanCommand(params));
    
    logger.info("Boxes disponibles obtenidos", { count: data.Items?.length || 0 });
    endTrace();

    return successResponse(data.Items || [], 200, { count: data.Items?.length || 0 });

  } catch (err) {
    logger.error("Error obteniendo boxes disponibles", err);
    endTrace();
    return errorResponse("Error obteniendo boxes disponibles", 500, { details: err.message });
  }
};
