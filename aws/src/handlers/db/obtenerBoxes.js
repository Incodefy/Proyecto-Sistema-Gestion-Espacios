const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerBoxes' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async () => {
    const endTrace = logger.startTrace('obtenerBoxes');

    try {
        logger.info("Obteniendo boxes (SUBSPACE) desde SPACES_TABLE");
        
        const params = {
            TableName: process.env.SPACES_TABLE,
            FilterExpression: '#type = :typeVal',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':typeVal': 'SUBSPACE'
            }
        };

        const data = await client.send(new ScanCommand(params));
        
        // Mapear a formato legacy (idBox, nombre)
        const boxes = (data.Items || []).map(item => ({
            idBox: item.id,
            nombre: item.name,
            grupo_id: item.grupo_id,
            parent_id: item.parent_id
        }));
        
        logger.info("Boxes obtenidos", { count: boxes.length });
        endTrace();
        
        return successResponse(boxes, 200, { count: boxes.length });
    } catch (err) {
        logger.error("Error obteniendo boxes", err);
        endTrace();
        return errorResponse("Error obteniendo boxes", 500, { details: err.message });
    }
};