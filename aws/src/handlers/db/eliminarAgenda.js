const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse, notFoundResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'eliminarAgenda' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('eliminarAgenda');
    const tableName = process.env.DB_AGENDA;
    const agendaId = event.queryStringParameters?.agendaId;
    
    if (!agendaId) {
        logger.warn("Intento de eliminación sin agendaId");
        endTrace();
        return errorResponse("agendaId es requerido", 400);
    }

    try {
        logger.info("Eliminando agenda", { agendaId });
        
        const getParams = {
            TableName: tableName,
            Key: {
                PK: agendaId,
                SK: agendaId
            }
        };

        const agenda = await client.send(new GetCommand(getParams));
        
        if (!agenda.Item) {
            logger.warn("Agenda no encontrada para eliminación", { agendaId });
            endTrace();
            return notFoundResponse("Agenda no encontrada");
        }

        const deleteParams = {
            TableName: tableName,
            Key: {
                PK: agenda.Item.PK,
                SK: agenda.Item.SK
            }
        };

        await client.send(new DeleteCommand(deleteParams));
        
        logger.info("Agenda eliminada exitosamente", { agendaId, pk: agenda.Item.PK });
        endTrace();

        return successResponse({ 
            message: "Agenda eliminada correctamente",
            agendaId
        });
    } catch (err) {
        logger.error("Error eliminando agenda", err, { agendaId });
        endTrace();
        return errorResponse("Error eliminando agenda", 500, { details: err.message });
    }
};