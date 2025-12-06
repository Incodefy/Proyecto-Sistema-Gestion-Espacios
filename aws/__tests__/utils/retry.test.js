/**
 * Tests para Retry Logic
 */

const {
  retryDB,
  retryCognito,
  retryWithJitter
} = require('../../src/utils/retry');

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryDB', () => {
    test('debe ejecutar operación exitosa sin retry', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Item: { PK: 'GROUP#1', data: 'test' }
      });

      const mockCommand = { name: 'GetCommand' };
      const result = await retryDB(mockCommand);

      expect(result.Item).toBeDefined();
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledTimes(1);
    });

    test('debe reintentar en caso de ProvisionedThroughputExceededException', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      let attempts = 0;
      DynamoDBDocumentClient.prototype.send = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('ProvisionedThroughputExceededException');
          error.name = 'ProvisionedThroughputExceededException';
          return Promise.reject(error);
        }
        return Promise.resolve({ Item: { data: 'success' } });
      });

      const mockCommand = { name: 'GetCommand' };
      const result = await retryDB(mockCommand);

      expect(result.Item.data).toBe('success');
      expect(attempts).toBe(3);
    });

    test('debe fallar después de max retries', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockRejectedValue(
        new Error('PermanentError')
      );

      const mockCommand = { name: 'GetCommand' };

      await expect(retryDB(mockCommand, 3)).rejects.toThrow('PermanentError');
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryCognito', () => {
    test('debe ejecutar comando de Cognito con retry', async () => {
      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      
      CognitoIdentityProviderClient.prototype.send = jest.fn().mockResolvedValue({
        Users: [{ Username: 'test-user' }]
      });

      const mockCommand = { name: 'ListUsersCommand' };
      const result = await retryCognito(mockCommand);

      expect(result.Users).toHaveLength(1);
    });

    test('debe reintentar errores transitorios de Cognito', async () => {
      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      
      let attempts = 0;
      CognitoIdentityProviderClient.prototype.send = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('TooManyRequestsException');
          error.name = 'TooManyRequestsException';
          return Promise.reject(error);
        }
        return Promise.resolve({ AuthenticationResult: { AccessToken: 'token' } });
      });

      const mockCommand = { name: 'InitiateAuthCommand' };
      const result = await retryCognito(mockCommand);

      expect(result.AuthenticationResult.AccessToken).toBe('token');
      expect(attempts).toBe(2);
    });
  });

  describe('retryWithJitter', () => {
    test('debe ejecutar función con exponential backoff y jitter', async () => {
      jest.useFakeTimers();

      let attempts = 0;
      const testFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const promise = retryWithJitter(testFn, 3, 100);

      // Avanzar timers
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(attempts).toBe(3);

      jest.useRealTimers();
    });

    test('debe aplicar jitter para evitar thundering herd', async () => {
      jest.useFakeTimers();

      const delays = [];
      const originalSetTimeout = global.setTimeout;
      
      jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      });

      let attempts = 0;
      const testFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Retry');
        }
        return 'done';
      };

      await retryWithJitter(testFn, 3, 100);
      await jest.runAllTimersAsync();

      // Verificar que los delays tienen jitter (no son exactamente 100, 200, 400)
      expect(delays[0]).toBeGreaterThanOrEqual(50);
      expect(delays[0]).toBeLessThanOrEqual(150);

      global.setTimeout.mockRestore();
      jest.useRealTimers();
    });

    test('debe fallar si max retries es excedido', async () => {
      const testFn = async () => {
        throw new Error('Always fails');
      };

      await expect(retryWithJitter(testFn, 3, 50)).rejects.toThrow('Always fails');
    });

    test('debe respetar isRetryable function', async () => {
      let attempts = 0;
      const testFn = async () => {
        attempts++;
        const error = new Error('Non-retryable error');
        error.code = 'FATAL_ERROR';
        throw error;
      };

      const isRetryable = (error) => error.code !== 'FATAL_ERROR';

      await expect(
        retryWithJitter(testFn, 3, 50, isRetryable)
      ).rejects.toThrow('Non-retryable error');

      // Solo 1 intento porque el error no es retriable
      expect(attempts).toBe(1);
    });
  });

  describe('Exponential Backoff', () => {
    test('debe aumentar delay exponencialmente', async () => {
      jest.useFakeTimers();

      const delays = [];
      jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
        delays.push(delay);
        return setTimeout(fn, 0);
      });

      let attempts = 0;
      const testFn = async () => {
        attempts++;
        if (attempts < 4) {
          throw new Error('Retry');
        }
        return 'done';
      };

      await retryWithJitter(testFn, 4, 100);
      await jest.runAllTimersAsync();

      // Verificar progresión exponencial aproximada (con jitter)
      // Base delays serían: 100, 200, 400
      expect(delays.length).toBe(3); // 3 retries = 3 delays
      expect(delays[1]).toBeGreaterThan(delays[0]); // Segundo > Primero
      expect(delays[2]).toBeGreaterThan(delays[1]); // Tercero > Segundo

      global.setTimeout.mockRestore();
      jest.useRealTimers();
    });
  });
});
