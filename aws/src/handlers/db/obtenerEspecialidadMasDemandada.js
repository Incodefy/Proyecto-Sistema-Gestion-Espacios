const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { sanitizeEvent } = require("../../utils/sanitizer");
const { checkRateLimit } = require("../../middleware/rateLimiter");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerEspecialidadMasDemandada' });
  const endTrace = logger.startTrace('obtenerEspecialidadMasDemandada');
  
  // Sanitizar evento
  const sanitized = sanitizeEvent(event);
  const userSub = sanitized.requestContext?.authorizer?.jwt?.claims?.sub;
  
  // Rate limiting: 30 queries por minuto (scan completo muy costoso con agregación)
  if (userSub) {
    const rateLimitCheck = await checkRateLimit(userSub, 30, 60, 'obtener-especialidad-demandada');
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

    if (allItems.length === 0) {
      logger.info('No items found');
      endTrace();
      return successResponse({ nombre: null, consultas: 0 });
    }

    const especialidadCounts = {};

    allItems.forEach(item => {
      const especialidad = item.especialidadNombre;

      if (!especialidad) return;

      especialidadCounts[especialidad] = (especialidadCounts[especialidad] || 0) + 1;
    });

    if (Object.keys(especialidadCounts).length === 0) {
      logger.info('No especialidades found');
      endTrace();
      return successResponse({ nombre: null, consultas: 0 });
    }

    const maxEspecialidad = Object.entries(especialidadCounts)
      .reduce((max, current) => current[1] > max[1] ? current : max);

    const response = {
      nombre: maxEspecialidad[0],
      consultas: maxEspecialidad[1]
    };

    logger.info('Most demanded especialidad calculated', {
      total_items: allItems.length,
      scan_iterations: scanCount,
      especialidad: response.nombre,
      consultas: response.consultas
    });

    endTrace();
    return successResponse(response);

  } catch (err) {
    logger.error('Error getting especialidad más demandada', err);
    endTrace();
    return errorResponse('Error obteniendo especialidad más demandada', 500);
  }
};

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: "Error obteniendo especialidad más demandada",
        message: err.message
      })
    };
  }
};