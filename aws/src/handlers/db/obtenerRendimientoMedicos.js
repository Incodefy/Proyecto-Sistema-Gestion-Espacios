const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerRendimientoMedicos' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerRendimientoMedicos');
  let filtros = null;

  if (event.body) {
    try {
      filtros = JSON.parse(event.body);
    } catch (err) {
      logger.warn('Invalid JSON body', { error: err.message });
      endTrace();
      return errorResponse('Body inválido. Debe ser JSON.', 400);
    }
  }

  const tableName = process.env.DB_AGENDA;
  
  if (!tableName) {
    logger.error('DB_AGENDA environment variable not set');
    endTrace();
    return errorResponse('Configuración de tabla no encontrada', 500);
  }

  const params = {
    TableName: tableName
  };

  // Solo filtro de fecha
  if (filtros?.fechaInicio && filtros?.fechaFin) {
    params.FilterExpression = '#fecha BETWEEN :fechaInicio AND :fechaFin';
    params.ExpressionAttributeValues = {
      ':fechaInicio': filtros.fechaInicio,
      ':fechaFin': filtros.fechaFin
    };
    params.ExpressionAttributeNames = {
      '#fecha': 'fecha'
    };
    
    logger.info('Date filter applied', {
      fecha_inicio: filtros.fechaInicio,
      fecha_fin: filtros.fechaFin
    });
  }

  try {
    let allItems = [];
    let lastEvaluatedKey = null;
    let scanCount = 0;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const data = await client.send(new ScanCommand(params));
      scanCount++;

      allItems = allItems.concat(data.Items || []);
      lastEvaluatedKey = data.LastEvaluatedKey;

    } while (lastEvaluatedKey);

    const rendimientoMedicos = {};

    allItems.forEach((item) => {
      const medico = item.medicoNombre;
      const especialidad = item.especialidadNombre;

      if (!medico) {
        return;
      }

      if (!rendimientoMedicos[medico]) {
        rendimientoMedicos[medico] = {
          consultas: 0,
          especialidad: especialidad ?? "No especificada"
        };
      }

      rendimientoMedicos[medico].consultas += 1;
    });

    const topMedicos = Object.entries(rendimientoMedicos)
      .sort((a, b) => b[1].consultas - a[1].consultas)
      .slice(0, 10)
      .map(([nombre, info]) => ({
        nombre,
        consultas: info.consultas,
        especialidad: info.especialidad
      }));

    logger.info('Top medicos calculated', {
      total_items: allItems.length,
      scan_iterations: scanCount,
      unique_medicos: Object.keys(rendimientoMedicos).length,
      top_count: topMedicos.length
    });

    endTrace();
    return successResponse(topMedicos, 200, { total: allItems.length });

  } catch (err) {
    logger.error('Error getting rendimiento médicos', err);
    endTrace();
    return errorResponse('Error obteniendo rendimiento de médicos', 500);
  }
};