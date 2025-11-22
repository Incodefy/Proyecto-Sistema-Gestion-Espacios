const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerAgendaPorEspacio' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('obtenerAgendaPorEspacio');
    const space_id = event.queryStringParameters?.space_id;

    if (!space_id) {
        logger.warn("Consulta sin space_id");
        endTrace();
        return errorResponse("Debe enviar ?space_id=*", 400);
    }

    try {
        logger.info("Obteniendo agenda por espacio", { space_id });
        
        // Query directo por espacio específico
        const params = {
            TableName: process.env.DB_AGENDA,
            KeyConditionExpression: "begins_with(PK, :pk)",
            ExpressionAttributeValues: {
                ":pk": `${space_id}#DATE#`
            }
        };

        const result = await client.send(new QueryCommand(params));
        
        logger.info("Agenda obtenida por espacio", { space_id, count: result.Items?.length || 0 });
        endTrace();
        
        return successResponse(result.Items || [], 200, { space_id, count: result.Items?.length || 0 });
    } catch (err) {
        logger.error("Error obteniendo agenda por espacio", err, { space_id });
        endTrace();
        return errorResponse("Error obteniendo agenda", 500, { details: err.message });
    }
};
