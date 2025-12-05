/**
 * AWS Secrets Manager Integration
 * 
 * Utility para obtener secrets de AWS Secrets Manager con:
 * - Caché en memoria (TTL: 5 minutos)
 * - Retry automático
 * - Error handling robusto
 * - Soporte para múltiples secrets
 */

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secretsmanager");
const { createLogger } = require('./logger');

const logger = createLogger({ module: 'secretsManager' });
const client = new SecretsManagerClient({});

// Caché de secrets en memoria
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Estructura del caché:
 * {
 *   value: Object,
 *   expiresAt: Number (timestamp)
 * }
 */

/**
 * Obtiene un secret de AWS Secrets Manager
 * @param {string} secretName - Nombre del secret (default: hospital/{stage}/app-secrets)
 * @returns {Promise<Object>} - Secret parseado como objeto
 */
async function getSecrets(secretName = null) {
  const finalSecretName = secretName || process.env.SECRET_NAME || `hospital/${process.env.STAGE || 'dev'}/app-secrets`;
  
  // Verificar caché
  const cached = cache.get(finalSecretName);
  if (cached && Date.now() < cached.expiresAt) {
    logger.debug('Secret retrieved from cache', { secretName: finalSecretName });
    return cached.value;
  }

  logger.info('Fetching secret from AWS Secrets Manager', { secretName: finalSecretName });

  try {
    const command = new GetSecretValueCommand({
      SecretId: finalSecretName
    });

    const response = await client.send(command);
    
    let secretValue;
    if (response.SecretString) {
      secretValue = JSON.parse(response.SecretString);
    } else {
      // Secret binario (poco común)
      const buff = Buffer.from(response.SecretBinary, 'base64');
      secretValue = JSON.parse(buff.toString('utf-8'));
    }

    // Guardar en caché
    cache.set(finalSecretName, {
      value: secretValue,
      expiresAt: Date.now() + CACHE_TTL
    });

    logger.info('Secret retrieved successfully', { secretName: finalSecretName });
    return secretValue;

  } catch (error) {
    logger.error('Error fetching secret', error, { secretName: finalSecretName });

    // Si hay un valor en caché (aunque expirado), usarlo como fallback
    const staleCache = cache.get(finalSecretName);
    if (staleCache) {
      logger.warn('Using stale cache due to error', { secretName: finalSecretName });
      return staleCache.value;
    }

    throw new Error(`Failed to retrieve secret ${finalSecretName}: ${error.message}`);
  }
}

/**
 * Obtiene un secret específico por clave
 * @param {string} key - Clave del secret (ej: 'SES_FROM_EMAIL')
 * @param {string} secretName - Nombre del secret (opcional)
 * @returns {Promise<string>} - Valor del secret
 */
async function getSecret(key, secretName = null) {
  const secrets = await getSecrets(secretName);
  
  if (!secrets[key]) {
    throw new Error(`Secret key '${key}' not found in ${secretName || 'default secret'}`);
  }

  return secrets[key];
}

/**
 * Invalida el caché de un secret específico
 * Útil para forzar refresh después de rotación
 * @param {string} secretName - Nombre del secret
 */
function invalidateCache(secretName = null) {
  const finalSecretName = secretName || process.env.SECRET_NAME || `hospital/${process.env.STAGE || 'dev'}/app-secrets`;
  cache.delete(finalSecretName);
  logger.info('Cache invalidated', { secretName: finalSecretName });
}

/**
 * Limpia todo el caché
 */
function clearCache() {
  cache.clear();
  logger.info('All secrets cache cleared');
}

/**
 * Helper para migración gradual - usa secret si está disponible, sino env var
 * @param {string} key - Nombre de la variable
 * @returns {Promise<string>} - Valor desde secret o env
 */
async function getSecretOrEnv(key) {
  try {
    return await getSecret(key);
  } catch (error) {
    logger.warn(`Secret ${key} not found, falling back to ENV`, { error: error.message });
    return process.env[key];
  }
}

module.exports = {
  getSecrets,
  getSecret,
  getSecretOrEnv,
  invalidateCache,
  clearCache
};
