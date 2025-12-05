/**
 * Rate Limiter Middleware
 * 
 * Implementa rate limiting por usuario usando DynamoDB
 * - Límites configurables por endpoint
 * - Sliding window algorithm
 * - TTL automático en DynamoDB
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { createLogger } = require('../utils/logger');

const logger = createLogger({ module: 'rateLimiter' });
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.RATE_LIMIT_TABLE || `${process.env.SERVICE_NAME}-${process.env.STAGE}-rate-limits`;

/**
 * Configuración de límites por endpoint
 * key: nombre del endpoint
 * value: { maxRequests, windowSeconds }
 */
const RATE_LIMITS = {
  // Autenticación - muy restrictivo
  'login': { 
    maxRequests: 5, 
    windowSeconds: 300,  // 5 intentos cada 5 minutos
    blockDuration: 900   // Bloqueo de 15 minutos si se excede
  },
  'refresh': { 
    maxRequests: 10, 
    windowSeconds: 300 
  },
  
  // Operaciones de escritura sensibles
  'createGroup': { 
    maxRequests: 10, 
    windowSeconds: 60 
  },
  'deleteGroup': { 
    maxRequests: 5, 
    windowSeconds: 60 
  },
  'inviteToGroup': { 
    maxRequests: 20, 
    windowSeconds: 300 
  },
  
  // Operaciones de lectura
  'listGroups': { 
    maxRequests: 100, 
    windowSeconds: 60 
  },
  'getGroup': { 
    maxRequests: 200, 
    windowSeconds: 60 
  },
  
  // Default para endpoints no especificados
  'default': { 
    maxRequests: 100, 
    windowSeconds: 60 
  }
};

/**
 * Genera la key para DynamoDB
 * @param {string} endpoint - Nombre del endpoint
 * @param {string} identifier - User sub o IP
 * @returns {string} - Key única
 */
function generateKey(endpoint, identifier) {
  return `${endpoint}#${identifier}`;
}

/**
 * Verifica rate limit por USUARIO Y IP (doble validación)
 * @param {string} endpoint - Nombre del endpoint
 * @param {string} userSub - User sub (opcional)
 * @param {string} ip - IP address (opcional)
 * @returns {Promise<Object>} - { allowed: boolean, remaining: number, resetAt: number }
 */
async function checkRateLimitDual(endpoint, userSub, ip) {
  const checks = [];

  // Check por usuario (si está autenticado)
  if (userSub) {
    checks.push(checkRateLimit(endpoint, userSub, 'user'));
  }

  // Check por IP (siempre)
  if (ip) {
    checks.push(checkRateLimit(endpoint, ip, 'ip'));
  }

  // Si no hay userSub ni IP, permitir (fail open)
  if (checks.length === 0) {
    logger.warn('Rate limit check without user or IP');
    return { allowed: true, remaining: 999, resetAt: Date.now() };
  }

  // Ejecutar ambas validaciones en paralelo
  const results = await Promise.all(checks);

  // Si CUALQUIERA de las dos falla, denegar
  const blocked = results.find(r => !r.allowed);
  if (blocked) {
    return blocked;
  }

  // Retornar el resultado más restrictivo
  return results.reduce((min, current) => 
    current.remaining < min.remaining ? current : min
  );
}

/**
 * Verifica si un usuario ha excedido el rate limit
 * @param {string} endpoint - Nombre del endpoint
 * @param {string} identifier - User sub o IP
 * @param {string} type - 'user' o 'ip' (para logs)
 * @returns {Promise<Object>} - { allowed: boolean, remaining: number, resetAt: number }
 */
async function checkRateLimit(endpoint, identifier, type = 'unknown') {
  if (!identifier) {
    logger.warn('Rate limit check without identifier');
    return { allowed: true, remaining: 999, resetAt: Date.now() };
  }

  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  const key = generateKey(endpoint, `${type}:${identifier}`);
  const now = Date.now();
  const windowStart = now - (config.windowSeconds * 1000);

  try {
    // Obtener registro actual
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { key }
    }));

    const item = result.Item;

    // Si no existe o está fuera de la ventana, crear nuevo
    if (!item || item.windowStart < windowStart) {
      await createNewWindow(key, now, config);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + (config.windowSeconds * 1000)
      };
    }

    // Verificar si está bloqueado
    if (item.blockedUntil && item.blockedUntil > now) {
      logger.warn('User is blocked', { 
        endpoint, 
        identifier: identifier.substring(0, 10),
        blockedUntil: new Date(item.blockedUntil).toISOString()
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: item.blockedUntil,
        blocked: true
      };
    }

    // Verificar límite
    if (item.requestCount >= config.maxRequests) {
      logger.warn('Rate limit exceeded', { 
        endpoint, 
        identifier: identifier.substring(0, 10),
        requestCount: item.requestCount,
        maxRequests: config.maxRequests
      });

      // Si el endpoint tiene blockDuration, bloquear al usuario
      if (config.blockDuration) {
        const blockedUntil = now + (config.blockDuration * 1000);
        await blockUser(key, blockedUntil, now + (config.windowSeconds * 1000));
        
        return {
          allowed: false,
          remaining: 0,
          resetAt: blockedUntil,
          blocked: true
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt: item.windowStart + (config.windowSeconds * 1000)
      };
    }

    // Incrementar contador
    await incrementCounter(key);

    return {
      allowed: true,
      remaining: config.maxRequests - item.requestCount - 1,
      resetAt: item.windowStart + (config.windowSeconds * 1000)
    };

  } catch (error) {
    logger.error('Error checking rate limit', error, { endpoint, identifier });
    // En caso de error, permitir la request (fail open)
    return { allowed: true, remaining: 999, resetAt: now };
  }
}

/**
 * Crea una nueva ventana de rate limiting
 * @param {string} key - Key del usuario/endpoint
 * @param {number} now - Timestamp actual
 * @param {Object} config - Configuración del límite
 */
async function createNewWindow(key, now, config) {
  const ttl = Math.floor((now / 1000) + config.windowSeconds + 3600); // +1h buffer

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      key,
      requestCount: 1,
      windowStart: now,
      ttl,
      lastRequest: now
    }
  }));
}

/**
 * Incrementa el contador de requests
 * @param {string} key - Key del usuario/endpoint
 */
async function incrementCounter(key) {
  const now = Date.now();
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { key },
    UpdateExpression: 'SET requestCount = requestCount + :inc, lastRequest = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':now': now
    }
  }));
}

/**
 * Bloquea un usuario temporalmente
 * @param {string} key - Key del usuario/endpoint
 * @param {number} blockedUntil - Timestamp hasta cuando está bloqueado
 * @param {number} ttl - TTL para DynamoDB
 */
async function blockUser(key, blockedUntil, ttl) {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { key },
    UpdateExpression: 'SET blockedUntil = :blocked, #ttl = :ttl',
    ExpressionAttributeNames: {
      '#ttl': 'ttl'
    },
    ExpressionAttributeValues: {
      ':blocked': blockedUntil,
      ':ttl': Math.floor(ttl / 1000)
    }
  }));

  logger.warn('User blocked', { 
    key: key.substring(0, 20),
    blockedUntil: new Date(blockedUntil).toISOString()
  });
}

/**
 * Middleware para aplicar rate limiting DUAL (usuario + IP) a un handler Lambda
 * @param {string} endpoint - Nombre del endpoint
 * @param {boolean} dualCheck - Si true, valida usuario Y IP (default: true)
 * @returns {Function} - Middleware function
 */
function rateLimitMiddleware(endpoint, dualCheck = true) {
  return async (event) => {
    // Obtener user_sub e IP
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const ip = event.requestContext?.http?.sourceIp || event.requestContext?.identity?.sourceIp;

    let result;

    if (dualCheck && userSub && ip) {
      // Validación dual: usuario Y IP
      result = await checkRateLimitDual(endpoint, userSub, ip);
    } else {
      // Validación simple: usuario o IP
      const identifier = userSub || ip || 'anonymous';
      const type = userSub ? 'user' : 'ip';
      result = await checkRateLimit(endpoint, identifier, type);
    }

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': (RATE_LIMITS[endpoint] || RATE_LIMITS.default).maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toString()
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: result.blocked 
              ? 'Too many requests. Your access has been temporarily blocked.' 
              : 'Too many requests. Please try again later.',
            code: 429,
            retryAfter,
            resetAt: new Date(result.resetAt).toISOString()
          }
        })
      };
    }

    // Retornar headers informativos
    return {
      rateLimitHeaders: {
        'X-RateLimit-Limit': (RATE_LIMITS[endpoint] || RATE_LIMITS.default).maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetAt.toString()
      }
    };
  };
}

/**
 * Helper para agregar rate limit a una respuesta existente
 * @param {Object} response - Respuesta Lambda
 * @param {Object} rateLimitInfo - Info del rate limit
 * @returns {Object} - Respuesta con headers de rate limit
 */
function addRateLimitHeaders(response, rateLimitInfo) {
  if (!rateLimitInfo || !rateLimitInfo.rateLimitHeaders) {
    return response;
  }

  return {
    ...response,
    headers: {
      ...response.headers,
      ...rateLimitInfo.rateLimitHeaders
    }
  };
}

/**
 * Resetea el rate limit de un usuario (útil para testing o admin)
 * @param {string} endpoint - Nombre del endpoint
 * @param {string} identifier - User sub o IP
 * @param {string} type - 'user' o 'ip' (default: 'user')
 */
async function resetRateLimit(endpoint, identifier, type = 'user') {
  const key = generateKey(endpoint, `${type}:${identifier}`);
  
  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        key,
        requestCount: 0,
        windowStart: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 3600
      }
    }));

    logger.info('Rate limit reset', { endpoint, identifier: identifier.substring(0, 10), type });
  } catch (error) {
    logger.error('Error resetting rate limit', error);
  }
}

module.exports = {
  checkRateLimit,
  checkRateLimitDual,
  rateLimitMiddleware,
  addRateLimitHeaders,
  resetRateLimit,
  RATE_LIMITS
};

module.exports = {
  checkRateLimit,
  rateLimitMiddleware,
  addRateLimitHeaders,
  resetRateLimit,
  RATE_LIMITS
};
