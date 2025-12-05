/**
 * EJEMPLO COMPLETO DE HANDLER CON TODAS LAS MEJORAS DE SEGURIDAD v2.1
 * 
 * Este handler demuestra cómo integrar las 5 mejoras de seguridad:
 * 1. Input Validation (globalValidator)
 * 2. Request/Response Logging (requestLogger)
 * 3. Data Encryption (encryption)
 * 4. Throttling Dual (rateLimiter)
 * 5. Secrets Rotation (automático, no requiere código)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { createLogger } = require('../../utils/logger');
const { createValidatedAPIHandler } = require('../../utils/globalValidator');
const { encryptPII, decryptPII } = require('../../utils/encryption');
const { requestResponseLogger, logAuditAction } = require('../../middleware/requestLogger');
const { rateLimitMiddleware } = require('../../middleware/rateLimiter');
const { validateMiddleware } = require('../../utils/validator');

const logger = createLogger({ module: 'createOcupanteExample' });
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.OCUPANTES_TABLE;

/**
 * Handler principal: Crear Ocupante con PII encriptada
 */
async function createOcupanteHandler(event, context) {
  const userSub = event.requestContext.authorizer?.jwt?.claims?.sub;
  const body = event.parsedBody || JSON.parse(event.body);
  
  logger.info('Creating new ocupante', { 
    userSub: userSub?.substring(0, 12),
    ocupanteTipo: body.tipo
  });

  try {
    // === MEJORA 3: ENCRIPTACIÓN DE PII ===
    // Encriptar campos sensibles ANTES de guardar
    const encryptedData = await encryptPII(body, [
      'email',
      'telefono',
      'dni',
      'address'
    ]);

    const ocupante = {
      id: `ocupante-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ...encryptedData,
      createdBy: userSub,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Guardar en DynamoDB con datos encriptados
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: ocupante,
      ConditionExpression: 'attribute_not_exists(id)'
    }));

    // === MEJORA 2: AUDIT LOGGING ===
    // Loguear acción crítica
    await logAuditAction(
      'OCUPANTE_CREATED',
      {
        ocupanteId: ocupante.id,
        tipo: body.tipo,
        // NO incluir PII en audit logs
      },
      userSub,
      logger
    );

    logger.info('Ocupante created successfully', { 
      ocupanteId: ocupante.id 
    });

    // Retornar datos SIN encriptar al cliente
    const responseData = await decryptPII(ocupante, [
      'email',
      'telefono',
      'dni',
      'address'
    ]);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        data: responseData,
        message: 'Ocupante creado exitosamente'
      })
    };

  } catch (error) {
    logger.error('Error creating ocupante', error);

    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 409,
        body: JSON.stringify({
          ok: false,
          error: 'El ocupante ya existe',
          code: 'DUPLICATE_OCUPANTE'
        })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      })
    };
  }
}

/**
 * Handler de lectura: Desencriptar PII al retornar
 */
async function getOcupanteHandler(event, context) {
  const { id } = event.pathParameters;
  const userSub = event.requestContext.authorizer?.jwt?.claims?.sub;

  logger.info('Getting ocupante', { 
    ocupanteId: id,
    userSub: userSub?.substring(0, 12)
  });

  try {
    // Leer de DynamoDB (datos encriptados)
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { id }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          ok: false,
          error: 'Ocupante no encontrado',
          code: 'NOT_FOUND'
        })
      };
    }

    // === MEJORA 3: DESENCRIPTACIÓN DE PII ===
    // Desencriptar campos sensibles ANTES de retornar
    const decryptedData = await decryptPII(result.Item, [
      'email',
      'telefono',
      'dni',
      'address'
    ]);

    logger.info('Ocupante retrieved successfully', { 
      ocupanteId: id 
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ok: true,
        data: decryptedData
      })
    };

  } catch (error) {
    logger.error('Error getting ocupante', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      })
    };
  }
}

// ============================================
// EXPORTACIÓN CON TODAS LAS MEJORAS
// ============================================

/**
 * === MEJORA 1: INPUT VALIDATION ===
 * createValidatedAPIHandler FUERZA validación para POST/PUT/PATCH
 */
module.exports.create = createValidatedAPIHandler(createOcupanteHandler, {
  method: 'POST',
  validationSchema: 'createOcupante', // Schema definido en validator.js
  
  // === MEJORA 2: REQUEST/RESPONSE LOGGING ===
  preMiddleware: [
    requestResponseLogger().before
  ],
  postMiddleware: [
    requestResponseLogger().after
  ],
  errorMiddleware: [
    requestResponseLogger().onError
  ],
  
  // === MEJORA 4: THROTTLING DUAL (user + IP) ===
  rateLimit: {
    endpoint: 'createOcupante',
    dualCheck: true, // Valida usuario Y IP
    maxRequests: 20,
    windowSeconds: 60
  }
});

/**
 * Handler GET (no requiere validación de body)
 */
module.exports.get = createValidatedAPIHandler(getOcupanteHandler, {
  method: 'GET',
  // No validationSchema para GET (no tiene body)
  
  preMiddleware: [
    requestResponseLogger().before
  ],
  postMiddleware: [
    requestResponseLogger().after
  ],
  
  rateLimit: {
    endpoint: 'getOcupante',
    dualCheck: false, // Solo IP para endpoints de lectura
    maxRequests: 100,
    windowSeconds: 60
  }
});

// ============================================
// NOTAS IMPORTANTES
// ============================================

/**
 * FLUJO COMPLETO DE SEGURIDAD:
 * 
 * 1. REQUEST llega a API Gateway
 *    ↓
 * 2. WAF valida (rate limit, SQL injection, XSS)
 *    ↓
 * 3. JWT Authorizer valida token (Cognito)
 *    ↓
 * 4. Lambda recibe evento
 *    ↓
 * 5. requestLogger.before() loguea request (sanitizado)
 *    ↓
 * 6. validateMiddleware() valida schema AJV
 *    ↓
 * 7. rateLimiter valida user + IP (dual)
 *    ↓
 * 8. Handler ejecuta:
 *    - encryptPII() encripta datos sensibles
 *    - DynamoDB.PutCommand() guarda datos encriptados
 *    - logAuditAction() loguea acción crítica
 *    - decryptPII() desencripta para respuesta
 *    ↓
 * 9. requestLogger.after() loguea response (sanitizado)
 *    ↓
 * 10. Response retorna al cliente
 * 
 * === MEJORA 5: SECRETS ROTATION ===
 * - AWS Secrets Manager rota secrets cada 30 días
 * - Lambda rotateSecrets.handler se invoca automáticamente
 * - Secrets (JWT_SECRET, etc) se actualizan sin downtime
 * - SNS notifica a admin@hospital.com
 */

/**
 * EJEMPLO DE LOGS GENERADOS:
 * 
 * === Request Log ===
 * {
 *   "level": "info",
 *   "message": "Incoming request",
 *   "httpMethod": "POST",
 *   "path": "/ocupantes",
 *   "sourceIp": "192.168.1.100",
 *   "userSub": "abc123def456",
 *   "correlationId": "req-789xyz",
 *   "bodySize": 256
 * }
 * 
 * === Validation Log ===
 * {
 *   "level": "debug",
 *   "message": "Validation passed",
 *   "schema": "createOcupante"
 * }
 * 
 * === Encryption Log ===
 * {
 *   "level": "debug",
 *   "message": "Field encrypted",
 *   "field": "email"
 * }
 * 
 * === Audit Log ===
 * {
 *   "level": "info",
 *   "message": "Audit log",
 *   "eventType": "AUDIT",
 *   "action": "OCUPANTE_CREATED",
 *   "actor": "abc123def456",
 *   "details": { "ocupanteId": "ocupante-123", "tipo": "medico" },
 *   "timestamp": "2025-12-04T10:30:00Z"
 * }
 * 
 * === Response Log ===
 * {
 *   "level": "info",
 *   "message": "Request completed successfully",
 *   "statusCode": 201,
 *   "duration": 145,
 *   "correlationId": "req-789xyz"
 * }
 */

/**
 * EJEMPLO DE DATOS EN DYNAMODB:
 * 
 * {
 *   "id": "ocupante-1733312400-abc123",
 *   "nombre": "Dr. Juan Pérez",
 *   "tipo": "medico",
 *   "especialidad": "Cardiología",
 *   "email": "ZGVmNDU2:YWJjMTIz:ZW1haWxAZXhhbXBsZS5jb20=",  // ENCRIPTADO ✅
 *   "telefono": "ZGVmNDU2:YWJjMTIz:KzU2OTEyMzQ1Njc4",       // ENCRIPTADO ✅
 *   "dni": "ZGVmNDU2:YWJjMTIz:MTIzNDU2NzgtOQ==",            // ENCRIPTADO ✅
 *   "createdBy": "abc123def456789",
 *   "createdAt": "2025-12-04T10:30:00.000Z",
 *   "updatedAt": "2025-12-04T10:30:00.000Z"
 * }
 * 
 * Formato encriptación: "iv:authTag:encryptedData" (base64)
 */
