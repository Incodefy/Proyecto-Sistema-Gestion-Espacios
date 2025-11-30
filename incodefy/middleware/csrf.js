/**
 * CSRF Protection Middleware
 * 
 * Implementa protección contra ataques Cross-Site Request Forgery (CSRF)
 * usando tokens únicos por sesión que deben incluirse en todos los formularios
 * y peticiones POST/PUT/DELETE.
 * 
 * Características:
 * - Token único por sesión
 * - Validación automática en peticiones que modifican datos
 * - Integración con formularios HTML y peticiones AJAX
 * - Manejo de errores personalizado
 * 
 * @version 1.0.0
 */

const csrf = require('csurf');

/**
 * Configuración del middleware CSRF
 * Usa cookies para almacenar el token (más seguro que sesión)
 */
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    sameSite: 'strict', // Máxima protección CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
});

/**
 * Middleware para agregar el token CSRF a todas las vistas
 * Hace que el token esté disponible en res.locals.csrfToken
 */
const attachCsrfToken = (req, res, next) => {
  // Solo generar token si existe la función csrfToken
  if (typeof req.csrfToken === 'function') {
    res.locals.csrfToken = req.csrfToken();
  } else {
    res.locals.csrfToken = null;
  }
  next();
};

/**
 * Middleware para manejar errores CSRF
 * Proporciona respuestas específicas para errores de validación CSRF
 */
const csrfErrorHandler = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    // No es un error CSRF, pasar al siguiente error handler
    return next(err);
  }

  console.error('🚨 [CSRF] Token inválido detectado:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: req.session?.user?.email || 'NO AUTENTICADO'
  });

  // Si es una petición AJAX
  if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return res.status(403).json({
      ok: false,
      error: 'CSRF token validation failed',
      message: 'Token de seguridad inválido. Por favor, recarga la página.',
      code: 'INVALID_CSRF_TOKEN'
    });
  }

  // Si es una petición de formulario HTML
  req.flash('error', 'Token de seguridad inválido. Por favor, intenta nuevamente.');
  return res.redirect('back');
};

/**
 * Rutas que están exentas de protección CSRF
 * Generalmente endpoints de API que usan autenticación por token
 */
const csrfExemptPaths = [
  '/api/webhooks',           // Webhooks externos
  '/api/health',             // Health checks
  '/refresh-token',          // Renovación de token JWT (usa autenticación por sesión)
];

/**
 * Middleware condicional de CSRF
 * Aplica protección CSRF excepto en rutas exentas
 */
const conditionalCsrfProtection = (req, res, next) => {
  // Verificar si la ruta está exenta
  const isExempt = csrfExemptPaths.some(path => req.path.startsWith(path));
  
  if (isExempt) {
    console.log(`⚠️ [CSRF] Ruta exenta de protección: ${req.path}`);
    return next();
  }

  // Aplicar protección CSRF
  csrfProtection(req, res, next);
};

module.exports = {
  csrfProtection,
  attachCsrfToken,
  csrfErrorHandler,
  conditionalCsrfProtection,
  csrfExemptPaths
};
