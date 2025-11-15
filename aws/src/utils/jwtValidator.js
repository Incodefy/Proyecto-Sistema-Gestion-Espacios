/**
 * Validación JWT con JWKS para AWS Lambda
 */

const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

// Cliente JWKS
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutos
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

/**
 * Obtiene la clave de firma
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verifica un token JWT
 * @param {string} token - Token a verificar
 * @returns {Promise<Object>} - Payload decodificado
 */
async function verifyToken(token) {
  return new Promise((resolve, reject) => {
    // jwt.verify() valida Y decodifica en un solo paso seguro
    // No usar jwt.decode() manualmente - es inseguro
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`,
        audience: process.env.USER_POOL_CLIENT_ID
      },
      (err, decodedToken) => {
        if (err) {
          return reject(err);
        }
        resolve(decodedToken);
      }
    );
  });
}

/**
 * Middleware Lambda para validar JWT
 * @param {Object} event - Evento de API Gateway
 * @returns {Promise<Object|null>} - Usuario decodificado o null
 */
async function validateJWT(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      console.log(JSON.stringify({
        level: 'WARN',
        message: 'Authorization token not provided'
      }));
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyToken(token);
    
    // Log estructurado sin exponer PII (email)
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Token JWT verified',
      userSub: decoded.sub,
      hasGroups: Boolean(decoded['cognito:groups']?.length)
    }));
    
    return {
      sub: decoded.sub,
      email: decoded.email,
      email_verified: decoded.email_verified,
      groups: decoded['cognito:groups'] || []
    };
  } catch (err) {
    console.log(JSON.stringify({
      level: 'ERROR',
      message: 'JWT validation failed',
      error: err.message
    }));
    return null;
  }
}

module.exports = {
  verifyToken,
  validateJWT
};
