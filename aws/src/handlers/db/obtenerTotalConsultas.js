const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { sanitizeEvent } = require("../../utils/sanitizer");
const { checkRateLimit } = require("../../middleware/rateLimiter");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerTotalConsultas' });
  const endTrace = logger.startTrace('obtenerTotalConsultas');
  
  // Sanitizar evento
  const sanitized = sanitizeEvent(event);
  const userSub = sanitized.requestContext?.authorizer?.jwt?.claims?.sub;
  
  // Rate limiting: 40 scans por minuto (scan completo costoso)
  if (userSub) {
    const rateLimitCheck = await checkRateLimit(userSub, 40, 60, 'obtener-total-consultas');
    if (!rateLimitCheck.allowed) {
      logger.warn('Rate limit exceeded', { userSub });
      endTrace();
      return errorResponse('Demasiadas solicitudes. Intente más tarde.', 429);
    }
  }
  
  let filtros = null;

  if (sanitized.body) {
    try {
      filtros = JSON.parse(sanitized.body);
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