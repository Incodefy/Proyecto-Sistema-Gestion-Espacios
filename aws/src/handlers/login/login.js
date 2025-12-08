// src/handlers/login.js

// ✅ ANTI-CORRUPTION LAYER: AuthAdapter reemplaza llamadas directas a Cognito
const { getAuthAdapter, InvalidCredentialsError, MFARequiredError, PasswordResetRequiredError } = require('../../adapters/authAdapter');

const { validate } = require('../../utils/validator');
const { successResponse, errorResponse } = require('../../utils/errorHandler');
const { Logger } = require('../../utils/logger');
const { createAPIHandler } = require('../../middleware/interceptors');
const { ValidationError } = require('../../utils/errorHandler');

// AuthAdapter (ACL)
const authAdapter = getAuthAdapter();

async function loginHandler(event, logger) {
  const body = JSON.parse(event.body || '{}');
  const validation = validate(body, 'login');
  if (!validation.valid) throw new ValidationError('Datos de login inválidos', validation.errors);
  
  const { username, password } = body;
  logger.info('Login attempt', { username });

  try {
    // ✅ ACL: AuthAdapter maneja Cognito con circuit breaker, retry, traducción de errores
    const authSession = await authAdapter.login(username, password);

    logger.info('Login successful', { 
      username, 
      expiresIn: authSession.expiresIn 
    });
    
    // ✅ Retornar modelo de dominio (no estructura Cognito)
    return successResponse({
      idToken: authSession.idToken,
      accessToken: authSession.accessToken,
      refreshToken: authSession.refreshToken,
      expiresIn: authSession.expiresIn,
      tokenType: authSession.tokenType
    });

  } catch (error) {
    // ✅ Excepciones del dominio (no errores Cognito)
    if (error instanceof InvalidCredentialsError) {
      logger.warn('Invalid credentials', { username });
      return errorResponse('Credenciales inválidas', 401);
    }

    if (error instanceof MFARequiredError) {
      logger.warn('MFA required', { username });
      return errorResponse('MFA verification required', 403, {
        challengeName: 'MFA_REQUIRED',
        session: error.session
      });
    }

    if (error instanceof PasswordResetRequiredError) {
      logger.warn('Password reset required', { username });
      return errorResponse('Password reset required', 403, {
        challengeName: 'NEW_PASSWORD_REQUIRED'
      });
    }

    // Error genérico
    logger.error('Login error', error, { username });
    return errorResponse('Error en autenticación', 500);
  }
}

module.exports.login = createAPIHandler(loginHandler, { rateLimit: { maxRequests: 10, windowSeconds: 300 } });
