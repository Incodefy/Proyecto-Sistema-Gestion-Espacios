const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'actualizarEstadoAgenda' });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient();

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('actualizarEstadoAgenda');

  try {
    const body = JSON.parse(event.body);
    const { valid, data, errors } = validate(body, 'actualizarEstadoAgenda');
    
    if (!valid) {
      logger.warn("Validación fallida", { errors });
      endTrace();
      return errorResponse("Validación fallida", 400, { errors });
    }

    const { idAgenda, nuevoEstado } = data;
    logger.info("Actualizando estado de agenda", { idAgenda, nuevoEstado });

    const invokeResult = await lambda.send(
      new InvokeCommand({
        FunctionName: `${process.env.SERVICE_NAME}-${process.env.STAGE}-obtenerAgendaPorId`,
        Payload: Buffer.from(JSON.stringify({
          queryStringParameters: { idAgenda }
        }))
      })
    );

    const payload = JSON.parse(new TextDecoder().decode(invokeResult.Payload));

    if (payload.statusCode !== 200) {
      logger.warn("Agenda no encontrada", { idAgenda, statusCode: payload.statusCode });
      endTrace();
      return errorResponse("Agenda no encontrada", payload.statusCode);
    }

    const agenda = JSON.parse(payload.body);

    const params = {
      TableName: process.env.DB_AGENDA,
      Key: {
        PK: agenda.PK,
        SK: agenda.SK
      },
      UpdateExpression: "SET idEstado = :estado",
      ExpressionAttributeValues: {
        ":estado": nuevoEstado
      },
      ReturnValues: "UPDATED_NEW"
    };

    const result = await dynamo.send(new UpdateCommand(params));
    logger.info("Estado actualizado correctamente", { idAgenda, nuevoEstado, pk: agenda.PK });
    endTrace();

    return successResponse({
      mensaje: "Estado actualizado correctamente",
      updated: result.Attributes,
      pk: agenda.PK,
      sk: agenda.SK
    });

  } catch (err) {
    logger.error("Error actualizando estado agenda", err);
    endTrace();
    return errorResponse("Error actualizando agenda", 500, { details: err.message });
  }
};
