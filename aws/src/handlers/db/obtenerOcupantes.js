const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerOcupantes' });

/**
 * Obtiene todos los ocupantes (OCCUPANT) de un grupo
 * Reemplazo de: obtenerMedicos.js
 */
module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('query-ocupantes');
    
    try {
        const grupoId = event.queryStringParameters?.grupo_id;
        
        if (!grupoId) {
            logger.warn("Missing grupo_id parameter");
            endTrace();
            return errorResponse("grupo_id es requerido", 400);
        }

        const params = {
            TableName: process.env.OCCUPANTS_TABLE,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues: {
                ":pk": grupoId,
                ":sk": "OCCUPANT#"
            }
        };

        const data = await client.send(new QueryCommand(params));
        const count = data.Items?.length || 0;
        
        logger.info('Ocupantes obtenidos exitosamente', { count });
        endTrace({ success: true, count });
        
        return successResponse(data.Items, 200, { count });
    } catch (err) {
        logger.error('Error obteniendo ocupantes', err, { 
            table: process.env.OCCUPANTS_TABLE
        });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo ocupantes', 500);
    }
};
