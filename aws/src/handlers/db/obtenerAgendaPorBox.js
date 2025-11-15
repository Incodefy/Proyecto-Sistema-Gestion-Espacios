const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerAgendaPorBox' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('obtenerAgendaPorBox');
    const box_id = event.queryStringParameters?.box_id;

    if (!box_id) {
        logger.warn("Consulta sin box_id");
        endTrace();
        return errorResponse("Debe enviar ?box_id=*", 400);
    }

    try {
        logger.info("Obteniendo agenda por box", { box_id });
        
        // Cambio de ScanCommand a QueryCommand para mejor performance
        const params = {
            TableName: process.env.DB_AGENDA,
            KeyConditionExpression: "begins_with(PK, :pk)",
            ExpressionAttributeValues: {
                ":pk": `BOX#${box_id}`
            }
        };

        const result = await client.send(new QueryCommand(params));
        
        logger.info("Agenda obtenida por box", { box_id, count: result.Items?.length || 0 });
        endTrace();
        
        return successResponse(result.Items || [], 200, { box_id, count: result.Items?.length || 0 });
    } catch (err) {
        logger.error("Error obteniendo agenda por box", err, { box_id });
        endTrace();
        return errorResponse("Error obteniendo agenda", 500, { details: err.message });
    }
};
