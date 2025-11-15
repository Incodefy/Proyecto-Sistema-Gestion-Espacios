const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerMedicos' });

module.exports.handler = async () => {
    const endTrace = logger.startTrace('query-medicos');
    
    // ✅ Query con índice GSI - 100x más rápido que Scan
    const params = {
        TableName: process.env.DB_CATALOGO,
        IndexName: "TipoEntidadIndex",
        KeyConditionExpression: "GSI1PK = :tipo",
        ExpressionAttributeValues: {
            ":tipo": "TIPO#MEDICO"
        }
    };

    try {
        const data = await client.send(new QueryCommand(params));
        const count = data.Items?.length || 0;
        
        logger.info('Doctors fetched successfully', { count });
        endTrace({ success: true, count });
        
        return successResponse(data.Items, 200, { count });
    } catch (err) {
        logger.error('Failed to fetch doctors', err, { 
            table: process.env.DB_CATALOGO,
            index: 'TipoEntidadIndex'
        });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo médicos', 500);
    }
};
