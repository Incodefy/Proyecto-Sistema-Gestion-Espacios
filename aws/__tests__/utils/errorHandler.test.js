/**
 * Tests para Error Handler
 */

const {
  ValidationError,
  NotFoundError,
  AuthorizationError,
  DuplicateError,
  RateLimitError,
  CircuitBreakerOpenError,
  handleError,
  successResponse
} = require('../../src/utils/errorHandler');

describe('Error Handler', () => {
  describe('Custom Error Classes', () => {
    test('ValidationError debe tener código correcto', () => {
      const error = new ValidationError('Invalid input', { field: 'name' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details.field).toBe('name');
    });

    test('NotFoundError debe tener código 404', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    test('AuthorizationError debe tener código 403', () => {
      const error = new AuthorizationError('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    test('DuplicateError debe tener código 409', () => {
      const error = new DuplicateError('Already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('DUPLICATE_ERROR');
    });

    test('RateLimitError debe incluir retryAfter', () => {
      const error = new RateLimitError('Too many requests', 60);
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });

    test('CircuitBreakerOpenError debe tener código 503', () => {
      const error = new CircuitBreakerOpenError('Service unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
    });
  });

  describe('handleError()', () => {
    test('debe retornar response formateada para ValidationError', () => {
      const error = new ValidationError('Invalid data');
      const response = handleError(error);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('debe incluir details si existen', () => {
      const error = new ValidationError('Invalid', { field: 'email' });
      const response = handleError(error);
      
      const body = JSON.parse(response.body);
      expect(body.error.details.field).toBe('email');
    });

    test('debe manejar errores genéricos', () => {
      const error = new Error('Generic error');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    test('debe incluir Retry-After header para RateLimitError', () => {
      const error = new RateLimitError('Too many requests', 120);
      const response = handleError(error);

      expect(response.headers['Retry-After']).toBe(120);
    });
  });

  describe('successResponse()', () => {
    test('debe crear response exitosa con data', () => {
      const data = { id: '123', name: 'Test' };
      const response = successResponse(data);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
      expect(body.timestamp).toBeDefined();
    });

    test('debe soportar statusCode personalizado', () => {
      const response = successResponse({ id: '123' }, 201);
      expect(response.statusCode).toBe(201);
    });

    test('debe incluir metadata si se proporciona', () => {
      const meta = { count: 10, page: 1 };
      const response = successResponse({ items: [] }, 200, meta);

      const body = JSON.parse(response.body);
      expect(body.meta).toEqual(meta);
    });

    test('debe incluir security headers', () => {
      const response = successResponse({ test: true });
      
      expect(response.headers['Content-Security-Policy']).toBeDefined();
      expect(response.headers['X-Content-Type-Options']).toBe('nosniff');
    });
  });
});
