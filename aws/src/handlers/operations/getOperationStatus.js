/**
 * GET /operations/{operationId}
 * 
 * Status Endpoint para Async Request-Reply Pattern
 * 
 * Retorna estado de operación asíncrona para polling del cliente
 * 
 * Request:
 * - GET /operations/{operationId}
 * - Authorization: Bearer <token> (JWT con sub)
 * 
 * Response:
 * - 200 OK: Operación encontrada
 * - 403 Forbidden: Operación no pertenece al usuario
 * - 404 Not Found: Operación no existe o expiró (TTL 7 días)
 * - 500 Internal Server Error: Error del servidor
 * 
 * Response Body (200):
 * {
 *   "operationId": "uuid",
 *   "type": "CreateAppointment",
 *   "status": "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED",
 *   "progress": 0-100,
 *   "result": {...},        // Si COMPLETED
 *   "error": {...},         // Si FAILED
 *   "resourceId": "uuid",   // Si COMPLETED con recurso
 *   "resourceUrl": "/api/appointments/uuid", // Si COMPLETED
 *   "createdAt": "ISO timestamp",
 *   "updatedAt": "ISO timestamp"
 * }
 * 
 * Uso del cliente:
 * 1. POST /api/appointments → 202 Accepted { operationId, statusUrl }
 * 2. GET /operations/{operationId} (polling cada 2s)
 * 3. status === "COMPLETED" → Redirigir a resourceUrl
 * 4. status === "FAILED" → Mostrar error
 */

const { getOperationStore } = require("../../utils/operationStore");
const { Logger } = require("../../utils/logger");
const { getSecurityHeaders } = require("../../middleware/securityHeaders");
const { ValidationError, AuthorizationError, NotFoundError } = require("../../utils/errorHandler");

/**
 * Handler para GET /operations/{operationId}
 */
exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'getOperationStatus' });
  
  try {
    // 1. Extraer operationId de path parameters
    const operationId = event.pathParameters?.operationId;
    
    if (!operationId) {
      logger.warn('Missing operationId in path');
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'operationId is required in path'
        })
      };
    }

    // Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(operationId)) {
      logger.warn('Invalid operationId format', { operationId });
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'BAD_REQUEST',
          message: 'operationId must be a valid UUID'
        })
      };
    }

    // 2. Extraer userId del token JWT
    const userSub = event.requestContext?.authorizer?.claims?.sub;
    
    if (!userSub) {
      logger.warn('Missing user authentication');
      return {
        statusCode: 401,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        })
      };
    }

    logger.info('Getting operation status', { operationId, userId: userSub });

    // 3. Obtener operación del store
    const operationStore = getOperationStore(logger);
    const operation = await operationStore.getOperation(operationId);

    // 4. Verificar existencia
    if (!operation) {
      logger.warn('Operation not found', { operationId });
      return {
        statusCode: 404,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'NOT_FOUND',
          message: 'Operation not found or expired'
        })
      };
    }

    // 5. Verificar ownership (usuario solo puede ver sus operaciones)
    if (operation.userId !== userSub) {
      logger.warn('Forbidden: Operation does not belong to user', {
        operationId,
        operationUserId: operation.userId,
        requestUserId: userSub
      });
      return {
        statusCode: 403,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'FORBIDDEN',
          message: 'You do not have permission to view this operation'
        })
      };
    }

    // 6. Construir response (excluir campos internos)
    const response = {
      operationId: operation.operationId,
      type: operation.type,
      status: operation.status,
      progress: operation.progress || 0,
      createdAt: operation.createdAt,
      updatedAt: operation.updatedAt
    };

    // Agregar result si COMPLETED
    if (operation.status === 'COMPLETED' && operation.result) {
      response.result = operation.result;
    }

    // Agregar error si FAILED
    if (operation.status === 'FAILED' && operation.error) {
      response.error = operation.error;
    }

    // Agregar resource info si disponible
    if (operation.resourceId) {
      response.resourceId = operation.resourceId;
    }

    if (operation.resourceUrl) {
      response.resourceUrl = operation.resourceUrl;
    }

    logger.info('Operation status retrieved', {
      operationId,
      status: operation.status,
      progress: operation.progress
    });

    // 7. Retornar response
    return {
      statusCode: 200,
      headers: {
        ...getSecurityHeaders(),
        'Content-Type': 'application/json',
        // Cache control para polling
        'Cache-Control': operation.status === 'COMPLETED' || operation.status === 'FAILED' 
          ? 'public, max-age=3600'  // Cacheable si terminó
          : 'no-cache, no-store, must-revalidate' // No cacheable si en proceso
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    logger.error('Error getting operation status', error);

    // Errores de validación
    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: error.message
        })
      };
    }

    // Errores de autorización
    if (error instanceof AuthorizationError) {
      return {
        statusCode: 403,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'FORBIDDEN',
          message: error.message
        })
      };
    }

    // Errores no encontrado
    if (error instanceof NotFoundError) {
      return {
        statusCode: 404,
        headers: getSecurityHeaders(),
        body: JSON.stringify({
          error: 'NOT_FOUND',
          message: error.message
        })
      };
    }

    // Error genérico
    return {
      statusCode: 500,
      headers: getSecurityHeaders(),
      body: JSON.stringify({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while retrieving operation status'
      })
    };
  }
};
