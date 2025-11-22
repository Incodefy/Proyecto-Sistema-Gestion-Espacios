const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'obtenerEspaciosEspecificos' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Obtiene todos los espacios específicos (SUBSPACE) de un grupo
 * Reemplazo de: obtenerBoxes.js
 */
module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('obtenerEspaciosEspecificos');

    try {
        const grupoId = event.queryStringParameters?.grupo_id;
        
        if (!grupoId) {
            logger.warn("Missing grupo_id parameter");
            endTrace();
            return errorResponse("grupo_id es requerido", 400);
        }

        logger.info("Obteniendo espacios específicos", { grupoId });
        
        const params = {
            TableName: process.env.SPACES_TABLE,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': grupoId,
                ':sk': 'SUBSPACE#'
            }
        };

        const data = await client.send(new QueryCommand(params));
        
        logger.info("Espacios específicos obtenidos", { count: data.Items?.length || 0 });
        endTrace();
        
        return successResponse(data.Items || [], 200, { count: data.Items?.length || 0 });
    } catch (err) {
        logger.error("Error obteniendo espacios específicos", err);
        endTrace();
        return errorResponse("Error obteniendo espacios específicos", 500, { details: err.message });
    }
};
