/**
 * Logger estructurado para AWS Lambda
 * Compatible con CloudWatch Insights
 * Implementa mejores prácticas de logging seguro
 */

const crypto = require('crypto');

class Logger {
  constructor(context = {}) {
    this.context = {
      service: process.env.SERVICE_NAME || 'aws-lambda',
      stage: process.env.STAGE || 'dev',
      ...context
    };
    this.correlationId = this.generateCorrelationId();
    this.startTime = Date.now();
  }

  /**
   * Genera correlation ID único para tracking
   */
  generateCorrelationId() {
    return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Crea logger desde evento de API Gateway con correlation ID
   */
  static fromEvent(event) {
    const correlationId = event?.requestContext?.requestId || 
                         event?.headers?.['x-correlation-id'] ||
                         `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    const context = {
      correlationId,
      requestId: event?.requestContext?.requestId,
      userSub: event?.requestContext?.authorizer?.jwt?.claims?.sub,
      sourceIp: event?.requestContext?.http?.sourceIp,
      path: event?.requestContext?.http?.path,
      method: event?.requestContext?.http?.method
    };

    const logger = new Logger(context);
    logger.correlationId = correlationId;
    return logger;
  }

  /**
   * Obtiene correlation ID para headers de respuesta
   */
  getCorrelationId() {
    return this.correlationId;
  }

  /**
   * Crea child logger con contexto adicional
   */
  child(additionalContext) {
    const childLogger = new Logger({
      ...this.context,
      ...additionalContext
    });
    childLogger.correlationId = this.correlationId;
    childLogger.startTime = this.startTime;
    return childLogger;
  }

  /**
   * Log interno - genera JSON estructurado
   */
  _log(level, message, data = {}) {
    const duration = Date.now() - this.startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      duration,
      ...this.context,
      ...this._sanitize(data)
    };

    const logFn = level === 'ERROR' ? console.error : console.log;
    logFn(JSON.stringify(logEntry));
  }

  /**
   * Sanitiza datos sensibles antes de loggear (recursivo para objetos anidados)
   */
  _sanitize(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this._sanitize(item));
    }

    const sanitized = {};

    // Campos sensibles a redactar
    const sensitiveFields = [
      'token', 'password', 'authorization', 'secret', 
      'apiKey', 'api_key', 'accessToken', 'refreshToken',
      'idToken', 'ACCESS_KEY', 'SECRET_KEY', 'sessionId',
      'cookie', 'creditCard', 'ssn', 'phone'
    ];
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => 
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '***REDACTED***';
      } else if (key === 'email' && !data._allowEmail) {
        sanitized[key] = this._maskEmail(value);
      } else if (key === 'claims' && typeof value === 'object') {
        sanitized[key] = { sub: value?.sub || '***REDACTED***' };
      } else if (key === 'headers' && typeof value === 'object') {
        sanitized[key] = this._sanitizeHeaders(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this._sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    delete sanitized._allowEmail;
    return sanitized;
  }

  /**
   * Sanitizar headers HTTP específicamente
   */
  _sanitizeHeaders(headers) {
    const cleanHeaders = { ...headers };
    if (cleanHeaders.Authorization) cleanHeaders.Authorization = '***REDACTED***';
    if (cleanHeaders.authorization) cleanHeaders.authorization = '***REDACTED***';
    if (cleanHeaders.Cookie) cleanHeaders.Cookie = '***REDACTED***';
    if (cleanHeaders.cookie) cleanHeaders.cookie = '***REDACTED***';
    return cleanHeaders;
  }

  /**
   * Enmascara emails parcialmente (mantiene dominio)
   */
  _maskEmail(email) {
    if (typeof email !== 'string' || !email.includes('@')) {
      return '***@***';
    }
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : '***';
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Log nivel INFO
   */
  info(message, data = {}) {
    this._log('INFO', message, data);
  }

  /**
   * Log nivel WARN
   */
  warn(message, data = {}) {
    this._log('WARN', message, data);
  }

  /**
   * Log nivel ERROR con manejo especial de Error objects
   */
  error(message, error, data = {}) {
    const errorData = {
      ...data,
      error: {
        message: error?.message || String(error),
        name: error?.name,
        ...(error?.code && { code: error.code }),
        ...(process.env.DEBUG === 'true' && error?.stack && { 
          stack: error.stack 
        })
      }
    };
    this._log('ERROR', message, errorData);
  }

  /**
   * Log nivel DEBUG (solo si DEBUG=true)
   */
  debug(message, data = {}) {
    if (process.env.DEBUG === 'true') {
      this._log('DEBUG', message, data);
    }
  }

  /**
   * Log de métricas
   */
  metric(name, value, unit = 'Count') {
    this._log('METRIC', `Metric: ${name}`, {
      metric: {
        name,
        value,
        unit
      }
    });
  }

  /**
   * Log de performance/tracing
   */
  trace(operation, duration, metadata = {}) {
    this._log('TRACE', `Operation: ${operation}`, {
      trace: {
        operation,
        duration,
        unit: 'milliseconds',
        ...metadata
      }
    });
  }

  /**
   * Log de inicio de operación (retorna función para medir duración)
   */
  startTrace(operation, metadata = {}) {
    const startTime = Date.now();
    this.debug(`Starting: ${operation}`, metadata);
    return (endMetadata = {}) => {
      const duration = Date.now() - startTime;
      this.trace(operation, duration, { ...metadata, ...endMetadata });
      return duration;
    };
  }

  /**
   * Wrapper para operaciones async con auto-tracing
   */
  async traceAsync(operation, fn, metadata = {}) {
    const endTrace = this.startTrace(operation, metadata);
    try {
      const result = await fn();
      endTrace({ success: true });
      return result;
    } catch (error) {
      endTrace({ success: false, error: error.message });
      throw error;
    }
  }
}

/**
 * Factory para crear logger con contexto específico
 */
function createLogger(context) {
  return new Logger(context);
}

/**
 * Logger global por defecto
 */
const defaultLogger = new Logger();

module.exports = {
  Logger,
  createLogger,
  logger: defaultLogger
};
