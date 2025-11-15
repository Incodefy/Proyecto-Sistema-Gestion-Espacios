// src/handlers/login.js
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const { validate } = require('../../utils/validation');
const { successResponse, errorResponse, validationErrorResponse, forbiddenResponse } = require('../../utils/response');
const { createLogger } = require('../../utils/logger');

const client = new CognitoIdentityProviderClient({});
const logger = createLogger({ handler: 'login', function: 'login' });

/**
 * POST /auth/login
 * Body: { "username": "email@dominio.com", "password": "Passw0rd!" }
 * Respuesta: { success: true, data: { idToken, accessToken, refreshToken, expiresIn } }
 */
module.exports.login = async (event) => {
  const endTrace = logger.startTrace('login');
  
  try {
    // Parsear body
    const body = JSON.parse(event.body || '{}');
    
    // Validar con AJV
    const validation = validate(body, 'login');
    if (!validation.valid) {
      logger.warn('Validation failed', { errors: validation.errors });
      endTrace({ success: false, reason: 'validation' });
      return validationErrorResponse(validation.errors);
    }
    
    const { username, password } = validation.data;
    
    logger.info('Login attempt', { username });

    const cmd = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    });

    const out = await client.send(cmd);

    if (out.ChallengeName) {
      logger.warn('Challenge required', { challenge: out.ChallengeName, username });
      endTrace({ success: false, reason: 'challenge_required' });
      return forbiddenResponse(`Challenge required: ${out.ChallengeName}`);
    }

    const auth = out.AuthenticationResult || {};
    
    logger.info('Login successful', { username });
    endTrace({ success: true });
    
    return successResponse({
      idToken: auth.IdToken,
      accessToken: auth.AccessToken,
      refreshToken: auth.RefreshToken,
      expiresIn: auth.ExpiresIn
    });
  } catch (err) {
    logger.error('Login failed', err, { username: body.username });
    endTrace({ success: false, reason: 'auth_error' });
    return errorResponse('Credenciales inválidas o usuario no confirmado', 401);
  }
};
