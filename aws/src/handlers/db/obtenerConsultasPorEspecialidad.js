const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerConsultasPorEspecialidad' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerConsultasPorEspecialidad');
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

  // Filtros de fecha y grupo
  const filterExpressions = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  if (filtros?.grupo_id) {
    filterExpressions.push('#grupo_id = :grupo_id');
    expressionAttributeValues[':grupo_id'] = filtros.grupo_id;
    expressionAttributeNames['#grupo_id'] = 'grupo_id';
  }

  if (filtros?.fechaInicio && filtros?.fechaFin) {
    filterExpressions.push('#fecha BETWEEN :fechaInicio AND :fechaFin');
    expressionAttributeValues[':fechaInicio'] = filtros.fechaInicio;
    expressionAttributeValues[':fechaFin'] = filtros.fechaFin;
    expressionAttributeNames['#fecha'] = 'fecha';
  }

  if (filterExpressions.length > 0) {
    params.FilterExpression = filterExpressions.join(' AND ');
    params.ExpressionAttributeValues = expressionAttributeValues;
    params.ExpressionAttributeNames = expressionAttributeNames;
    
    logger.info('Filters applied', {
      grupo_id: filtros?.grupo_id,
      fecha_inicio: filtros?.fechaInicio,
      fecha_fin: filtros?.fechaFin
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

    if (allItems.length === 0) {
      logger.info('No items found');
      endTrace();
      return successResponse([]);
    }

    // Contar consultas por especialidad
    const especialidadCounts = {};

    allItems.forEach(item => {
      const especialidad = item.especialidadNombre;

      if (!especialidad) {
        return;
      }

      especialidadCounts[especialidad] = (especialidadCounts[especialidad] || 0) + 1;
    });

    // Convertir a array y ordenar por consultas descendente
    const resultado = Object.entries(especialidadCounts)
      .map(([nombre, consultas]) => ({
        nombre,
        consultas
      }))
      .sort((a, b) => b.consultas - a.consultas);

    logger.info('Consultas por especialidad calculated', {
      total_items: allItems.length,
      scan_iterations: scanCount,
      especialidades_count: resultado.length
    });

    endTrace();
    return successResponse(resultado, 200, { total: allItems.length });

  } catch (err) {
    logger.error('Error getting consultas por especialidad', err);
    endTrace();
    return errorResponse('Error obteniendo consultas por especialidad', 500);
  }
};