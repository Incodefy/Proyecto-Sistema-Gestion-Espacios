const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { createAPIHandler } = require("../../utils/interceptors");
const { NotFoundError } = require("../../utils/errors");
const { retryDB } = require("../../utils/retry");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function eliminarAgendaHandler(event, logger) {
    const tableName = process.env.DB_AGENDA;
    const agendaId = event.queryStringParameters?.agendaId;
    
    if (!agendaId) throw new ValidationError("agendaId es requerido");
    
    logger.info("Eliminando agenda", { agendaId });
    
    const agenda = await retryDB(() => client.send(new GetCommand({
        TableName: tableName,
        Key: { PK: agendaId, SK: agendaId }
    })));
    
    if (!agenda.Item) throw new NotFoundError("Agenda no encontrada");

    await retryDB(() => client.send(new DeleteCommand({
        TableName: tableName,
        Key: { PK: agenda.Item.PK, SK: agenda.Item.SK }
    })));
    
    logger.info("Agenda eliminada exitosamente", { agendaId });

    return successResponse({ message: "Agenda eliminada correctamente", agendaId });
}

module.exports.handler = createAPIHandler(eliminarAgendaHandler, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });