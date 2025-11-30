// middleware/csp.js - Content Security Policy middleware
const crypto = require('crypto');

/**
 * Genera un nonce único para cada request
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
function generateNonce(req, res, next) {
  // Generar nonce aleatorio de 16 bytes (128 bits)
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

/**
 * Middleware de Content Security Policy
 * Configura headers CSP según mejores prácticas de OWASP
 */
function setCSPHeaders(req, res, next) {
  // No aplicar CSP a archivos estáticos (CSS, JS, fuentes, imágenes, etc.)
  // X-Content-Type-Options ya se establece en server.js para TODOS los recursos
  const isStaticAsset = /\.(woff2?|ttf|eot|otf|png|jpg|jpeg|gif|svg|ico|css|js|map|webp|wasm)$/i.test(req.path);
  
  if (isStaticAsset) {
    // Para archivos estáticos no aplicamos CSP (solo X-Content-Type-Options desde server.js)
    return next();
  }
  
  const nonce = res.locals.cspNonce;
  
  // Directivas CSP para páginas HTML
  const directives = {
    // Scripts: solo desde self, CDNs confiables y scripts con nonce
    // NO usar unsafe-inline para máxima seguridad
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "https://cdn.jsdelivr.net"
    ],
    
    // Estilos: solo desde self, CDNs confiables y estilos con nonce
    // unsafe-hashes permite atributos style="" aplicados dinámicamente por JS
    // Hashes específicos para atributos style="" estáticos en templates
    "style-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'unsafe-hashes'",
      "'sha256-DkJ2VwByWwAX02sBH0U057d5VUsZyPJh0xrP51GWxNQ='",
      "'sha256-hJXMcLCjukjZ8Dv4s2vTpjP2innQtlcK96C3N+r7/Os='",
      "'sha256-deeCaDEBDliiHqyFBt8kCIKLF+ppi1naPylX5S9AI6M='",
      "'sha256-biLFinpqYMtWHmXfkA1BPeCY0/fNt46SAZ+BBk5YUog='",
      "'sha256-2opk+KOuqARgOTZoW0+WrlAi++YJpYj95zgLf9esCiU='",
      "'sha256-FHKX0WazXLp32xToG5QrReo+Qf6diYmPsJK42GNHPQI='",
      "'sha256-lk7hylbmJwTPcb8isQvvrTwsTww1/Os1CNolzv8xNtc='",
      "'sha256-pTQEH/f9k1lyTb1wp+Me7pOdcjXyzeEWSKjAY1KZdlc='",
      "'sha256-mjUy7dFc9gDb60NcMaH4/R0QGqCh192/PlG/UkLyOI='",
      "'sha256-Vv2/8S57s+bt4kNRV9HLcrfaSB5ebCn/YExVy4qaqdU='",
      "https://cdn.jsdelivr.net"
    ],
    
    // Imágenes: self y data URIs (para charts)
    "img-src": [
      "'self'",
      "data:",
      "blob:"
    ],
    
    // Fuentes: self (Font Awesome ahora es local)
    "font-src": [
      "'self'",
      "data:"
    ],
    
    // Conexiones AJAX: self, WebSocket AWS y source maps CDN
    "connect-src": [
      "'self'",
      "wss://erwiw5frx8.execute-api.us-east-2.amazonaws.com",
      "https://cdn.jsdelivr.net"
    ],
    
    // Frames (iframes): no permitir cargar contenido en frames
    "frame-src": [
      "'none'"
    ],
    
    // Frames: no permitir embedding (clickjacking protection)
    "frame-ancestors": [
      "'none'"
    ],
    
    // Formularios: solo pueden enviar a nuestro dominio
    "form-action": [
      "'self'"
    ],
    
    // Base URI: restringir <base> tag
    "base-uri": [
      "'self'"
    ],
    
    // Object/embed: no permitir plugins
    "object-src": [
      "'none'"
    ],
    
    // Media: self
    "media-src": [
      "'self'"
    ],
    
    // Manifests: self
    "manifest-src": [
      "'self'"
    ],
    
    // Workers: self
    "worker-src": [
      "'self'"
    ],
    
    // NOTA: prefetch-src está deprecado, se eliminó para evitar advertencias
    // Los navegadores modernos usan default-src como fallback
    
    // Require trusted types (experimental - commented for compatibility)
    // "require-trusted-types-for": ["'script'"],
    
    // Upgrade insecure requests (HTTP -> HTTPS) en producción
    ...(process.env.NODE_ENV === 'production' && {
      "upgrade-insecure-requests": []
    }),
    
    // Block mixed content en producción
    ...(process.env.NODE_ENV === 'production' && {
      "block-all-mixed-content": []
    })
  };
  
  // Construir el header CSP
  const cspHeader = Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
  
  // Establecer headers de seguridad
  res.setHeader('Content-Security-Policy', cspHeader);
  
  // CSP Report-Only mode para testing (comentar en producción)
  // res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
  
  next();
}

/**
 * Configuración más estricta para rutas públicas (login, signup)
 */
function setStrictCSPHeaders(req, res, next) {
  const nonce = res.locals.cspNonce;
  
  const directives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`
    ],
    "style-src": [
      "'self'",
      `'nonce-${nonce}'`
    ],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"]
  };
  
  const cspHeader = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
  
  res.setHeader('Content-Security-Policy', cspHeader);
  next();
}

/**
 * Adiciona el nonce a res.locals para uso en templates
 */
function attachNonceToLocals(req, res, next) {
  // El nonce ya está en res.locals.cspNonce
  // Solo aseguramos que esté disponible para las vistas
  if (!res.locals.cspNonce) {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  }
  next();
}

module.exports = {
  generateNonce,
  setCSPHeaders,
  setStrictCSPHeaders,
  attachNonceToLocals
};
