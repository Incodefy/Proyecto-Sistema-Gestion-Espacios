const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerInstrumentosPorBox' });

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('obtenerInstrumentosPorBox');
    const boxId = event.queryStringParameters?.boxId;

    if (!boxId) {
        logger.warn('Missing boxId parameter');
        endTrace();
        return errorResponse('boxId es requerido', 400);
    }

    const params = {
        TableName: process.env.DB_BOX_INSTRUMENTO,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
            ":pk": `BOX#${boxId}`
        }
    };

    try {
        const result = await client.send(new QueryCommand(params));
        
        logger.info('Instrumentos retrieved for box', { box_id: boxId, count: result.Items?.length || 0 });
        endTrace();
        return successResponse(result.Items || [], 200, { count: result.Items?.length || 0 });
    } catch (err) {
        logger.error('Error retrieving instrumentos by box', err, { box_id: boxId });
        endTrace();
        return errorResponse('Error obteniendo instrumentos por box', 500);
    }
};