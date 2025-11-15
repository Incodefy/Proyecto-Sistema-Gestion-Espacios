/**
 * Middleware de validación JWT con JWKS
 * Verifica tokens JWT contra el JWKS de AWS Cognito
 */

const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

// Cliente JWKS configurado para AWS Cognito
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutos
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

/**
 * Obtiene la clave pública de firma desde JWKS
 * @param {Object} header - Header del JWT
 * @param {Function} callback - Callback (error, key)
 */
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('❌ Error obteniendo signing key:', err);
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verifica un token JWT contra el JWKS de Cognito
 * @param {string} token - Token JWT a verificar
 * @returns {Promise<Object>} - Payload decodificado del token
 */
async function verifyToken(token) {
  return new Promise((resolve, reject) => {
    // Decodificar header para obtener kid
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return reject(new Error('Token inválido'));
    }

    // Verificar con JWKS
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
          console.error('❌ Error verificando token:', err.message);
          return reject(err);
        }
        
        console.log('✅ Token verificado correctamente');
        resolve(decodedToken);
      }
    );
  });
}

/**
 * Middleware para Express: Valida JWT en header Authorization
 */
function validateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      ok: false,
      error: 'Token de autorización no proporcionado'
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  verifyToken(token)
    .then(decoded => {
      // Agregar datos del usuario al request
      req.user = {
        sub: decoded.sub,
        email: decoded.email,
        email_verified: decoded.email_verified,
        groups: decoded['cognito:groups'] || []
      };
      next();
    })
    .catch(err => {
      console.error('❌ Token inválido:', err.message);
      return res.status(401).json({
        ok: false,
        error: 'Token de autorización inválido o expirado'
      });
    });
}

/**
 * Middleware para Lambda: Valida JWT en event
 * @param {Object} event - Event de API Gateway
 * @returns {Promise<Object>} - Usuario decodificado o null
 */
async function validateJWTLambda(event) {
  try {
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    
    if (!authHeader) {
      throw new Error('Token no proporcionado');
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = await verifyToken(token);
    
    return {
      sub: decoded.sub,
      email: decoded.email,
      email_verified: decoded.email_verified,
      groups: decoded['cognito:groups'] || []
    };
  } catch (err) {
    console.error('❌ Error validando JWT en Lambda:', err.message);
    return null;
  }
}

module.exports = {
  verifyToken,
  validateJWT,
  validateJWTLambda,
  getKey
};
