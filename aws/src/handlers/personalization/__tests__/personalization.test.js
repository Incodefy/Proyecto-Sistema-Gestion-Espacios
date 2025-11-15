/**
 * Tests unitarios para el módulo de Personalización
 */

const { getPersonalization, setPersonalization } = require('../../src/handlers/personalization/personalization');

// Mock de DynamoDB
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sns');

const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { SNSClient } = require('@aws-sdk/client-sns');

describe('Personalization Handler', () => {
  let mockSend;

  beforeEach(() => {
    mockSend = jest.fn();
    DynamoDBDocumentClient.from = jest.fn(() => ({ send: mockSend }));
    SNSClient.mockImplementation(() => ({ send: mockSend }));
    
    process.env.PARAMETERS_TABLE = 'test-parameters-table';
    process.env.PERSONALIZATION_TOPIC_ARN = 'arn:aws:sns:test';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPersonalization', () => {
    test('debe retornar 401 si no hay usuario autenticado', async () => {
      const event = {
        requestContext: {}
      };

      const result = await getPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('no autenticado');
    });

    test('debe retornar parámetros globales si el usuario no tiene personalizaciones', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        }
      };

      const result = await getPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.parameters).toBeDefined();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: 'test-parameters-table'
        })
      );
    });

    test('debe combinar parámetros globales con personalizaciones del usuario', async () => {
      const mockUserParameters = [
        { parameter_key: 'theme.primaryColor', parameter_value: '#FF0000' },
        { parameter_key: 'locale.language', parameter_value: 'es' }
      ];

      mockSend.mockResolvedValueOnce({ Items: mockUserParameters });

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        }
      };

      const result = await getPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.parameters['theme.primaryColor']).toBe('#FF0000');
      expect(body.parameters['locale.language']).toBe('es');
    });

    test('debe manejar errores de DynamoDB', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        }
      };

      const result = await getPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(500);
      expect(body.ok).toBe(false);
    });
  });

  describe('setPersonalization', () => {
    test('debe retornar 401 si no hay usuario autenticado', async () => {
      const event = {
        requestContext: {},
        body: JSON.stringify({ parameters: {} })
      };

      const result = await setPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(401);
      expect(body.ok).toBe(false);
    });

    test('debe retornar 400 si no se proporcionan parámetros', async () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        },
        body: '{}'
      };

      const result = await setPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
    });

    test('debe guardar parámetros válidos en DynamoDB', async () => {
      mockSend.mockResolvedValue({});

      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        },
        body: JSON.stringify({
          parameters: {
            'theme.primaryColor': '#0000FF',
            'locale.language': 'en'
          }
        })
      };

      const result = await setPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    test('debe rechazar parámetros inválidos', async () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        },
        body: JSON.stringify({
          parameters: {
            'invalid.parameter': 'value'
          }
        })
      };

      const result = await setPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error).toContain('inválido');
    });

    test('debe validar tipos de datos de parámetros', async () => {
      const event = {
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                email: 'test@example.com'
              }
            }
          }
        },
        body: JSON.stringify({
          parameters: {
            'theme.primaryColor': 12345 // Debería ser string
          }
        })
      };

      const result = await setPersonalization(event);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.ok).toBe(false);
    });
  });
});
