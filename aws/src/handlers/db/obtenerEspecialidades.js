const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerEspecialidades' });

module.exports.handler = async () => {
    const endTrace = logger.startTrace('obtenerEspecialidades');
    
    const params = {
        TableName: process.env.ESPECIALIDADES_TABLE
    };

    try {
        const data = await client.send(new ScanCommand(params));
        
        // Mapear a formato legacy (idEspecialidad, nombre)
        const especialidades = (data.Items || []).map(item => ({
            idEspecialidad: item.id,
            nombre: item.nombre,
            grupo_id: item.grupo_id
        }));
        
        const count = especialidades.length;
        
        logger.info('Especialidades obtenidas exitosamente', { count });
        endTrace({ success: true, count });
        
        return successResponse(especialidades, 200, { count });
    } catch (err) {
        logger.error('Error obteniendo especialidades', err, { 
            table: process.env.ESPECIALIDADES_TABLE
        });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo especialidades', 500);
    }
};
