// middleware/requireAuth.js

/**
 * Middleware de autenticación con prevención de cache
 * Verifica que el usuario tenga una sesión válida y configura headers
 * para prevenir que el navegador cachee páginas protegidas
 */
const requireAuth = (req, res, next) => {
  // Verificar sesión activa
  if (!req.session.user || !req.session.user.idToken) {
    req.flash('error', 'Debes iniciar sesión para acceder a esta página');
    return res.redirect('/login');
  }
  
  // Headers anti-cache para prevenir acceso después de logout
  // Estas cabeceras previenen que el navegador guarde la página en cache
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '-1',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  next();
};

module.exports = requireAuth;