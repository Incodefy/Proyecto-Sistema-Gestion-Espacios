const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { sanitizeEvent } = require("../../utils/sanitizer");
const { checkRateLimit } = require("../../middleware/rateLimiter");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerConsultasPorDia' });
  const endTrace = logger.startTrace('obtenerConsultasPorDia');
  
  // Sanitizar evento
  const sanitized = sanitizeEvent(event);
  const userSub = sanitized.requestContext?.authorizer?.jwt?.claims?.sub;
  
  // Rate limiting: 50 scans por minuto (scan es muy costoso)
  if (userSub) {
    const rateLimitCheck = await checkRateLimit(userSub, 50, 60, 'obtener-consultas-dia');
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

    // Inicializar array de 7 días ordenado (Lunes=0, Martes=1, ..., Domingo=6)
    const consultasPorDia = Array(7).fill(0);
    const debug = [];

    allItems.forEach(item => {
      if (!item.fecha) {
        return;
      }

      // Usar UTC para evitar problemas de timezone
      const [year, month, day] = item.fecha.split('-').map(Number);
      const diaJS = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      
      // Convertir de formato JavaScript (0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab)
      // a formato Lunes-Domingo (0=Lun, 1=Mar, 2=Mie, 3=Jue, 4=Vie, 5=Sab, 6=Dom)
      let diaOrdenado;
      if (diaJS === 0) {
        diaOrdenado = 6; // Domingo va al final
      } else {
        diaOrdenado = diaJS - 1; // Lunes(1)->0, Martes(2)->1, etc.
      }
      
      debug.push({
        fecha: item.fecha,
        diaJS: diaJS,
        diaJSNombre: ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][diaJS],
        diaOrdenado: diaOrdenado,
        diaOrdenadoNombre: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'][diaOrdenado]
      });
      
      if (!isNaN(diaOrdenado)) {
        consultasPorDia[diaOrdenado] += 1;
      }
    });

    logger.info('Consultas por día calculated', {
      total_items: allItems.length,
      scan_iterations: scanCount,
      results: consultasPorDia,
      debug_sample: debug.slice(0, 10),
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
    });

    endTrace();
    return successResponse(consultasPorDia, 200, { 
      total: allItems.length,
      debug: debug,
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
    });

  } catch (err) {
    logger.error('Error getting consultas por día', err);
    endTrace();
    return errorResponse('Error obteniendo consultas por día', 500);
  }
};