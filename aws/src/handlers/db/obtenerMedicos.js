const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerMedicos' });

module.exports.handler = async () => {
    const endTrace = logger.startTrace('obtenerMedicos');
    
    const params = {
        TableName: process.env.OCCUPANTS_TABLE
    };

    try {
        const data = await client.send(new ScanCommand(params));
        
        // Mapear a formato legacy (idMedico, nombre, idEspecialidad, especialidad)
        const medicos = (data.Items || []).map(item => ({
            idMedico: item.id,
            nombre: item.name,
            idEspecialidad: item.especialidad_id,
            especialidad: item.especialidad,
            grupo_id: item.grupo_id
        }));
        
        const count = medicos.length;
        
        logger.info('Médicos obtenidos exitosamente', { count });
        endTrace({ success: true, count });
        
        return successResponse(medicos, 200, { count });
    } catch (err) {
        logger.error('Error obteniendo médicos', err, { 
            table: process.env.OCCUPANTS_TABLE
        });
        endTrace({ success: false, error: err.message });
        
        return errorResponse('Error obteniendo médicos', 500);
    }
};
