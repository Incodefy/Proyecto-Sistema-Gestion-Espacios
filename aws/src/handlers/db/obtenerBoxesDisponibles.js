const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const obtenerBoxesDisponibles = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerBoxesDisponibles' });
  
  let body = null;
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      throw new ValidationError('El body debe ser JSON válido', 'INVALID_JSON');
    }
  }

  const boxes = body?.boxes;
  logger.info("Obteniendo boxes disponibles", { filterCount: boxes?.length || 0 });

  const params = { TableName: process.env.DB_CATALOGO };
  if (Array.isArray(boxes) && boxes.length > 0) {
    const placeholders = boxes.map((_, i) => `:b${i}`).join(", ");
    params.FilterExpression = `idBox IN (${placeholders})`;
    params.ExpressionAttributeValues = boxes.reduce((acc, box, index) => {
      acc[`:b${index}`] = box;
      return acc;
    }, {});
  }

  const data = await retryDB(
    () => client.send(new ScanCommand(params)),
    { operation: 'obtenerBoxesDisponibles', filterCount: boxes?.length || 0 }
  );
  
  const items = data.Items || [];
  logger.info("Boxes disponibles obtenidos", { count: items.length });
  
  return successResponse(items, 200, { count: items.length });
};

module.exports.handler = createAPIHandler(obtenerBoxesDisponibles, { rateLimit: { maxRequests: 80, windowSeconds: 60 } });
