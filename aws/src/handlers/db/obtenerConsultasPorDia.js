const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerConsultasPorDia' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerConsultasPorDia');
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

  const grupoId = filtros?.grupo_id;
  if (!grupoId) {
    logger.error('grupo_id is required');
    endTrace();
    return errorResponse('grupo_id es requerido en los filtros', 400);
  }

  const tableName = process.env.DB_AGENDA;
  
  if (!tableName) {
    logger.error('DB_AGENDA environment variable not set');
    endTrace();
    return errorResponse('Configuración de tabla no encontrada', 500);
  }

  const params = {
    TableName: tableName,
    IndexName: 'GrupoIndex',
    KeyConditionExpression: 'GSI3PK = :grupoPK',
    ExpressionAttributeValues: {
      ':grupoPK': `GRUPO#${grupoId}`
    }
  };

  // Agregar filtro de fecha
  if (filtros?.fechaInicio && filtros?.fechaFin) {
    params.FilterExpression = '#fecha BETWEEN :fechaInicio AND :fechaFin';
    params.ExpressionAttributeValues[':fechaInicio'] = filtros.fechaInicio;
    params.ExpressionAttributeValues[':fechaFin'] = filtros.fechaFin;
    params.ExpressionAttributeNames = {
      '#fecha': 'fecha'
    };
    
    logger.info('Date filter applied', {
      grupo_id: grupoId,
      fecha_inicio: filtros.fechaInicio,
      fecha_fin: filtros.fechaFin
    });
  }

  try {
    let allItems = [];
    let lastEvaluatedKey = null;
    let queryCount = 0;

    do {
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const data = await client.send(new QueryCommand(params));
      queryCount++;

      allItems = allItems.concat(data.Items || []);
      lastEvaluatedKey = data.LastEvaluatedKey;

    } while (lastEvaluatedKey);

    // Inicializar array de 7 días (Domingo=0, Lunes=1, ..., Sábado=6)
    const consultasPorDia = Array(7).fill(0);

    allItems.forEach(item => {
      if (!item.fecha) {
        return;
      }

      const dia = new Date(item.fecha).getDay();
      if (!isNaN(dia)) {
        consultasPorDia[dia] += 1;
      }
    });

    logger.info('Consultas por día calculated', {
      total_items: allItems.length,
      scan_iterations: scanCount,
      results: consultasPorDia
    });

    endTrace();
    return successResponse(consultasPorDia, 200, { total: allItems.length });

  } catch (err) {
    logger.error('Error getting consultas por día', err);
    endTrace();
    return errorResponse('Error obteniendo consultas por día', 500);
  }
};