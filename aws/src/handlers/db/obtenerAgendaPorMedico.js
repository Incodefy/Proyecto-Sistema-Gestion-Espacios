const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse, validationErrorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerAgendaPorMedico' });

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('query-agenda-by-doctor');
    
    // Obtener medico_id de queryString
    const medico_id = event.queryStringParameters?.medico_id;
    
    // Validar parámetros
    const validation = validate({ medico_id: medico_id ? parseInt(medico_id) : undefined }, 'consultaPorMedico');
    if (!validation.valid) {
        logger.warn('Invalid medico_id parameter', { errors: validation.errors });
        endTrace({ success: false, reason: 'validation' });
        return validationErrorResponse(validation.errors);
    }

    const params = {
        TableName: process.env.DB_AGENDA,
        IndexName: "MedicoFechaIndex",
        KeyConditionExpression: "begins_with(GSI1PK, :prefix)",
        ExpressionAttributeValues: {
            ":prefix": `MEDICO#${medico_id}`
        }
    };

    try {
        const result = await client.send(new QueryCommand(params));
        const count = result.Items?.length || 0;
        
        logger.info('Agenda fetched by doctor', { medico_id, count });
        endTrace({ success: true, count });
        
        return successResponse(result.Items || [], 200, { count, medico_id });
    } catch (err) {
        logger.error('Failed to fetch agenda by doctor', err, { medico_id });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo agenda', 500);
    }
};
