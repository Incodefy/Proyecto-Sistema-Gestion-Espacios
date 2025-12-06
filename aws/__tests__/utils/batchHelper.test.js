/**
 * Tests para Batch Helper
 */

const {
  quickBatchPut,
  quickBatchGet,
  quickBatchDelete
} = require('../../src/utils/batchHelper');

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('Batch Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('quickBatchPut', () => {
    test('debe realizar batch write con chunking automático', async () => {
      const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        UnprocessedItems: {}
      });

      const items = Array.from({ length: 30 }, (_, i) => ({
        PK: `GROUP#test`,
        SK: `ITEM#${i}`,
        data: `item-${i}`
      }));

      await quickBatchPut('test-table', items);

      // Debería hacer 2 llamadas (25 items max por batch)
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledTimes(2);
    });

    test('debe reintentar items no procesados', async () => {
      const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
      
      let callCount = 0;
      DynamoDBDocumentClient.prototype.send = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Primera llamada: algunos items no procesados
          return Promise.resolve({
            UnprocessedItems: {
              'test-table': [
                { PutRequest: { Item: { PK: 'GROUP#1', SK: 'ITEM#1' } } }
              ]
            }
          });
        }
        // Segunda llamada: todo procesado
        return Promise.resolve({ UnprocessedItems: {} });
      });

      const items = [
        { PK: 'GROUP#1', SK: 'ITEM#1', data: 'test1' },
        { PK: 'GROUP#1', SK: 'ITEM#2', data: 'test2' }
      ];

      await quickBatchPut('test-table', items);

      expect(callCount).toBe(2);
    });

    test('debe manejar arrays vacíos', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      DynamoDBDocumentClient.prototype.send = jest.fn();

      await quickBatchPut('test-table', []);

      expect(DynamoDBDocumentClient.prototype.send).not.toHaveBeenCalled();
    });
  });

  describe('quickBatchGet', () => {
    test('debe realizar batch get con chunking', async () => {
      const { DynamoDBDocumentClient, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Responses: {
          'test-table': [
            { PK: 'GROUP#1', SK: 'ITEM#1', data: 'test1' },
            { PK: 'GROUP#1', SK: 'ITEM#2', data: 'test2' }
          ]
        },
        UnprocessedKeys: {}
      });

      const keys = [
        { PK: 'GROUP#1', SK: 'ITEM#1' },
        { PK: 'GROUP#1', SK: 'ITEM#2' }
      ];

      const results = await quickBatchGet('test-table', keys);

      expect(results).toHaveLength(2);
      expect(results[0].data).toBe('test1');
    });

    test('debe manejar más de 100 items (límite de BatchGet)', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        Responses: { 'test-table': [] },
        UnprocessedKeys: {}
      });

      const keys = Array.from({ length: 150 }, (_, i) => ({
        PK: 'GROUP#1',
        SK: `ITEM#${i}`
      }));

      await quickBatchGet('test-table', keys);

      // Debería hacer 2 llamadas (100 items max por batch)
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('quickBatchDelete', () => {
    test('debe eliminar items en batch', async () => {
      const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        UnprocessedItems: {}
      });

      const keys = [
        { PK: 'GROUP#1', SK: 'ITEM#1' },
        { PK: 'GROUP#1', SK: 'ITEM#2' }
      ];

      await quickBatchDelete('test-table', keys);

      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledTimes(1);
      
      const call = DynamoDBDocumentClient.prototype.send.mock.calls[0][0];
      expect(call.input.RequestItems['test-table'][0]).toHaveProperty('DeleteRequest');
    });

    test('debe chunking para más de 25 deletes', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockResolvedValue({
        UnprocessedItems: {}
      });

      const keys = Array.from({ length: 30 }, (_, i) => ({
        PK: 'GROUP#1',
        SK: `ITEM#${i}`
      }));

      await quickBatchDelete('test-table', keys);

      // 2 batches para 30 items
      expect(DynamoDBDocumentClient.prototype.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('debe propagar errores de DynamoDB', async () => {
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      DynamoDBDocumentClient.prototype.send = jest.fn().mockRejectedValue(
        new Error('ProvisionedThroughputExceededException')
      );

      const items = [{ PK: 'GROUP#1', SK: 'ITEM#1' }];

      await expect(quickBatchPut('test-table', items)).rejects.toThrow();
    });

    test('debe reintentar con exponential backoff', async () => {
      jest.useFakeTimers();
      const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
      
      let attempts = 0;
      DynamoDBDocumentClient.prototype.send = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({ UnprocessedItems: {} });
      });

      const items = [{ PK: 'GROUP#1', SK: 'ITEM#1' }];
      const promise = quickBatchPut('test-table', items);

      // Avanzar los timers para los retries
      await jest.runAllTimersAsync();
      await promise;

      expect(attempts).toBe(3);
      
      jest.useRealTimers();
    });
  });
});
