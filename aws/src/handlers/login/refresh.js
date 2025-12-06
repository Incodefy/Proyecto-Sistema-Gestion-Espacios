// src/handlers/refresh.js

// ✅ ANTI-CORRUPTION LAYER: AuthAdapter reemplaza llamadas directas a Cognito
const { getAuthAdapter, TokenExpiredError, InvalidTokenError } = require('../../adapters/authAdapter');
const Logger = require('../../utils/logger');
const { createAPIHandler } = require('../../utils/interceptors');
const { ValidationError } = require('../../utils/errors');
const { successResponse, errorResponse } = require('../../utils/response');

// AuthAdapter (ACL)
const authAdapter = getAuthAdapter();

async function refreshHandler(event, logger) {
  const body = JSON.parse(event.body || '{}');
  const { refreshToken } = body;

  if (!refreshToken) throw new ValidationError('refreshToken es obligatorio');

  try {
    // ✅ ACL: AuthAdapter maneja Cognito con circuit breaker, retry, traducción de errores
    const tokenSet = await authAdapter.refresh(refreshToken);

    logger.info('Token refrescado exitosamente');

    // ✅ Retornar modelo de dominio (no estructura Cognito)
    return successResponse({
      idToken: tokenSet.idToken,
      accessToken: tokenSet.accessToken,
      expiresIn: tokenSet.expiresIn
    });

  } catch (error) {
    // ✅ Excepciones del dominio (no errores Cognito)
    if (error instanceof TokenExpiredError) {
      logger.warn('Refresh token expired');
      return errorResponse('Token expirado, por favor inicia sesión nuevamente', 401);
    }

    if (error instanceof InvalidTokenError) {
      logger.warn('Invalid refresh token');
      return errorResponse('Token inválido', 401);
    }

    // Error genérico
    logger.error('Token refresh error', error);
    return errorResponse('Error refrescando token', 500);
  }
}

// Exportar con interceptors (rate limit: 20 req/min)
exports.handler = createAPIHandler(refreshHandler, {
  rateLimit: {
    limit: 20,
    window: 60,
    endpoint: 'refresh'
  }
});
