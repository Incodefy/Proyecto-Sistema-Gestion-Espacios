// src/handlers/login.js
const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const { validate } = require('../../utils/validation');
const { successResponse, errorResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { createAPIHandler } = require('../../utils/interceptors');
const { ValidationError } = require('../../utils/errors');
const { retryCognito } = require('../../utils/cognitoWrapper');

const client = new CognitoIdentityProviderClient({});

async function loginHandler(event, logger) {
  const body = JSON.parse(event.body || '{}');
  const validation = validate(body, 'login');
  if (!validation.valid) throw new ValidationError('Datos de login inválidos', validation.errors);
  
  logger.info('Login attempt', { username });

  const cmd = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: process.env.USER_POOL_CLIENT_ID,
    AuthParameters: { USERNAME: username, PASSWORD: password }
  });

  const out = await retryCognito(() => client.send(cmd));

  if (out.ChallengeName) {
    logger.warn('Challenge required', { challenge: out.ChallengeName });
    throw new ValidationError(`Challenge required: ${out.ChallengeName}`);
  }

  const auth = out.AuthenticationResult || {};
  logger.info('Login successful', { username, expiresIn: auth.ExpiresIn });
  
  return successResponse({
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    refreshToken: auth.RefreshToken,
    expiresIn: auth.ExpiresIn
  });
}

module.exports.login = createAPIHandler(loginHandler, { rateLimit: { maxRequests: 10, windowSeconds: 300 } });
