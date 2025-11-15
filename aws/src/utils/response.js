/**
 * Respuestas estandarizadas para AWS Lambda
 * Implementa formato consistente con success/error
 */

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

/**
 * Respuesta exitosa estandarizada
 * @param {*} data - Datos a retornar
 * @param {number} statusCode - Código HTTP (default: 200)
 * @param {object} meta - Metadata adicional (count, pagination, etc)
 * @returns {object} Response object para API Gateway
 */
function successResponse(data, statusCode = 200, meta = {}) {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  // Agregar metadata si existe
  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response)
  };
}

/**
 * Respuesta de error estandarizada
 * @param {string|Error} error - Error a reportar
 * @param {number} statusCode - Código HTTP (default: 500)
 * @param {object} details - Detalles adicionales
 * @returns {object} Response object para API Gateway
 */
function errorResponse(error, statusCode = 500, details = {}) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  const response = {
    success: false,
    error: {
      message: errorMessage,
      code: statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Solo incluir stack trace en desarrollo
  if (process.env.DEBUG === 'true' && error.stack) {
    response.error.stack = error.stack;
  }

  // Detalles adicionales del error
  if (Object.keys(details).length > 0) {
    response.error.details = details;
  }

  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(response)
  };
}

/**
 * Respuesta de validación fallida (400)
 * @param {array} errors - Lista de errores de validación
 * @returns {object} Response object
 */
function validationErrorResponse(errors) {
  return errorResponse('Validation failed', 400, { 
    validationErrors: errors 
  });
}

/**
 * Respuesta de autenticación requerida (401)
 * @param {string} message - Mensaje personalizado
 * @returns {object} Response object
 */
function unauthorizedResponse(message = 'Authentication required') {
  return errorResponse(message, 401);
}

/**
 * Respuesta de acceso denegado (403)
 * @param {string} message - Mensaje personalizado
 * @returns {object} Response object
 */
function forbiddenResponse(message = 'Access denied') {
  return errorResponse(message, 403);
}

/**
 * Respuesta de recurso no encontrado (404)
 * @param {string} resource - Nombre del recurso
 * @returns {object} Response object
 */
function notFoundResponse(resource = 'Resource') {
  return errorResponse(`${resource} not found`, 404);
}

/**
 * Función legacy 'response' para compatibilidad con código existente
 * @deprecated Use successResponse or errorResponse instead
 */
function response(statusCode, body) {
  // Si el body tiene 'ok: true', es success
  if (body && body.ok === true) {
    const { ok, ...data } = body;
    return successResponse(data, statusCode);
  }
  
  // Si tiene 'ok: false' o 'error', es error
  if (body && (body.ok === false || body.error)) {
    const errorMsg = body.error || 'Unknown error';
    const { ok, error, ...details } = body;
    return errorResponse(errorMsg, statusCode, details);
  }
  
  // Default: tratar como success si statusCode < 400
  if (statusCode < 400) {
    return successResponse(body, statusCode);
  } else {
    return errorResponse(body.message || 'Error', statusCode);
  }
}

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  response // Legacy compatibility
};
