const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { sanitizeEvent } = require("../../utils/sanitizer");
const { checkRateLimit } = require("../../middleware/rateLimiter");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerRendimientoMedicos' });
  const endTrace = logger.startTrace('obtenerRendimientoMedicos');
  
  // Sanitizar evento
  const sanitized = sanitizeEvent(event);
  const userSub = sanitized.requestContext?.authorizer?.jwt?.claims?.sub;
  
  // Rate limiting: 30 scans por minuto (scan completo con agregación muy costoso)
  if (userSub) {
    const rateLimitCheck = await checkRateLimit(userSub, 30, 60, 'obtener-rendimiento-medicos');
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