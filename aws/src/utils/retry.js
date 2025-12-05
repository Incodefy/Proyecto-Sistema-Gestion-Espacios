/**
 * Retry Logic with Exponential Backoff
 * Implementa retry automático con exponential backoff y jitter
 */

const { Logger } = require('./logger');

const DEFAULT_CONFIG = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 5000,
  exponentialBase: 2,
  jitter: true,
  retryableErrors: [
    'NetworkError',
    'TimeoutError',
    'ThrottlingException',
    'ProvisionedThroughputExceededException',
    'ServiceUnavailable',
    'TooManyRequestsException'
  ]
};

class RetryError extends Error {
  constructor(message, attempts, lastError) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determina si el error es retryable
 */
function isRetryable(error, config = {}) {
  if (!error) return false;

  const retryableErrors = config.retryableErrors || DEFAULT_CONFIG.retryableErrors;

  // Custom retry condition
  if (config.retryCondition) {
    return config.retryCondition(error);
  }

  // Check error name
  if (retryableErrors.includes(error.name)) return true;

  // Check status code
  if (error.statusCode) {
    if (error.statusCode === 429) return true;
    if (error.statusCode >= 500 && error.statusCode < 600) return true;
  }

  // Check AWS SDK error codes
  if (error.code) {
    const awsCodes = [
      'ThrottlingException',
      'TooManyRequestsException',
      'ProvisionedThroughputExceededException',
      'RequestTimeout',
      'ServiceUnavailable',
      'InternalServerError'
    ];
    if (awsCodes.includes(error.code)) return true;
  }

  return false;
}

/**
 * Calcula delay para el siguiente retry
 */
function calculateDelay(attempt, config = {}) {
  const baseDelay = config.baseDelay || DEFAULT_CONFIG.baseDelay;
  const maxDelay = config.maxDelay || DEFAULT_CONFIG.maxDelay;
  const exponentialBase = config.exponentialBase || DEFAULT_CONFIG.exponentialBase;
  const useJitter = config.jitter !== false;

  let delay = baseDelay * Math.pow(exponentialBase, attempt);
  delay = Math.min(delay, maxDelay);

  if (useJitter) {
    const jitterAmount = Math.random() * delay * 0.25;
    delay = delay + jitterAmount;
  }

  return Math.floor(delay);
}

/**
 * Retry con jitter (versión original mejorada)
 */
async function retryWithJitter(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const baseDelayMs = options.baseDelayMs || 200;
  const logger = options.logger || new Logger({ component: 'Retry' });
  
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        break;
      }

      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const delay = backoff + jitter;

      logger.warn(`Retry attempt ${attempt} failed`, {
        attempt,
        maxAttempts,
        error: err.message,
        delayMs: delay
      });

      await sleep(delay);
    }
  }

  throw new RetryError(
    `Failed after ${maxAttempts} attempts`,
    maxAttempts,
    lastError
  );
}

/**
 * Retry con configuración avanzada
 */
async function retry(fn, config = {}) {
  const maxAttempts = config.maxAttempts || DEFAULT_CONFIG.maxAttempts;
  const logger = config.logger || new Logger({ component: 'Retry' });
  let lastError;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 0) {
        logger.info('Retry succeeded', { attempt: attempt + 1 });
      }
      
      return result;
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxAttempts - 1;
      const shouldRetry = isRetryable(error, config);

      if (!shouldRetry || isLastAttempt) {
        if (isLastAttempt) {
          throw new RetryError(
            `Failed after ${maxAttempts} attempts`,
            maxAttempts,
            error
          );
        }
        throw error;
      }

      const delay = calculateDelay(attempt, config);
      logger.info('Retrying after delay', {
        attempt: attempt + 1,
        delayMs: delay,
        error: error.message
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry para AWS SDK calls
 */
async function retryAWS(fn, config = {}) {
  return await retry(fn, {
    ...config,
    maxAttempts: config.maxAttempts || 5,
    baseDelay: config.baseDelay || 200
  });
}

/**
 * Retry para HTTP requests
 */
async function retryHTTP(fn, config = {}) {
  return await retry(fn, {
    ...config,
    retryCondition: (error) => {
      if (error.statusCode === 429) return true;
      if (error.statusCode >= 500 && error.statusCode < 600) return true;
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return true;
      return false;
    }
  });
}

/**
 * Retry para operaciones de base de datos
 */
async function retryDB(fn, config = {}) {
  return await retry(fn, {
    ...config,
    maxAttempts: config.maxAttempts || 5,
    baseDelay: config.baseDelay || 200,
    retryableErrors: [
      'ProvisionedThroughputExceededException',
      'ThrottlingException',
      'TransactionConflictException'
    ]
  });
}

module.exports = { 
  retryWithJitter,
  retry,
  retryAWS,
  retryHTTP,
  retryDB,
  RetryError,
  isRetryable,
  calculateDelay,
  DEFAULT_CONFIG
};

