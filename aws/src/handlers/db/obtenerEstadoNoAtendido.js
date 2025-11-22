const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerEstadoNoAtendido' });

module.exports.handler = async () => {
    const endTrace = logger.startTrace('obtenerEstadoNoAtendido');

    try {
        // Estado "No Atendido" es siempre 2 en el sistema
        const estadoId = 2;
        
        logger.info('Estado no atendido retrieved', { estado_id: estadoId });
        endTrace();
        return successResponse({ idEstado: estadoId });
    } catch (err) {
        logger.error('Error retrieving estado no atendido', err);
        endTrace();
        return errorResponse('Error obteniendo estado \'no atendido\'', 500);
    }
};
