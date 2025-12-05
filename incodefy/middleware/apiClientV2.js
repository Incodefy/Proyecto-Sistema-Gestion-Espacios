/**
 * Middleware para adjuntar ApiClientV2 al request
 * 
 * Actualizado para usar el nuevo ApiClientV2 con soporte para:
 * - Correlation IDs
 * - Rate limiting headers
 * - Retry automático
 * - Better error handling
 */

const ApiClientV2 = require('../apiClientV2');

/**
 * Middleware que crea una instancia de ApiClientV2 y la adjunta al request
 */
function attachApiClientV2(req, res, next) {
  // Verificar que haya usuario autenticado
  if (!req.user || !req.user.token) {
    console.warn('⚠️ attachApiClientV2: No hay usuario autenticado');
    return next();
  }

  try {
    // Crear instancia de ApiClientV2 con el token del usuario
    req.apiClient = new ApiClientV2(req.user.token, {
      correlationId: req.correlationId, // Usar correlation ID del middleware
      userSub: req.user.sub,
      maxRetries: 3,
      retryDelay: 1000
    });

    next();
  } catch (error) {
    console.error('❌ Error creando ApiClientV2:', error.message);
    next(error);
  }
}

module.exports = attachApiClientV2;
