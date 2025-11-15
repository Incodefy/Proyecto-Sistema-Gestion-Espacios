const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerEstadoNoAtendido' });

module.exports.handler = async () => {
    const endTrace = logger.startTrace('obtenerEstadoNoAtendido');

    const params = {
        TableName: process.env.DB_CATALOGO,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
            ":pk": "ESTADO#2"
        }
    };

    try {
        const data = await client.send(new QueryCommand(params));
        const estadoId = data.Items?.[0]?.idEstado || null;
        
        logger.info('Estado no atendido retrieved', { estado_id: estadoId });
        endTrace();
        return successResponse({ idEstado: estadoId });
    } catch (err) {
        logger.error('Error retrieving estado no atendido', err);
        endTrace();
        return errorResponse('Error obteniendo estado \'no atendido\'', 500);
    }
};
