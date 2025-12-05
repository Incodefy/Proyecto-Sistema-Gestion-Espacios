/**
 * Security Headers Middleware
 * 
 * Implementa headers de seguridad según OWASP best practices:
 * - Content Security Policy (CSP)
 * - Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Referrer-Policy
 * - Permissions-Policy
 */

/**
 * Obtiene headers de seguridad configurados según el entorno
 * @param {string} environment - Entorno (dev, staging, prod)
 * @returns {Object} - Headers de seguridad
 */
function getSecurityHeaders(environment = process.env.STAGE || 'dev') {
  const isProd = environment === 'prod';
  
  const headers = {
    // Content Security Policy - Previene XSS, clickjacking, code injection
    'Content-Security-Policy': isProd 
      ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      : "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' http://localhost:*; frame-ancestors 'none'",
    
    // Strict Transport Security - Fuerza HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Previene clickjacking
    'X-Frame-Options': 'DENY',
    
    // Previene MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // XSS Protection (legacy, pero aún útil para navegadores viejos)
    'X-XSS-Protection': '1; mode=block',
    
    // Controla cuánta información del referrer se envía
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy - Controla acceso a features del navegador
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    
    // Cache control para contenido sensible
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    
    // Información del servidor (ocultar versión)
    'X-Powered-By': 'AWS Lambda',
    
    // Request ID para tracing (útil para debugging)
    'X-Request-ID': generateRequestId()
  };

  return headers;
}

/**
 * Genera un ID único para el request (útil para tracing)
 * @returns {string} - Request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Middleware para aplicar headers de seguridad a una respuesta Lambda
 * @param {Object} response - Respuesta Lambda estándar
 * @param {Object} options - Opciones adicionales
 * @returns {Object} - Respuesta con headers de seguridad
 */
function applySecurityHeaders(response, options = {}) {
  const { environment, customHeaders = {} } = options;
  
  const securityHeaders = getSecurityHeaders(environment);
  
  return {
    ...response,
    headers: {
      ...response.headers,
      ...securityHeaders,
      ...customHeaders
    }
  };
}

/**
 * Headers específicos para APIs JSON
 * @returns {Object} - Headers para API responses
 */
function getApiHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  };
}

/**
 * Headers CORS seguros
 * @param {string} origin - Origin permitido
 * @returns {Object} - Headers CORS
 */
function getCorsHeaders(origin = null) {
  const allowedOrigins = getAllowedOrigins();
  
  // Validar origin
  const isAllowed = !origin || allowedOrigins.includes(origin);
  
  if (!isAllowed) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin || allowedOrigins[0],
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-ID',
    'Access-Control-Expose-Headers': 'X-Request-ID',
    'Access-Control-Max-Age': '3600'
  };
}

/**
 * Obtiene los orígenes permitidos según el entorno
 * @returns {Array<string>} - Lista de orígenes permitidos
 */
function getAllowedOrigins() {
  const stage = process.env.STAGE || 'dev';
  
  const origins = {
    dev: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000'
    ],
    staging: [
      'https://staging.hospital.com',
      'https://staging-app.hospital.com'
    ],
    prod: [
      'https://hospital.com',
      'https://www.hospital.com',
      'https://app.hospital.com'
    ]
  };

  return origins[stage] || origins.dev;
}

/**
 * Valida si un origin está permitido
 * @param {string} origin - Origin a validar
 * @returns {boolean} - true si está permitido
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}

/**
 * Headers para prevenir información disclosure
 * @returns {Object} - Headers
 */
function getPrivacyHeaders() {
  return {
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none'
  };
}

/**
 * Configuración completa de headers según tipo de respuesta
 * @param {string} responseType - Tipo de respuesta (json, html, file)
 * @param {Object} options - Opciones adicionales
 * @returns {Object} - Headers completos
 */
function getCompleteHeaders(responseType = 'json', options = {}) {
  const { origin, environment } = options;
  
  let headers = {
    ...getSecurityHeaders(environment),
    ...getPrivacyHeaders()
  };

  // Headers específicos por tipo
  switch (responseType) {
  case 'json':
    headers = { ...headers, ...getApiHeaders() };
    break;
  case 'html':
    headers['Content-Type'] = 'text/html; charset=utf-8';
    break;
  case 'file':
    headers['Content-Disposition'] = 'attachment';
    break;
  }

  // CORS si se proporciona origin
  if (origin) {
    headers = { ...headers, ...getCorsHeaders(origin) };
  }

  return headers;
}

module.exports = {
  getSecurityHeaders,
  applySecurityHeaders,
  getApiHeaders,
  getCorsHeaders,
  getAllowedOrigins,
  isOriginAllowed,
  getPrivacyHeaders,
  getCompleteHeaders,
  generateRequestId
};
