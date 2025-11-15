const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse, validationErrorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerAgendaPorFecha' });

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('query-agenda-by-date');
    const fecha = event.queryStringParameters?.fecha;

    // Validar parámetros
    const validation = validate({ fecha }, 'consultaPorFecha');
    if (!validation.valid) {
        logger.warn('Invalid date parameter', { errors: validation.errors });
        endTrace({ success: false, reason: 'validation' });
        return validationErrorResponse(validation.errors);
    }

    const params = {
        TableName: process.env.DB_AGENDA,
        IndexName: "FechaIndex",
        KeyConditionExpression: "GSI2PK = :fecha",
        ExpressionAttributeValues: {
            ":fecha": `DATE#${fecha}`
        }
    };

    try {
        const result = await client.send(new QueryCommand(params));
        const count = result.Items?.length || 0;
        
        logger.info('Agenda fetched by date', { fecha, count });
        endTrace({ success: true, count });
        
        return successResponse(result.Items || [], 200, { count, fecha });
    } catch (err) {
        logger.error('Failed to fetch agenda by date', err, { fecha });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo agenda', 500);
    }
};
