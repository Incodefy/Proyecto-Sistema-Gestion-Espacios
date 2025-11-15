/**
 * Tests unitarios para el módulo de Login
 */

const { login } = require('../../src/handlers/login/login');

// Mock del cliente de Cognito
jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const mockSend = jest.fn();
  return {
    CognitoIdentityProviderClient: jest.fn(() => ({
      send: mockSend
    })),
    InitiateAuthCommand: jest.fn((params) => params),
    __mockSend: mockSend
  };
});

const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

describe('Login Handler', () => {
  let mockSend;

  beforeEach(() => {
    // Obtener referencia al mock
    const clientInstance = new CognitoIdentityProviderClient();
    mockSend = clientInstance.send;
    mockSend.mockClear();
  });

  describe('Validación de entrada', () => {
    test('debe retornar 400 si falta username', async () => {
      const event = {
        body: JSON.stringify({ password: 'Test123!' })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('username y password son obligatorios');
    });

    test('debe retornar 400 si falta password', async () => {
      const event = {
        body: JSON.stringify({ username: 'test@example.com' })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('username y password son obligatorios');
    });

    test('debe retornar 400 si el body está vacío', async () => {
      const event = { body: '{}' };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
    });

    test('debe manejar body sin definir', async () => {
      const event = {};

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
    });
  });

  describe('Autenticación exitosa', () => {
    test('debe retornar tokens cuando las credenciales son válidas', async () => {
      const mockAuthResult = {
        AuthenticationResult: {
          IdToken: 'mock-id-token',
          AccessToken: 'mock-access-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600
        }
      };

      mockSend.mockResolvedValueOnce(mockAuthResult);

      const event = {
        body: JSON.stringify({
          username: 'test@example.com',
          password: 'ValidPassword123!'
        })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.idToken).toBe('mock-id-token');
      expect(body.accessToken).toBe('mock-access-token');
      expect(body.refreshToken).toBe('mock-refresh-token');
      expect(body.expiresIn).toBe(3600);
    });

    test('debe llamar a Cognito con los parámetros correctos', async () => {
      const mockAuthResult = {
        AuthenticationResult: {
          IdToken: 'token',
          AccessToken: 'token',
          RefreshToken: 'token',
          ExpiresIn: 3600
        }
      };

      mockSend.mockResolvedValueOnce(mockAuthResult);

      const event = {
        body: JSON.stringify({
          username: 'user@test.com',
          password: 'Pass123!'
        })
      };

      await login(event);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: process.env.USER_POOL_CLIENT_ID,
          AuthParameters: {
            USERNAME: 'user@test.com',
            PASSWORD: 'Pass123!'
          }
        })
      );
    });
  });

  describe('Manejo de errores', () => {
    test('debe retornar 401 cuando las credenciales son inválidas', async () => {
      mockSend.mockRejectedValueOnce(new Error('NotAuthorizedException'));

      const event = {
        body: JSON.stringify({
          username: 'test@example.com',
          password: 'WrongPassword'
        })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('Credenciales inválidas');
    });

    test('debe manejar desafíos de Cognito', async () => {
      const mockChallengeResponse = {
        ChallengeName: 'NEW_PASSWORD_REQUIRED'
      };

      mockSend.mockResolvedValueOnce(mockChallengeResponse);

      const event = {
        body: JSON.stringify({
          username: 'test@example.com',
          password: 'TempPassword123!'
        })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(403);
      expect(body.ok).toBe(false);
      expect(body.challenge).toBe('NEW_PASSWORD_REQUIRED');
    });

    test('debe manejar errores de red', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      const event = {
        body: JSON.stringify({
          username: 'test@example.com',
          password: 'Password123!'
        })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.ok).toBe(false);
    });
  });

  describe('Casos edge', () => {
    test('debe manejar respuesta de Cognito sin AuthenticationResult', async () => {
      mockSend.mockResolvedValueOnce({});

      const event = {
        body: JSON.stringify({
          username: 'test@example.com',
          password: 'Password123!'
        })
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.idToken).toBeUndefined();
    });

    test('debe manejar JSON malformado', async () => {
      const event = {
        body: 'invalid-json'
      };

      const result = await login(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.ok).toBe(false);
    });
  });
});
