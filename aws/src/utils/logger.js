/**
 * Logger estructurado para AWS Lambda
 * Compatible con CloudWatch Insights
 * Implementa mejores prácticas de logging seguro
 */

class Logger {
  constructor(context = {}) {
    this.context = {
      service: process.env.SERVICE_NAME || 'aws-lambda',
      stage: process.env.STAGE || 'dev',
      ...context
    };
  }

  /**
   * Log interno - genera JSON estructurado
   */
  _log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...this._sanitize(data)
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Sanitiza datos sensibles antes de loggear
   */
  _sanitize(data) {
    const sanitized = { ...data };

    // Campos sensibles a redactar
    const sensitiveFields = [
      'token', 'password', 'authorization', 'secret', 
      'apiKey', 'api_key', 'accessToken', 'refreshToken',
      'idToken', 'ACCESS_KEY', 'SECRET_KEY'
    ];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Enmascarar emails si no está explícitamente permitido
    if (sanitized.email && !sanitized._allowEmail) {
      sanitized.email = this._maskEmail(sanitized.email);
    }
    delete sanitized._allowEmail;

    // Redactar claims JWT completos
    if (sanitized.claims && typeof sanitized.claims === 'object') {
      sanitized.claims = {
        sub: sanitized.claims.sub || '***REDACTED***'
        // Omitir otros campos como email, groups, etc
      };
    }

    // Sanitizar headers HTTP
    if (sanitized.headers && typeof sanitized.headers === 'object') {
      const cleanHeaders = { ...sanitized.headers };
      if (cleanHeaders.Authorization || cleanHeaders.authorization) {
        cleanHeaders.Authorization = '***REDACTED***';
        cleanHeaders.authorization = '***REDACTED***';
      }
      sanitized.headers = cleanHeaders;
    }

    return sanitized;
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
  startTrace(operation) {
    const startTime = Date.now();
    return (metadata = {}) => {
      const duration = Date.now() - startTime;
      this.trace(operation, duration, metadata);
    };
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
