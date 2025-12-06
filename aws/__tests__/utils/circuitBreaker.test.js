/**
 * Tests para Circuit Breaker
 */

const {
  sendEmailWithCircuitBreaker,
  cognitoWithCircuitBreaker
} = require('../../src/utils/circuitBreaker');

// Mock AWS SDK
jest.mock('@aws-sdk/client-ses');
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('Circuit Breaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmailWithCircuitBreaker', () => {
    test('debe enviar email exitosamente', async () => {
      const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
      
      SESClient.prototype.send = jest.fn().mockResolvedValue({
        MessageId: 'test-message-id'
      });

      const result = await sendEmailWithCircuitBreaker(
        'from@example.com',
        ['to@example.com'],
        'Test Subject',
        'Test Body'
      );

      expect(result.MessageId).toBe('test-message-id');
    });

    test('debe reintentar en caso de error', async () => {
      const { SESClient } = require('@aws-sdk/client-ses');
      
      let attempts = 0;
      SESClient.prototype.send = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({ MessageId: 'success-after-retry' });
      });

      const result = await sendEmailWithCircuitBreaker(
        'from@example.com',
        ['to@example.com'],
        'Test',
        'Body'
      );

      expect(result.MessageId).toBe('success-after-retry');
      expect(attempts).toBe(3);
    });

    test('debe abrir circuito después de múltiples fallos', async () => {
      const { SESClient } = require('@aws-sdk/client-ses');
      const { CircuitBreakerOpenError } = require('../../src/utils/errorHandler');
      
      SESClient.prototype.send = jest.fn().mockRejectedValue(
        new Error('Service unavailable')
      );

      // Generar múltiples fallos consecutivos
      for (let i = 0; i < 3; i++) {
        try {
          await sendEmailWithCircuitBreaker('from@test.com', ['to@test.com'], 'Test', 'Body');
        } catch (error) {
          // Ignorar errores esperados
        }
      }

      // El siguiente intento debería fallar inmediatamente
      await expect(
        sendEmailWithCircuitBreaker('from@test.com', ['to@test.com'], 'Test', 'Body')
      ).rejects.toThrow(CircuitBreakerOpenError);
    });
  });

  describe('cognitoWithCircuitBreaker', () => {
    test('debe ejecutar comando de Cognito exitosamente', async () => {
      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      
      CognitoIdentityProviderClient.prototype.send = jest.fn().mockResolvedValue({
        Users: [{ Username: 'test-user' }]
      });

      const mockCommand = { name: 'ListUsersCommand' };
      const result = await cognitoWithCircuitBreaker(mockCommand);

      expect(result.Users).toHaveLength(1);
    });

    test('debe manejar errores de Cognito', async () => {
      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      
      CognitoIdentityProviderClient.prototype.send = jest.fn().mockRejectedValue(
        new Error('UserNotFoundException')
      );

      const mockCommand = { name: 'AdminGetUserCommand' };
      
      await expect(cognitoWithCircuitBreaker(mockCommand)).rejects.toThrow();
    });
  });

  describe('Circuit Breaker State Management', () => {
    test('debe recuperarse después del cooldown period', async () => {
      jest.useFakeTimers();
      
      const { SESClient } = require('@aws-sdk/client-ses');
      const { CircuitBreakerOpenError } = require('../../src/utils/errorHandler');
      
      // Simular fallos para abrir el circuito
      SESClient.prototype.send = jest.fn().mockRejectedValue(
        new Error('Service error')
      );

      for (let i = 0; i < 3; i++) {
        try {
          await sendEmailWithCircuitBreaker('from@test.com', ['to@test.com'], 'Test', 'Body');
        } catch (error) {}
      }

      // Verificar que el circuito está abierto
      await expect(
        sendEmailWithCircuitBreaker('from@test.com', ['to@test.com'], 'Test', 'Body')
      ).rejects.toThrow(CircuitBreakerOpenError);

      // Avanzar tiempo más allá del cooldown period (20 segundos)
      jest.advanceTimersByTime(25000);

      // Ahora el servicio responde correctamente
      SESClient.prototype.send = jest.fn().mockResolvedValue({
        MessageId: 'recovered'
      });

      // El circuito debería intentar de nuevo
      const result = await sendEmailWithCircuitBreaker(
        'from@test.com',
        ['to@test.com'],
        'Test',
        'Body'
      );

      expect(result.MessageId).toBe('recovered');

      jest.useRealTimers();
    });
  });
});
