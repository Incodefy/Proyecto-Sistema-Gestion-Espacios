/**
 * Data Encryption Utility
 * 
 * Encriptación/desencriptación de datos sensibles (PII) en tránsito
 * - Usa AWS KMS para gestión de claves
 * - Algoritmo: AES-256-GCM
 * - Campos PII automaticamente detectados y encriptados
 * - Caché de data keys para performance
 */

const crypto = require('crypto');
const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = require('@aws-sdk/client-kms');
const { createLogger } = require('./logger');

const logger = createLogger({ module: 'encryption' });
const kmsClient = new KMSClient({});

// KMS Key ID (configurado en environment variables)
const KMS_KEY_ID = process.env.KMS_KEY_ID || process.env.KMS_KEY_ARN;

// Caché de data keys (para reducir llamadas a KMS)
const dataKeyCache = new Map();
const DATA_KEY_TTL = 5 * 60 * 1000; // 5 minutos

// Campos que deben ser encriptados
const ENCRYPTED_FIELDS = [
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
  'direccion',
  'ssn',
  'taxId',
  'creditCard'
];

/**
 * Obtiene una data key de KMS (con caché)
 */
async function getDataKey() {
  const cached = dataKeyCache.get('current');
  
  if (cached && Date.now() < cached.expiresAt) {
    return cached.key;
  }

  try {
    const command = new GenerateDataKeyCommand({
      KeyId: KMS_KEY_ID,
      KeySpec: 'AES_256'
    });

    const response = await kmsClient.send(command);
    
    dataKeyCache.set('current', {
      key: response.Plaintext,
      encrypted: response.CiphertextBlob,
      expiresAt: Date.now() + DATA_KEY_TTL
    });

    logger.debug('Generated new data key from KMS');
    
    return response.Plaintext;
  } catch (error) {
    logger.error('Error generating data key', error);
    throw new Error('Failed to generate encryption key');
  }
}

/**
 * Encripta un string usando AES-256-GCM
 * 
 * @param {string} plaintext - Texto a encriptar
 * @returns {string} - Formato: iv:authTag:encryptedData (base64)
 */
async function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  try {
    const dataKey = await getDataKey();
    
    // Generar IV aleatorio (12 bytes para GCM)
    const iv = crypto.randomBytes(12);
    
    // Crear cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
    
    // Encriptar
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Obtener authentication tag
    const authTag = cipher.getAuthTag();
    
    // Formato: iv:authTag:encryptedData (todo en base64)
    const result = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    
    return result;
  } catch (error) {
    logger.error('Encryption error', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Desencripta un string encriptado con encrypt()
 * 
 * @param {string} ciphertext - Texto encriptado (formato: iv:authTag:data)
 * @returns {string} - Texto plano
 */
async function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return ciphertext;
  }

  // Si no tiene el formato esperado, asumir que no está encriptado
  if (!ciphertext.includes(':')) {
    return ciphertext;
  }

  try {
    const dataKey = await getDataKey();
    
    // Parsear formato iv:authTag:data
    const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':');
    
    if (!ivB64 || !authTagB64 || !encryptedB64) {
      throw new Error('Invalid ciphertext format');
    }
    
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = encryptedB64;
    
    // Crear decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, iv);
    decipher.setAuthTag(authTag);
    
    // Desencriptar
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encripta campos PII en un objeto (recursivo)
 * 
 * @param {Object} data - Objeto con datos
 * @param {Array} fieldsToEncrypt - Campos específicos a encriptar (opcional)
 * @returns {Object} - Objeto con campos encriptados
 */
async function encryptPII(data, fieldsToEncrypt = ENCRYPTED_FIELDS) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => encryptPII(item, fieldsToEncrypt)));
  }

  const encrypted = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Verificar si el campo debe ser encriptado
    const shouldEncrypt = fieldsToEncrypt.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (shouldEncrypt && typeof value === 'string' && value.length > 0) {
      // Encriptar el campo
      encrypted[key] = await encrypt(value);
      logger.debug('Field encrypted', { field: key });
    } else if (typeof value === 'object' && value !== null) {
      // Recursivo para objetos anidados
      encrypted[key] = await encryptPII(value, fieldsToEncrypt);
    } else {
      // Campo normal, no encriptar
      encrypted[key] = value;
    }
  }

  return encrypted;
}

/**
 * Desencripta campos PII en un objeto (recursivo)
 * 
 * @param {Object} data - Objeto con datos encriptados
 * @param {Array} fieldsToDecrypt - Campos específicos a desencriptar (opcional)
 * @returns {Object} - Objeto con campos desencriptados
 */
async function decryptPII(data, fieldsToDecrypt = ENCRYPTED_FIELDS) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => decryptPII(item, fieldsToDecrypt)));
  }

  const decrypted = {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Verificar si el campo debe ser desencriptado
    const shouldDecrypt = fieldsToDecrypt.some(field => 
      lowerKey.includes(field.toLowerCase())
    );

    if (shouldDecrypt && typeof value === 'string' && value.includes(':')) {
      // Intentar desencriptar
      try {
        decrypted[key] = await decrypt(value);
        logger.debug('Field decrypted', { field: key });
      } catch (error) {
        logger.warn('Failed to decrypt field, using original value', { field: key });
        decrypted[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursivo para objetos anidados
      decrypted[key] = await decryptPII(value, fieldsToDecrypt);
    } else {
      // Campo normal, no desencriptar
      decrypted[key] = value;
    }
  }

  return decrypted;
}

/**
 * Middleware para encriptar PII en responses ANTES de retornar al cliente
 * (Opcional - solo si se quiere encriptar data en responses)
 */
function encryptResponseMiddleware(fieldsToEncrypt = ENCRYPTED_FIELDS) {
  return async (response, event, logger) => {
    if (!response.body) return response;

    try {
      const body = typeof response.body === 'string' 
        ? JSON.parse(response.body) 
        : response.body;

      const encryptedBody = await encryptPII(body, fieldsToEncrypt);

      response.body = typeof response.body === 'string'
        ? JSON.stringify(encryptedBody)
        : encryptedBody;

      logger.debug('Response PII encrypted');
    } catch (error) {
      logger.error('Error encrypting response PII', error);
      // No fallar la request, continuar con body sin encriptar
    }

    return response;
  };
}

/**
 * Middleware para desencriptar PII en requests
 */
function decryptRequestMiddleware(fieldsToDecrypt = ENCRYPTED_FIELDS) {
  return async (event, logger) => {
    if (!event.body) return event;

    try {
      const body = typeof event.body === 'string' 
        ? JSON.parse(event.body) 
        : event.body;

      const decryptedBody = await decryptPII(body, fieldsToDecrypt);

      event.body = decryptedBody;
      event.parsedBody = decryptedBody;

      logger.debug('Request PII decrypted');
    } catch (error) {
      logger.error('Error decrypting request PII', error);
      // No fallar la request, continuar con body sin desencriptar
    }

    return event;
  };
}

module.exports = {
  encrypt,
  decrypt,
  encryptPII,
  decryptPII,
  encryptResponseMiddleware,
  decryptRequestMiddleware,
  ENCRYPTED_FIELDS
};
