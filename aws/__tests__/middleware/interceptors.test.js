/**
 * Tests para Interceptors (createAPIHandler)
 */

const { createAPIHandler } = require('../../src/middleware/interceptors');
const { Logger } = require('../../src/utils/logger');

describe('Interceptors - createAPIHandler', () => {
  let mockEvent;
  let mockContext;

  beforeEach(() => {
    mockEvent = {
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': 'test-correlation-123'
      },
      requestContext: {
        requestId: 'test-request-456',
        http: {
          method: 'POST',
          sourceIp: '127.0.0.1'
        },
        authorizer: {
          jwt: {
            claims: {
              sub: 'user-sub-789',
              email: 'test@example.com'
            }
          }
        }
      },
      body: JSON.stringify({ name: 'Test' })
    };

    mockContext = {
      requestId: 'lambda-context-123',
      functionName: 'test-function'
    };

    jest.clearAllMocks();
  });

  describe('Basic Handler Wrapping', () => {
    test('debe ejecutar handler y retornar response exitosa', async () => {
      const handlerFn = async (event, context, logger) => {
        return { id: '123', name: 'Test' };
      };

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('123');
    });

    test('debe parsear body automáticamente', async () => {
      const handlerFn = async (event, context, logger) => {
        expect(event.parsedBody).toBeDefined();
        expect(event.parsedBody.name).toBe('Test');
        return event.parsedBody;
      };

      const handler = createAPIHandler(handlerFn);
      await handler(mockEvent, mockContext);
    });

    test('debe inyectar logger con correlationId', async () => {
      let capturedLogger;
      const handlerFn = async (event, context, logger) => {
        capturedLogger = logger;
        return { test: true };
      };

      const handler = createAPIHandler(handlerFn);
      await handler(mockEvent, mockContext);

      expect(capturedLogger).toBeDefined();
      expect(capturedLogger.correlationId).toBe('test-correlation-123');
    });
  });

  describe('Error Handling', () => {
    test('debe manejar ValidationError correctamente', async () => {
      const { ValidationError } = require('../../src/utils/errorHandler');
      
      const handlerFn = async () => {
        throw new ValidationError('Invalid input', { field: 'name' });
      };

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('debe manejar NotFoundError', async () => {
      const { NotFoundError } = require('../../src/utils/errorHandler');
      
      const handlerFn = async () => {
        throw new NotFoundError('Resource not found');
      };

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(404);
    });

    test('debe manejar errores genéricos', async () => {
      const handlerFn = async () => {
        throw new Error('Unexpected error');
      };

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    test('debe aplicar rate limiting cuando está configurado', async () => {
      // Mock checkRateLimit
      const rateLimiter = require('../../src/middleware/rateLimiter');
      jest.spyOn(rateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: Date.now() + 60000
      });

      const handlerFn = async () => ({ success: true });

      const handler = createAPIHandler(handlerFn, {
        rateLimit: { maxRequests: 100, windowSeconds: 60 }
      });

      const response = await handler(mockEvent, mockContext);
      
      expect(response.statusCode).toBe(200);
      expect(rateLimiter.checkRateLimit).toHaveBeenCalled();
    });

    test('debe rechazar si rate limit es excedido', async () => {
      const rateLimiter = require('../../src/middleware/rateLimiter');
      jest.spyOn(rateLimiter, 'checkRateLimit').mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        retryAfter: 60
      });

      const handlerFn = async () => ({ success: true });

      const handler = createAPIHandler(handlerFn, {
        rateLimit: { maxRequests: 10, windowSeconds: 60 }
      });

      const response = await handler(mockEvent, mockContext);
      
      expect(response.statusCode).toBe(429);
      expect(response.headers['Retry-After']).toBe(60);
    });
  });

  describe('Security Headers', () => {
    test('debe incluir security headers en todas las respuestas', async () => {
      const handlerFn = async () => ({ data: 'test' });

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      expect(response.headers['Content-Security-Policy']).toBeDefined();
      expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
      expect(response.headers['X-Frame-Options']).toBeDefined();
      expect(response.headers['Strict-Transport-Security']).toBeDefined();
    });

    test('debe incluir CORS headers', async () => {
      const handlerFn = async () => ({ data: 'test' });

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      expect(response.headers['Access-Control-Allow-Origin']).toBeDefined();
      expect(response.headers['Access-Control-Allow-Methods']).toBeDefined();
    });
  });

  describe('User Context Extraction', () => {
    test('debe extraer user context del evento', async () => {
      let capturedEvent;
      const handlerFn = async (event) => {
        capturedEvent = event;
        return { test: true };
      };

      const handler = createAPIHandler(handlerFn);
      await handler(mockEvent, mockContext);

      expect(capturedEvent.userContext).toBeDefined();
      expect(capturedEvent.userContext.sub).toBe('user-sub-789');
      expect(capturedEvent.userContext.email).toBe('test@example.com');
      expect(capturedEvent.userContext.sourceIp).toBe('127.0.0.1');
    });
  });

  describe('Performance Tracking', () => {
    test('debe medir tiempo de ejecución', async () => {
      const handlerFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { data: 'test' };
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const handler = createAPIHandler(handlerFn);
      await handler(mockEvent, mockContext);

      // Verificar que se logueó el tiempo de ejecución
      const perfLogs = consoleSpy.mock.calls.filter(call => 
        call[0].includes('duration')
      );
      expect(perfLogs.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    }, 10000);
  });

  describe('Response Formatting', () => {
    test('debe formatear respuesta con timestamp', async () => {
      const handlerFn = async () => ({ id: '123' });

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      const body = JSON.parse(response.body);
      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });

    test('debe soportar metadata en respuesta', async () => {
      const handlerFn = async () => ({
        data: [{ id: 1 }, { id: 2 }],
        meta: { count: 2, page: 1 }
      });

      const handler = createAPIHandler(handlerFn);
      const response = await handler(mockEvent, mockContext);

      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.meta.count).toBe(2);
    });
  });
});
