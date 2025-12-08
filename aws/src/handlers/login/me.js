// src/handlers/me.js
const { Logger } = require('../../utils/logger');
const { createAPIHandler } = require('../../middleware/interceptors');
const { successResponse } = require('../../utils/errorHandler');

async function meHandler(event, logger) {
  const claims = event.requestContext?.authorizer?.jwt?.claims || {};
  
  logger.info('Usuario obteniendo perfil', { sub: claims.sub });
  
  return successResponse({
    sub: claims.sub,
    email: claims.email,
    username: claims['cognito:username'],
    groups: claims['cognito:groups'] || [],
    claims
  });
}

module.exports.me = createAPIHandler(meHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });
