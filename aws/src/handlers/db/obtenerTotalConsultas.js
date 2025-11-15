const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'obtenerTotalConsultas' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('obtenerTotalConsultas');
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

    const total = allItems.length;

    logger.info('Total consultas calculated', {
      total,
      scan_iterations: scanCount
    });

    endTrace();
    return successResponse({ total });

  } catch (err) {
    logger.error('Error getting total consultas', err);
    endTrace();
    return errorResponse('Error obteniendo total de consultas', 500);
  }
};