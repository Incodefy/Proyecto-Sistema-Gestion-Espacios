/**
 * Request/Response Interceptors
 * 
 * Middleware pattern para procesamiento automático de requests/responses:
 * - Parsing automático de body
 * - Validación de headers
 * - Transformación de datos
 * - Logging automático
 * - Error handling
 * - Rate limiting
 * - Security headers
 */

const { Logger } = require('../utils/logger');
const { getSecurityHeaders } = require('./securityHeaders');
const { checkRateLimit } = require('./rateLimiter');

class RequestInterceptor {
  constructor() {
    this.middleware = [];
  }

  /**
   * Agrega middleware
   */
  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  /**
   * Ejecuta todos los middleware en orden
   */
  async execute(event, context, logger) {
    let processedEvent = event;
    
    for (const fn of this.middleware) {
      processedEvent = await fn(processedEvent, context, logger);
      if (!processedEvent) {
        throw new Error('Middleware returned null/undefined');
      }
    }
    
    return processedEvent;
  }
}

class ResponseInterceptor {
  constructor() {
    this.middleware = [];
  }

  /**
   * Agrega middleware
   */
  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  /**
   * Ejecuta todos los middleware en orden
   */
  async execute(response, event, logger) {
    let processedResponse = response;
    
    for (const fn of this.middleware) {
      processedResponse = await fn(processedResponse, event, logger);
      if (!processedResponse) {
        throw new Error('Response middleware returned null/undefined');
      }
    }
    
    return processedResponse;
  }
}

/**
 * Middleware predefinidos para requests
 */

/**
 * Parse body automáticamente
 */
async function parseBodyMiddleware(event, context, logger) {
  if (event.body && typeof event.body === 'string') {
    try {
      event.parsedBody = JSON.parse(event.body);
      logger.debug('Body parsed successfully');
    } catch (error) {
      logger.warn('Failed to parse body', { error: error.message });
      throw new Error('Invalid JSON in request body');
    }
  } else if (event.body && typeof event.body === 'object') {
    event.parsedBody = event.body;
  } else {
    event.parsedBody = {};
  }
  
  return event;
}

/**
 * Sanitización automática
 */
async function sanitizeMiddleware(event, context, logger) {
  const sanitized = sanitizeEvent(event);
  logger.debug('Event sanitized');
  return sanitized;
}

/**
 * Extrae user context
 */
async function extractUserContextMiddleware(event, context, logger) {
  event.userContext = {
    sub: event.requestContext?.authorizer?.jwt?.claims?.sub,
    email: event.requestContext?.authorizer?.jwt?.claims?.email,
    username: event.requestContext?.authorizer?.jwt?.claims?.['cognito:username'],
    groups: event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'] || [],
    sourceIp: event.requestContext?.http?.sourceIp
  };
  
  logger.debug('User context extracted', {
    userSub: event.userContext.sub,
    groups: event.userContext.groups.length
  });
  
  return event;
}

/**
 * Rate limiting middleware
 */
function createRateLimitMiddleware(limit, window, endpoint) {
  return async (event, context, logger) => {
    const userSub = event.userContext?.sub || event.requestContext?.http?.sourceIp;
    
    if (!userSub) {
      logger.warn('No user context for rate limiting');
      return event;
    }

    const result = await checkRateLimit(userSub, limit, window, endpoint);
    
    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        userSub,
        endpoint,
        limit,
        window
      });
      
      throw {
        statusCode: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryAfter: result.retryAfter
      };
    }

    event.rateLimitInfo = result;
    return event;
  };
}

/**
 * Validación de headers requeridos
 */
function createRequiredHeadersMiddleware(requiredHeaders = []) {
  return async (event, context, logger) => {
    const headers = event.headers || {};
    const missing = [];

    for (const header of requiredHeaders) {
      if (!headers[header] && !headers[header.toLowerCase()]) {
        missing.push(header);
      }
    }

    if (missing.length > 0) {
      logger.warn('Missing required headers', { missing });
      throw {
        statusCode: 400,
        code: 'MISSING_HEADERS',
        message: `Missing required headers: ${missing.join(', ')}`
      };
    }

    return event;
  };
}

/**
 * Middleware predefinidos para responses
 */

/**
 * Agrega security headers
 */
async function securityHeadersMiddleware(response, event, logger) {
  if (!response.headers) {
    response.headers = {};
  }
  
  response.headers = {
    ...getSecurityHeaders(),
    ...response.headers
  };
  
  return response;
}

/**
 * Agrega correlation ID header
 */
async function correlationIdMiddleware(response, event, logger) {
  if (!response.headers) {
    response.headers = {};
  }
  
  response.headers['X-Correlation-ID'] = logger.getCorrelationId();
  return response;
}

/**
 * Stringify body automáticamente si es objeto
 */
async function stringifyBodyMiddleware(response, event, logger) {
  if (response.body && typeof response.body === 'object') {
    response.body = JSON.stringify(response.body);
  }
  
  return response;
}

/**
 * Log response automáticamente
 */
async function logResponseMiddleware(response, event, logger) {
  logger.info('Response sent', {
    statusCode: response.statusCode,
    bodySize: response.body?.length || 0
  });
  
  return response;
}

/**
 * Agrega metadata de performance
 */
async function performanceMiddleware(response, event, logger) {
  if (!response.headers) {
    response.headers = {};
  }
  
  const duration = Date.now() - event._startTime;
  response.headers['X-Response-Time'] = `${duration}ms`;
  
  logger.metric('response_time', duration, 'Milliseconds');
  
  return response;
}

/**
 * Handler wrapper que aplica interceptors
 */
function createHandler(handlerFn, options = {}) {
  const requestInterceptor = new RequestInterceptor();
  const responseInterceptor = new ResponseInterceptor();

  // Request middleware por defecto
  requestInterceptor
    .use(parseBodyMiddleware)
    .use(sanitizeMiddleware)
    .use(extractUserContextMiddleware);

  // Agregar rate limiting si está especificado
  if (options.rateLimit) {
    requestInterceptor.use(
      createRateLimitMiddleware(
        options.rateLimit.limit,
        options.rateLimit.window,
        options.rateLimit.endpoint
      )
    );
  }

  // Agregar headers requeridos si están especificados
  if (options.requiredHeaders) {
    requestInterceptor.use(
      createRequiredHeadersMiddleware(options.requiredHeaders)
    );
  }

  // Custom request middleware
  if (options.requestMiddleware) {
    for (const middleware of options.requestMiddleware) {
      requestInterceptor.use(middleware);
    }
  }

  // Response middleware por defecto
  responseInterceptor
    .use(securityHeadersMiddleware)
    .use(correlationIdMiddleware)
    .use(performanceMiddleware)
    .use(stringifyBodyMiddleware)
    .use(logResponseMiddleware);

  // Custom response middleware
  if (options.responseMiddleware) {
    for (const middleware of options.responseMiddleware) {
      responseInterceptor.use(middleware);
    }
  }

  return async (event, context) => {
    const logger = Logger.fromEvent(event);
    event._startTime = Date.now();

    try {
      // Ejecutar request interceptors
      const processedEvent = await requestInterceptor.execute(event, context, logger);
      
      logger.info('Handler processing', {
        path: event.requestContext?.http?.path,
        method: event.requestContext?.http?.method
      });

      // Ejecutar handler
      let response = await handlerFn(processedEvent, context, logger);

      // Ejecutar response interceptors
      response = await responseInterceptor.execute(response, processedEvent, logger);

      return response;
    } catch (error) {
      // Error handling
      logger.error('Handler error', error);

      const errorResponse = {
        statusCode: error.statusCode || 500,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          ok: false,
          error: error.message || 'Internal server error',
          code: error.code || 'INTERNAL_ERROR'
        })
      };

      if (error.retryAfter) {
        errorResponse.headers['Retry-After'] = error.retryAfter;
      }

      return errorResponse;
    }
  };
}

/**
 * Helper para crear handler con configuración común
 */
function createAPIHandler(handlerFn, config = {}) {
  return createHandler(handlerFn, {
    rateLimit: config.rateLimit,
    requiredHeaders: config.requiredHeaders,
    requestMiddleware: config.requestMiddleware,
    responseMiddleware: config.responseMiddleware
  });
}

module.exports = {
  // Classes
  RequestInterceptor,
  ResponseInterceptor,
  
  // Middleware factories
  createRateLimitMiddleware,
  createRequiredHeadersMiddleware,
  
  // Predefined middleware
  parseBodyMiddleware,
  sanitizeMiddleware,
  extractUserContextMiddleware,
  securityHeadersMiddleware,
  correlationIdMiddleware,
  stringifyBodyMiddleware,
  logResponseMiddleware,
  performanceMiddleware,
  
  // Handler creators
  createHandler,
  createAPIHandler
};
