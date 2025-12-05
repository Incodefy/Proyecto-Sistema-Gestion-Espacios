/**
 * Centralized Error Handler
 * 
 * Proporciona manejo consistente de errores con:
 * - Error codes estandarizados
 * - Logging automático
 * - Respuestas HTTP consistentes
 * - Error tracking
 */

const { Logger } = require('./logger');
const { getSecurityHeaders } = require('../middleware/securityHeaders');

/**
 * Error codes estandarizados
 */
const ErrorCodes = {
  // Authentication & Authorization
  AUTH_INVALID_TOKEN: 'AUTH001',
  AUTH_EXPIRED_TOKEN: 'AUTH002',
  AUTH_MISSING_TOKEN: 'AUTH003',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH004',
  
  // Validation
  VALIDATION_FAILED: 'VAL001',
  VALIDATION_INVALID_EMAIL: 'VAL002',
  VALIDATION_INVALID_UUID: 'VAL003',
  VALIDATION_MISSING_FIELD: 'VAL004',
  VALIDATION_INVALID_FORMAT: 'VAL005',
  
  // Resources
  RESOURCE_NOT_FOUND: 'RES001',
  RESOURCE_ALREADY_EXISTS: 'RES002',
  RESOURCE_CONFLICT: 'RES003',
  RESOURCE_DELETED: 'RES004',
  
  // Business Logic
  BUSINESS_LOGIC_ERROR: 'BIZ001',
  INVALID_OPERATION: 'BIZ002',
  QUOTA_EXCEEDED: 'BIZ003',
  CONFLICT_DETECTED: 'BIZ004',
  
  // Security
  RATE_LIMIT_EXCEEDED: 'SEC001',
  SUSPICIOUS_ACTIVITY: 'SEC002',
  ACCESS_DENIED: 'SEC003',
  
  // System
  INTERNAL_ERROR: 'SYS001',
  SERVICE_UNAVAILABLE: 'SYS002',
  TIMEOUT: 'SYS003',
  DATABASE_ERROR: 'SYS004',
  EXTERNAL_SERVICE_ERROR: 'SYS005',
  
  // Input
  INVALID_JSON: 'INP001',
  MALFORMED_REQUEST: 'INP002'
};

/**
 * HTTP Status codes mapping
 */
const StatusCodeMap = {
  // 2xx
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  
  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Application Error Class
 */
class AppError extends Error {
  constructor(message, code, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      ok: false,
      error: this.message,
      code: this.code,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details })
    };
  }
}

/**
 * Specific Error Classes
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, ErrorCodes.VALIDATION_FAILED, StatusCodeMap.BAD_REQUEST, details);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, ErrorCodes.RESOURCE_NOT_FOUND, StatusCodeMap.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, ErrorCodes.RESOURCE_CONFLICT, StatusCodeMap.CONFLICT, details);
    this.name = 'ConflictError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, ErrorCodes.AUTH_INVALID_TOKEN, StatusCodeMap.UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS, StatusCodeMap.FORBIDDEN);
    this.name = 'AuthorizationError';
  }
}

class RateLimitError extends AppError {
  constructor(retryAfter = 60) {
    super('Too many requests', ErrorCodes.RATE_LIMIT_EXCEEDED, StatusCodeMap.TOO_MANY_REQUESTS);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service = 'External service') {
    super(`${service} is temporarily unavailable`, ErrorCodes.SERVICE_UNAVAILABLE, StatusCodeMap.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error Handler
 */
class ErrorHandler {
  constructor(logger = null) {
    this.logger = logger || new Logger({ component: 'ErrorHandler' });
  }

  /**
   * Maneja error y retorna respuesta HTTP
   */
  handle(error, correlationId = null) {
    // Si es AppError, ya tiene toda la info
    if (error instanceof AppError) {
      this.logError(error, correlationId);
      return this.buildErrorResponse(error, correlationId);
    }

    // Mapear errores comunes de AWS SDK
    if (error.name === 'ConditionalCheckFailedException') {
      const appError = new ConflictError('Resource already exists or condition not met');
      this.logError(appError, correlationId);
      return this.buildErrorResponse(appError, correlationId);
    }

    if (error.name === 'ResourceNotFoundException') {
      const appError = new NotFoundError();
      this.logError(appError, correlationId);
      return this.buildErrorResponse(appError, correlationId);
    }

    if (error.name === 'ValidationException') {
      const appError = new ValidationError(error.message);
      this.logError(appError, correlationId);
      return this.buildErrorResponse(appError, correlationId);
    }

    if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
      const appError = new ServiceUnavailableError('Database');
      this.logError(appError, correlationId);
      return this.buildErrorResponse(appError, correlationId);
    }

    // Error genérico
    const genericError = new AppError(
      process.env.STAGE === 'prod' ? 'Internal server error' : error.message,
      ErrorCodes.INTERNAL_ERROR,
      StatusCodeMap.INTERNAL_SERVER_ERROR
    );
    
    this.logError(error, correlationId, true); // Log original error
    return this.buildErrorResponse(genericError, correlationId);
  }

  /**
   * Log error con detalles
   */
  logError(error, correlationId, isUnexpected = false) {
    const logData = {
      correlationId,
      errorCode: error.code || 'UNKNOWN',
      statusCode: error.statusCode || 500,
      isUnexpected
    };

    if (error.statusCode >= 500 || isUnexpected) {
      this.logger.error('Error occurred', error, logData);
    } else {
      this.logger.warn('Client error', logData);
    }
  }

  /**
   * Construye respuesta HTTP de error
   */
  buildErrorResponse(error, correlationId) {
    const response = {
      statusCode: error.statusCode || 500,
      headers: {
        ...getSecurityHeaders(),
        ...(correlationId && { 'X-Correlation-ID': correlationId })
      },
      body: JSON.stringify(error.toJSON ? error.toJSON() : {
        ok: false,
        error: error.message || 'Unknown error',
        code: error.code || ErrorCodes.INTERNAL_ERROR
      })
    };

    // Agregar Retry-After header si es rate limit
    if (error instanceof RateLimitError) {
      response.headers['Retry-After'] = error.retryAfter;
    }

    return response;
  }

  /**
   * Wrapper async para handlers de Lambda
   */
  wrapHandler(handler) {
    return async (event, context) => {
      const logger = Logger.fromEvent(event);
      const errorHandler = new ErrorHandler(logger);
      
      try {
        logger.info('Handler started', {
          path: event.requestContext?.http?.path,
          method: event.requestContext?.http?.method
        });

        const result = await handler(event, context, logger);
        
        logger.info('Handler completed successfully', {
          statusCode: result.statusCode
        });
        
        return result;
      } catch (error) {
        return errorHandler.handle(error, logger.getCorrelationId());
      }
    };
  }
}

/**
 * Success response helper
 */
function successResponse(data, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers: {
      ...getSecurityHeaders(),
      ...headers
    },
    body: JSON.stringify({
      ok: true,
      ...data
    })
  };
}

/**
 * Pagination response helper
 */
function paginatedResponse(items, pagination = {}, metadata = {}) {
  return successResponse({
    items,
    pagination: {
      total: pagination.total || items.length,
      limit: pagination.limit || 20,
      offset: pagination.offset || 0,
      hasMore: pagination.hasMore || false
    },
    ...metadata
  });
}

/**
 * Instance global del error handler
 */
const globalErrorHandler = new ErrorHandler();

module.exports = {
  // Error Classes
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ServiceUnavailableError,
  
  // Error Handler
  ErrorHandler,
  globalErrorHandler,
  
  // Error Codes
  ErrorCodes,
  StatusCodeMap,
  
  // Response Helpers
  successResponse,
  paginatedResponse
};
