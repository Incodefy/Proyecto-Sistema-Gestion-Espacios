const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerInstrumentosPorBox' });

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('obtenerInstrumentosPorBox');
    const boxId = event.queryStringParameters?.boxId;
    const grupoId = event.queryStringParameters?.grupo_id;

    if (!boxId) {
        logger.warn('Missing boxId parameter');
        endTrace();
        return errorResponse('boxId es requerido', 400);
    }

    if (!grupoId) {
        logger.warn('Missing grupo_id parameter');
        endTrace();
        return errorResponse('grupo_id es requerido', 400);
    }

    try {
        // 1. Obtener relaciones espacio-instrumento para este box
        const relacionesParams = {
            TableName: process.env.ESPACIO_INSTRUMENTO_TABLE,
            KeyConditionExpression: "espacio_id = :espacioId",
            ExpressionAttributeValues: {
                ":espacioId": boxId
            }
        };

        const relacionesResult = await client.send(new QueryCommand(relacionesParams));
        
        if (!relacionesResult.Items || relacionesResult.Items.length === 0) {
            logger.info('No instruments found for box', { box_id: boxId });
            endTrace();
            return successResponse([], 200, { count: 0 });
        }

        // 2. Obtener detalles de cada instrumento
        const instrumentoIds = relacionesResult.Items.map(rel => rel.instrumento_id);
        const keys = instrumentoIds.map(id => ({ id }));

        const batchParams = {
            RequestItems: {
                [process.env.INSTRUMENTOS_TABLE]: {
                    Keys: keys
                }
            }
        };

        const instrumentosResult = await client.send(new BatchGetCommand(batchParams));
        const instrumentos = instrumentosResult.Responses?.[process.env.INSTRUMENTOS_TABLE] || [];

        // 3. Mapear a estructura legacy
        const instrumentosFormateados = instrumentos.map(item => ({
            nombre: item.nombre,
            cantidad: 1, // No hay cantidad en nueva estructura
            tipo: item.tipo_instrumento_id || ''
        }));
        
        logger.info('Instrumentos retrieved for box', { box_id: boxId, grupo_id: grupoId, count: instrumentosFormateados.length });
        endTrace();
        return successResponse(instrumentosFormateados, 200, { count: instrumentosFormateados.length });
    } catch (err) {
        logger.error('Error retrieving instrumentos', err, { box_id: boxId, grupo_id: grupoId });
        endTrace();
        return errorResponse('Error obteniendo instrumentos', 500);
    }
};