/**
 * Request/Response Logging Middleware
 * 
 * Logging centralizado y sanitizado para TODAS las requests/responses
 * - Sanitiza datos sensibles (passwords, tokens, PII)
 * - Captura métricas de rendimiento
 * - Logs estructurados para CloudWatch Insights
 * - Correlación de requests
 */

const { createLogger } = require('../utils/logger');

// Campos sensibles que NUNCA deben loguearse
const SENSITIVE_FIELDS = [
  'password',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'cvv',
  'ssn',
  'taxId'
];

// Campos PII que deben ser enmascarados (no removidos)
const PII_FIELDS = [
  'email',
  'phone',
  'phoneNumber',
  'telefono',
  'dni',
  'rut',
  'passport',
  'medicalId',
  'patientId',
  'address',
  'direccion'
];

/**
 * Sanitiza un objeto removiendo/enmascarando datos sensibles
 */
function sanitizeData(data, depth = 0) {
  if (depth > 10) return '[Max depth reached]';
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }
  
  if (typeof data === 'object') {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      // Remover campos sensibles completamente
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }
      
      // Enmascarar PII
      if (PII_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        if (typeof value === 'string') {
          if (value.includes('@')) {
            // Email: show first 2 chars + @domain
            const parts = value.split('@');
            sanitized[key] = `${parts[0].substring(0, 2)}***@${parts[1]}`;
          } else if (value.length > 4) {
            // Otros: mostrar últimos 4 caracteres
            sanitized[key] = `***${value.substring(value.length - 4)}`;
          } else {
            sanitized[key] = '***';
          }
        } else {
          sanitized[key] = '[PII]';
        }
        continue;
      }
      
      // Recursivo para objetos anidados
      sanitized[key] = sanitizeData(value, depth + 1);
    }
    
    return sanitized;
  }
  
  return data;
}

/**
 * Extrae metadata útil del evento
 */
function extractRequestMetadata(event) {
  const httpMethod = event.httpMethod || event.requestContext?.http?.method || 'UNKNOWN';
  const path = event.path || event.requestContext?.http?.path || event.rawPath || 'UNKNOWN';
  const sourceIp = event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp || 'UNKNOWN';
  const userAgent = event.headers?.['user-agent'] || event.headers?.['User-Agent'] || 'UNKNOWN';
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub || 'anonymous';
  const correlationId = event.headers?.[' x-correlation-id'] || event.requestContext?.requestId || 'unknown';

  return {
    httpMethod,
    path,
    sourceIp,
    userAgent,
    userSub: userSub.substring(0, 12), // Solo primeros 12 chars para privacidad
    correlationId,
    timestamp: new Date().toISOString()
  };
}

/**
 * Middleware para loguear REQUEST
 */
async function logRequest(event, logger) {
  const metadata = extractRequestMetadata(event);
  const startTime = Date.now();
  
  // Parsear body si es string
  let bodyData = null;
  if (event.body) {
    try {
      bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (error) {
      bodyData = { raw: event.body?.substring(0, 100) };
    }
  }

  logger.info('Incoming request', {
    ...metadata,
    queryParams: sanitizeData(event.queryStringParameters),
    pathParams: sanitizeData(event.pathParameters),
    bodySize: event.body ? event.body.length : 0,
    // NO loguear body completo por defecto, solo en debug
    ...(process.env.LOG_LEVEL === 'debug' && { body: sanitizeData(bodyData) })
  });

  // Retornar startTime para calcular duración después
  event._requestStartTime = startTime;
  event._correlationId = metadata.correlationId;
  
  return event;
}

/**
 * Middleware para loguear RESPONSE
 */
async function logResponse(response, event, logger) {
  const metadata = extractRequestMetadata(event);
  const duration = Date.now() - (event._requestStartTime || Date.now());
  
  let responseBody = null;
  if (response.body) {
    try {
      responseBody = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    } catch (error) {
      responseBody = { raw: response.body?.substring(0, 100) };
    }
  }

  const logData = {
    ...metadata,
    statusCode: response.statusCode,
    duration,
    responseSize: response.body ? response.body.length : 0
  };

  // Determinar nivel de log según status code
  if (response.statusCode >= 500) {
    logger.error('Request failed (5xx)', {
      ...logData,
      error: sanitizeData(responseBody?.error)
    });
  } else if (response.statusCode >= 400) {
    logger.warn('Request failed (4xx)', {
      ...logData,
      error: sanitizeData(responseBody?.error)
    });
  } else {
    logger.info('Request completed successfully', {
      ...logData,
      ...(process.env.LOG_LEVEL === 'debug' && { response: sanitizeData(responseBody) })
    });
  }

  // Agregar correlation ID a headers de respuesta
  if (!response.headers) response.headers = {};
  response.headers['X-Correlation-ID'] = event._correlationId || 'unknown';
  response.headers['X-Response-Time'] = `${duration}ms`;

  return response;
}

/**
 * Middleware combinado que envuelve el handler
 */
function requestResponseLogger() {
  return {
    async before(event, logger) {
      return await logRequest(event, logger);
    },
    
    async after(response, event, logger) {
      return await logResponse(response, event, logger);
    },
    
    async onError(error, event, logger) {
      const metadata = extractRequestMetadata(event);
      const duration = Date.now() - (event._requestStartTime || Date.now());
      
      logger.error('Request error', {
        ...metadata,
        duration,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5) // Solo primeras 5 líneas de stack
        }
      });
      
      return error;
    }
  };
}

/**
 * Helper para logs de auditoría (acciones críticas)
 */
async function logAuditAction(action, details, userSub, logger) {
  logger.info('Audit log', {
    eventType: 'AUDIT',
    action,
    actor: userSub?.substring(0, 12),
    details: sanitizeData(details),
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  logRequest,
  logResponse,
  requestResponseLogger,
  sanitizeData,
  logAuditAction,
  extractRequestMetadata
};
