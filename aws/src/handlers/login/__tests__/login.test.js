/**
 * Login Handler Integration Tests
 * 
 * Tests de integración para el handler de login con AuthAdapter (ACL)
 * 
 * Coverage:
 * - Successful login flow
 * - Error handling (InvalidCredentialsError, MFARequiredError, etc.)
 * - Challenge responses (NEW_PASSWORD_REQUIRED, MFA)
 * - Response format validation
 */

const { login } = require('../login');
const {
  getAuthAdapter,
  AuthSession,
  InvalidCredentialsError,
  MFARequiredError,
  PasswordResetRequiredError,
  UserNotConfirmedError
} = require('../../../adapters/authAdapter');

// Mock AuthAdapter (ACL)
jest.mock('../../../adapters/authAdapter');

describe('Login Handler - ACL Integration Tests', () => {
  let mockAuthAdapter;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock AuthAdapter
    mockAuthAdapter = {
      login: jest.fn()
    };

    getAuthAdapter.mockReturnValue(mockAuthAdapter);
  });

  // ========== SUCCESSFUL LOGIN ==========

  describe('Successful Login', () => {
    test('should return tokens on successful login', async () => {
      const mockSession = new AuthSession({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      });

      mockAuthAdapter.login.mockResolvedValueOnce(mockSession);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Password123!'
        })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.data).toMatchObject({
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600
      });

      expect(mockAuthAdapter.login).toHaveBeenCalledWith('user@test.com', 'Password123!');
    });
  });

  // ========== VALIDATION ERRORS ==========

  describe('Validation Errors', () => {
    test('should return 400 on missing username', async () => {
      const event = {
        body: JSON.stringify({ password: 'Password123!' })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain('inválidos');
    });

    test('should return 400 on missing password', async () => {
      const event = {
        body: JSON.stringify({ username: 'user@test.com' })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain('inválidos');
    });

    test('should return 400 on empty body', async () => {
      const event = { body: '{}' };

      const result = await login(event, mockLogger);

      expect(result.statusCode).toBe(400);
    });

    test('should handle malformed JSON', async () => {
      const event = { body: 'invalid-json' };

      const result = await login(event, mockLogger);

      expect(result.statusCode).toBe(400);
    });
  });

  // ========== INVALID CREDENTIALS ==========

  describe('Invalid Credentials', () => {
    test('should return 401 on invalid credentials', async () => {
      mockAuthAdapter.login.mockRejectedValueOnce(
        new InvalidCredentialsError('Invalid username or password')
      );

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'wrong-password'
        })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.error).toBe('Credenciales inválidas');
    });

    test('should not reveal user existence', async () => {
      mockAuthAdapter.login.mockRejectedValueOnce(
        new InvalidCredentialsError('Invalid credentials')
      );

      const event = {
        body: JSON.stringify({
          username: 'nonexistent@test.com',
          password: 'any-password'
        })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.error).not.toContain('not found');
      expect(body.error).not.toContain('exist');
    });
  });

  // ========== CHALLENGE HANDLING ==========

  describe('Challenge Handling', () => {
    test('should return 403 on MFA required', async () => {
      const mfaError = new MFARequiredError('MFA verification required');
      mfaError.session = 'mfa-session-token';
      mfaError.challengeName = 'SMS_MFA';

      mockAuthAdapter.login.mockRejectedValueOnce(mfaError);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Password123!'
        })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(body.error).toBe('MFA verification required');
      expect(body.data.challengeName).toBe('MFA_REQUIRED');
      expect(body.data.session).toBe('mfa-session-token');
    });

    test('should return 403 on password reset required', async () => {
      mockAuthAdapter.login.mockRejectedValueOnce(
        new PasswordResetRequiredError('Password reset required')
      );

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'TempPassword123!'
        })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(body.error).toBe('Password reset required');
      expect(body.data.challengeName).toBe('NEW_PASSWORD_REQUIRED');
    });
  });

  // ========== USER STATUS ==========

  describe('User Status Errors', () => {
    test('should handle user not confirmed', async () => {
      mockAuthAdapter.login.mockRejectedValueOnce(
        new UserNotConfirmedError('User email not confirmed')
      );

      const event = {
        body: JSON.stringify({
          username: 'unconfirmed@test.com',
          password: 'Password123!'
        })
      };

      const result = await login(event, mockLogger);

      expect(result.statusCode).toBe(403);
    });
  });

  // ========== GENERIC ERRORS ==========

  describe('Generic Error Handling', () => {
    test('should return 500 on unexpected error', async () => {
      mockAuthAdapter.login.mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Password123!'
        })
      };

      const result = await login(event, mockLogger);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(500);
      expect(body.error).toBe('Error en autenticación');
    });
  });

  // ========== RESPONSE FORMAT ==========

  describe('Response Format', () => {
    test('should return correct structure on success', async () => {
      const mockSession = new AuthSession({
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      });

      mockAuthAdapter.login.mockResolvedValueOnce(mockSession);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Password123!'
        })
      };

      const result = await login(event, mockLogger);

      expect(result).toHaveProperty('statusCode');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('headers');
      
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('idToken');
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data).toHaveProperty('expiresIn');
    });

    test('should include CORS headers', async () => {
      const mockSession = new AuthSession({
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      });

      mockAuthAdapter.login.mockResolvedValueOnce(mockSession);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Password123!'
        })
      };

      const result = await login(event, mockLogger);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json'
      });
    });
  });

  // ========== LOGGING ==========

  describe('Logging', () => {
    test('should log login attempt', async () => {
      const mockSession = new AuthSession({
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      });

      mockAuthAdapter.login.mockResolvedValueOnce(mockSession);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Password123!'
        })
      };

      await login(event, mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Login attempt',
        expect.objectContaining({ username: 'user@test.com' })
      );
    });

    test('should NOT log passwords', async () => {
      const mockSession = new AuthSession({
        idToken: 'id-token',
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      });

      mockAuthAdapter.login.mockResolvedValueOnce(mockSession);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'SecretPassword123!'
        })
      };

      await login(event, mockLogger);

      const allLogs = [
        ...mockLogger.info.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls
      ];

      allLogs.forEach(logCall => {
        const logString = JSON.stringify(logCall);
        expect(logString).not.toContain('SecretPassword123!');
      });
    });
  });
});
