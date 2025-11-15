const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerBoxes' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async () => {
    const endTrace = logger.startTrace('obtenerBoxes');

    try {
        logger.info("Obteniendo boxes desde catálogo");
        
        // Cambio de ScanCommand a QueryCommand para mejor performance
        const params = {
            TableName: process.env.DB_CATALOGO,
            KeyConditionExpression: 'begins_with(PK, :pk)',
            ExpressionAttributeValues: {
                ':pk': 'BOX#'
            }
        };

        const data = await client.send(new QueryCommand(params));
        
        logger.info("Boxes obtenidos", { count: data.Items?.length || 0 });
        endTrace();
        
        return successResponse(data.Items || [], 200, { count: data.Items?.length || 0 });
    } catch (err) {
        logger.error("Error obteniendo boxes", err);
        endTrace();
        return errorResponse("Error obteniendo boxes", 500, { details: err.message });
    }
};