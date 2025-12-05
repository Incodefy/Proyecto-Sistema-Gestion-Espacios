/**
 * Middleware de Correlation ID
 * 
 * Genera o extrae un correlation ID para cada request
 * para trazabilidad end-to-end entre frontend y backend
 */

const crypto = require('crypto');

/**
 * Genera un correlation ID único
 */
function generateCorrelationId() {
  return `req-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Middleware que agrega correlation ID a cada request
 */
function correlationIdMiddleware(req, res, next) {
  // Intentar extraer correlation ID del header (si viene del cliente)
  let correlationId = req.headers['x-correlation-id'];

  // Si no existe, generar uno nuevo
  if (!correlationId) {
    correlationId = generateCorrelationId();
  }

  // Agregar al request object para uso posterior
  req.correlationId = correlationId;

  // Agregar al response header para que el cliente lo vea
  res.setHeader('X-Correlation-ID', correlationId);

  // Logging (solo en development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔵 [${correlationId}] ${req.method} ${req.originalUrl || req.url}`);
  }

  next();
}

/**
 * Helper para crear un correlation ID en contextos no-middleware
 */
function createCorrelationId() {
  return generateCorrelationId();
}

module.exports = {
  correlationIdMiddleware,
  generateCorrelationId,
  createCorrelationId
};
