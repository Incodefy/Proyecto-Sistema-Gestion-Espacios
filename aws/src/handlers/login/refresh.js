// src/handlers/refresh.js
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const Logger = require('../../utils/logger');
const { createAPIHandler } = require('../../utils/interceptors');
const { ValidationError } = require('../../utils/errors');
const { successResponse } = require('../../utils/response');
const { retryCognito } = require('../../utils/cognitoWrapper');

const client = new CognitoIdentityProviderClient({});

async function refreshHandler(event, logger) {
  const body = JSON.parse(event.body || '{}');
  const { refreshToken } = body;

  if (!refreshToken) throw new ValidationError('refreshToken es obligatorio');

  const cmd = new InitiateAuthCommand({
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: process.env.USER_POOL_CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: refreshToken }
  });

  const out = await retryCognito(() => client.send(cmd));
  const auth = out.AuthenticationResult || {};

  logger.info('Token refrescado exitosamente');

  return successResponse({
    idToken: auth.IdToken,
    accessToken: auth.AccessToken,
    expiresIn: auth.ExpiresIn
  });
}

module.exports.refresh = createAPIHandler(refreshHandler, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });
    };
  }
};
