const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse, validationErrorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerAgendaPorOcupante' });

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('query-agenda-by-occupant');
    
    // Obtener occupant_id de queryString
    const occupant_id = event.queryStringParameters?.occupant_id;
    
    // Validar parámetros
    if (!occupant_id) {
        logger.warn('Missing occupant_id parameter');
        endTrace({ success: false, reason: 'validation' });
        return errorResponse('occupant_id es requerido', 400);
    }

    const params = {
        TableName: process.env.DB_AGENDA,
        IndexName: "MedicoFechaIndex",
        KeyConditionExpression: "begins_with(GSI1PK, :prefix)",
        ExpressionAttributeValues: {
            ":prefix": `${occupant_id}#DATE#`
        }
    };

    try {
        const result = await client.send(new QueryCommand(params));
        const count = result.Items?.length || 0;
        
        logger.info('Agenda obtenida por ocupante', { occupant_id, count });
        endTrace({ success: true, count });
        
        return successResponse(result.Items || [], 200, { count, occupant_id });
    } catch (err) {
        logger.error('Error obteniendo agenda por ocupante', err, { occupant_id });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo agenda', 500);
    }
};
