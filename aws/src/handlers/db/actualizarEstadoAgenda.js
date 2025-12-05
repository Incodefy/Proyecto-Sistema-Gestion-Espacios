const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { validate } = require("../../utils/validation");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { createAPIHandler } = require("../../utils/interceptors");
const { ValidationError, NotFoundError } = require("../../utils/errors");
const { retryDB } = require("../../utils/retry");

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient();

async function actualizarEstadoAgendaHandler(event, logger) {
  const body = JSON.parse(event.body);
  const { valid, data, errors } = validate(body, 'actualizarEstadoAgenda');
  
  if (!valid) throw new ValidationError("Validación fallida", errors);

  const { idAgenda, nuevoEstado } = data;
  logger.info("Actualizando estado de agenda", { idAgenda, nuevoEstado });

  const invokeResult = await lambda.send(
    new InvokeCommand({
      FunctionName: `${process.env.SERVICE_NAME}-${process.env.STAGE}-obtenerAgendaPorId`,
      Payload: Buffer.from(JSON.stringify({ queryStringParameters: { idAgenda } }))
    })
  );

  const payload = JSON.parse(new TextDecoder().decode(invokeResult.Payload));
  if (payload.statusCode !== 200) throw new NotFoundError("Agenda no encontrada");

  const agenda = JSON.parse(payload.body);

  const result = await retryDB(() => dynamo.send(new UpdateCommand({
    TableName: process.env.DB_AGENDA,
    Key: { PK: agenda.PK, SK: agenda.SK },
    UpdateExpression: "SET idEstado = :estado",
    ExpressionAttributeValues: { ":estado": nuevoEstado },
    ReturnValues: "UPDATED_NEW"
  })));

  logger.info("Estado actualizado correctamente", { idAgenda, nuevoEstado });

  return successResponse({
    mensaje: "Estado actualizado correctamente",
    updated: result.Attributes,
    pk: agenda.PK,
    sk: agenda.SK
  });
}

module.exports.handler = createAPIHandler(actualizarEstadoAgendaHandler, { rateLimit: { maxRequests: 50, windowSeconds: 60 } });
