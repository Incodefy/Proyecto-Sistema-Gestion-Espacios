const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerMedicosPorEspecialidades' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerMedicosPorEspecialidades');
  let especialidades;
  
  try {
    const body = JSON.parse(event.body || "{}");
    especialidades = body.especialidades;
  } catch (err) {
    logger.warn('Invalid JSON body', { error: err.message });
    endTrace();
    return errorResponse('El body debe ser un JSON válido con la lista de especialidades.', 400);
  }

  if (!Array.isArray(especialidades) || especialidades.length === 0) {
    logger.warn('Invalid especialidades array', { especialidades });
    endTrace();
    return errorResponse('Debe enviar una lista de especialidades.', 400);
  }

  const params = {
    TableName: process.env.DB_CATALOGO,
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: {
      ":pk": "MEDICO#"
    }
  };

  try {
    const data = await client.send(new ScanCommand(params));

    const medicoIds = data.Items
      .filter(item => especialidades.includes(item.idEspecialidad))
      .map(item => item.idMedico);

    logger.info('Medicos filtered by especialidades', { 
      especialidades_requested: especialidades.length,
      medicos_found: medicoIds.length 
    });
    endTrace();
    return successResponse(medicoIds, 200, { count: medicoIds.length });

  } catch (err) {
    logger.error('Error retrieving medicos by especialidades', err, { especialidades });
    endTrace();
    return errorResponse('Error obteniendo médicos por especialidad', 500);
  }
};
