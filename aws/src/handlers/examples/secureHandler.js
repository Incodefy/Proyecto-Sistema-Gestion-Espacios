// Ejemplo de handler con todas las mejoras de seguridad integradas
// Este es un template que puedes usar para actualizar tus handlers existentes

const { sanitizeEvent } = require('../../utils/sanitizer');
const { validate } = require('../../utils/validation');
const { successResponse, errorResponse, validationErrorResponse } = require('../../utils/response');
const { getSecurityHeaders } = require('../../middleware/securityHeaders');
const { checkRateLimit, addRateLimitHeaders } = require('../../middleware/rateLimiter');
const { getSecret } = require('../../utils/secretsManager');
const { createLogger } = require('../../utils/logger');

const logger = createLogger({ handler: 'example', function: 'secureHandler' });

/**
 * Handler seguro con todas las mejoras implementadas
 * @param {Object} event - Lambda event
 * @returns {Object} - Lambda response
 */
exports.handler = async (event) => {
  const endTrace = logger.startTrace('secureHandler');
  const origin = event.headers?.origin || event.headers?.Origin;

  try {
    // 1. RATE LIMITING
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const rateLimitCheck = await checkRateLimit('exampleEndpoint', userSub || 'anonymous');
    
    if (!rateLimitCheck.allowed) {
      endTrace({ success: false, reason: 'rate_limit' });
      return {
        statusCode: 429,
        headers: {
          ...getSecurityHeaders(),
          'Retry-After': Math.ceil((rateLimitCheck.resetAt - Date.now()) / 1000).toString()
        },
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Too many requests',
            code: 429,
            retryAfter: rateLimitCheck.resetAt
          }
        })
      };
    }

    // 2. INPUT SANITIZATION
    const sanitizedEvent = sanitizeEvent(event);
    const body = JSON.parse(sanitizedEvent.body || '{}');

    // 3. VALIDATION
    const validation = validate(body, 'exampleSchema');
    if (!validation.valid) {
      logger.warn('Validation failed', { errors: validation.errors });
      endTrace({ success: false, reason: 'validation' });
      return validationErrorResponse(validation.errors);
    }

    // 4. OBTENER SECRETS (si es necesario)
    // const apiKey = await getSecret('EXTERNAL_API_KEY');

    // 5. LÓGICA DE NEGOCIO
    logger.info('Processing request', { 
      userSub: userSub?.substring(0, 10),
      endpoint: 'example'
    });

    const result = {
      message: 'Request processed successfully',
      data: validation.data
    };

    // 6. RESPONSE CON HEADERS DE SEGURIDAD
    const response = successResponse(result, 200);
    const secureResponse = {
      ...response,
      headers: {
        ...response.headers,
        ...getSecurityHeaders(),
        ...rateLimitCheck.rateLimitHeaders
      }
    };

    endTrace({ success: true });
    return secureResponse;

  } catch (error) {
    logger.error('Handler error', error);
    endTrace({ success: false, reason: 'error' });
    
    return {
      ...errorResponse(error.message, 500),
      headers: {
        ...getSecurityHeaders()
      }
    };
  }
};

/**
 * Ejemplo específico: Login handler con seguridad completa
 */
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const client = new CognitoIdentityProviderClient({});

exports.secureLogin = async (event) => {
  const endTrace = logger.startTrace('login');

  try {
    // 1. Rate limiting ESTRICTO para login
    const ip = event.requestContext?.http?.sourceIp;
    const rateLimitCheck = await checkRateLimit('login', ip);
    
    if (!rateLimitCheck.allowed) {
      logger.warn('Login rate limit exceeded', { ip });
      endTrace({ success: false, reason: 'rate_limit' });
      
      return {
        statusCode: 429,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Too many login attempts. Please wait 5 minutes.',
            code: 429,
            retryAfter: rateLimitCheck.resetAt
          }
        })
      };
    }

    // 2. Sanitizar input
    const sanitizedEvent = sanitizeEvent(event);
    const body = JSON.parse(sanitizedEvent.body || '{}');

    // 3. Validar con schema
    const validation = validate(body, 'login');
    if (!validation.valid) {
      logger.warn('Login validation failed', { errors: validation.errors });
      endTrace({ success: false, reason: 'validation' });
      return validationErrorResponse(validation.errors);
    }

    const { username, password } = validation.data;

    // 4. Intentar autenticación con Cognito
    logger.info('Login attempt', { username });

    const cmd = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.USER_POOL_CLIENT_ID,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      }
    });

    const cognitoResponse = await client.send(cmd);

    if (cognitoResponse.ChallengeName) {
      logger.warn('Challenge required', { challenge: cognitoResponse.ChallengeName });
      endTrace({ success: false, reason: 'challenge' });
      
      return {
        statusCode: 403,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          success: false,
          error: {
            message: `Challenge required: ${cognitoResponse.ChallengeName}`,
            code: 403
          }
        })
      };
    }

    const auth = cognitoResponse.AuthenticationResult || {};

    // 5. Log exitoso (sin exponer tokens)
    logger.info('Login successful', { 
      username,
      tokenType: auth.TokenType 
    });

    endTrace({ success: true });

    // 6. Response segura
    return {
      statusCode: 200,
      headers: {
        ...getSecurityHeaders(),
        ...rateLimitCheck.rateLimitHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          idToken: auth.IdToken,
          accessToken: auth.AccessToken,
          refreshToken: auth.RefreshToken,
          expiresIn: auth.ExpiresIn
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    logger.error('Login failed', error, { 
      errorCode: error.name 
    });
    
    endTrace({ success: false, reason: 'auth_error' });

    // No exponer detalles del error al cliente
    return {
      statusCode: 401,
      headers: getSecurityHeaders(),
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Invalid credentials',
          code: 401
        }
      })
    };
  }
};

/**
 * Ejemplo: Handler para crear grupo con seguridad completa
 */
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.secureCreateGroup = async (event) => {
  const endTrace = logger.startTrace('createGroup');

  try {
    const userSub = event.requestContext.authorizer.jwt.claims.sub;
    const userEmail = event.requestContext.authorizer.jwt.claims.email;

    // 1. Rate limiting
    const rateLimitCheck = await checkRateLimit('createGroup', userSub);
    if (!rateLimitCheck.allowed) {
      endTrace({ success: false, reason: 'rate_limit' });
      return {
        statusCode: 429,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          success: false,
          error: { message: 'Too many requests', code: 429 }
        })
      };
    }

    // 2. Sanitizar y validar
    const sanitizedEvent = sanitizeEvent(event);
    const body = JSON.parse(sanitizedEvent.body || '{}');

    // Validación básica
    if (!body.name || body.name.trim().length === 0) {
      endTrace({ success: false, reason: 'invalid_input' });
      return validationErrorResponse([{ field: 'name', message: 'Name is required' }]);
    }

    // 3. Crear grupo
    const groupId = `grp_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await db.send(new PutCommand({
      TableName: process.env.GROUPS_TABLE,
      Item: {
        group_id: groupId,
        nombre: body.name.trim(),
        owner_sub: userSub,
        configured: false,
        nomenclatura: body.nomenclatura || {
          general: 'Pasillo',
          especifico: 'Box',
          ocupante: 'Médico'
        },
        created_at: now,
        updated_at: now
      }
    }));

    logger.info('Group created', { groupId, userSub: userSub.substring(0, 10) });
    endTrace({ success: true });

    // 4. Response segura
    return {
      statusCode: 201,
      headers: {
        ...getSecurityHeaders(),
        ...rateLimitCheck.rateLimitHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          group_id: groupId,
          nombre: body.name.trim()
        },
        timestamp: now
      })
    };

  } catch (error) {
    logger.error('Error creating group', error);
    endTrace({ success: false, reason: 'error' });

    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Internal server error',
          code: 500
        }
      })
    };
  }
};
