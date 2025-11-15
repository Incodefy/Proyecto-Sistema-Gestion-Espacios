const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerEspecialidades' });

module.exports.handler = async () => {
    const endTrace = logger.startTrace('query-especialidades');
    
    // ✅ Query con índice GSI - 100x más rápido que Scan
    const params = {
        TableName: process.env.DB_CATALOGO,
        IndexName: "TipoEntidadIndex",
        KeyConditionExpression: "GSI1PK = :tipo",
        ExpressionAttributeValues: {
            ":tipo": "TIPO#ESPECIALIDAD"
        }
    };

    try {
        const data = await client.send(new QueryCommand(params));
        const count = data.Items?.length || 0;
        
        logger.info('Specialties fetched successfully', { count });
        endTrace({ success: true, count });
        
        return successResponse(data.Items, 200, { count });
    } catch (err) {
        logger.error('Failed to fetch specialties', err, { 
            table: process.env.DB_CATALOGO,
            index: 'TipoEntidadIndex'
        });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo especialidades', 500);
    }
};
