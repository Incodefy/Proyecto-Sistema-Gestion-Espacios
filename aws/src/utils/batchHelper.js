/**
 * DynamoDB Batch Operations Helper
 * 
 * Optimiza operaciones de lectura/escritura con:
 * - batchGetItem para múltiples lecturas
 * - batchWriteItem para múltiples escrituras
 * - Chunking automático (máx 25 items por batch)
 * - Retry de unprocessed items
 * - Métricas de performance
 */

const { 
  DynamoDBDocumentClient, 
  BatchGetCommand,
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { Logger } = require('./logger');

const BATCH_SIZE = 25; // Límite de AWS
const MAX_RETRIES = 3;

class DynamoDBBatchHelper {
  constructor(client = null, logger = null) {
    this.client = client || DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.logger = logger || new Logger({ component: 'DynamoDBBatchHelper' });
  }

  /**
   * Batch get items de múltiples tablas
   * 
   * @param {Array} requests - Array de { tableName, keys: [{ pk, sk }] }
   * @returns {Promise<Object>} { responses: {}, unprocessedKeys: {} }
   */
  async batchGet(requests) {
    const startTime = Date.now();
    const allResponses = {};
    let allUnprocessed = {};

    // Convertir requests al formato DynamoDB
    const requestItems = {};
    for (const req of requests) {
      if (!requestItems[req.tableName]) {
        requestItems[req.tableName] = { Keys: [] };
      }
      requestItems[req.tableName].Keys.push(...req.keys);
    }

    // Dividir en chunks de 25
    const chunks = this.chunkBatchGetRequests(requestItems);

    this.logger.debug('Batch get operation', {
      totalItems: this.countKeys(requestItems),
      chunks: chunks.length
    });

    for (const chunk of chunks) {
      const result = await this.executeBatchGetWithRetry(chunk);
      
      // Merge responses
      for (const [table, items] of Object.entries(result.Responses || {})) {
        if (!allResponses[table]) {
          allResponses[table] = [];
        }
        allResponses[table].push(...items);
      }

      // Merge unprocessed
      if (result.UnprocessedKeys && Object.keys(result.UnprocessedKeys).length > 0) {
        allUnprocessed = { ...allUnprocessed, ...result.UnprocessedKeys };
      }
    }

    const duration = Date.now() - startTime;
    this.logger.metric('batch_get_duration', duration, 'Milliseconds');
    this.logger.info('Batch get completed', {
      duration,
      itemsRetrieved: Object.values(allResponses).flat().length,
      unprocessedCount: this.countKeys(allUnprocessed)
    });

    return {
      responses: allResponses,
      unprocessedKeys: allUnprocessed
    };
  }

  /**
   * Batch write items (put/delete)
   * 
   * @param {Array} requests - Array de { tableName, putItems?, deleteKeys? }
   * @returns {Promise<Object>} { processed: number, unprocessed: [] }
   */
  async batchWrite(requests) {
    const startTime = Date.now();
    let totalProcessed = 0;
    let allUnprocessed = [];

    // Convertir requests al formato DynamoDB
    const requestItems = {};
    for (const req of requests) {
      if (!requestItems[req.tableName]) {
        requestItems[req.tableName] = [];
      }

      // Put requests
      if (req.putItems) {
        for (const item of req.putItems) {
          requestItems[req.tableName].push({
            PutRequest: { Item: item }
          });
        }
      }

      // Delete requests
      if (req.deleteKeys) {
        for (const key of req.deleteKeys) {
          requestItems[req.tableName].push({
            DeleteRequest: { Key: key }
          });
        }
      }
    }

    // Dividir en chunks de 25
    const chunks = this.chunkBatchWriteRequests(requestItems);

    this.logger.debug('Batch write operation', {
      totalItems: this.countWriteRequests(requestItems),
      chunks: chunks.length
    });

    for (const chunk of chunks) {
      const result = await this.executeBatchWriteWithRetry(chunk);
      
      const chunkSize = this.countWriteRequests(chunk);
      const unprocessedCount = this.countWriteRequests(result.UnprocessedItems || {});
      totalProcessed += (chunkSize - unprocessedCount);

      if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
        allUnprocessed.push(result.UnprocessedItems);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.metric('batch_write_duration', duration, 'Milliseconds');
    this.logger.info('Batch write completed', {
      duration,
      processed: totalProcessed,
      unprocessed: allUnprocessed.length
    });

    return {
      processed: totalProcessed,
      unprocessedItems: allUnprocessed
    };
  }

  /**
   * Ejecuta batch get con retry de unprocessed keys
   */
  async executeBatchGetWithRetry(requestItems, attempt = 1) {
    try {
      const command = new BatchGetCommand({ RequestItems: requestItems });
      const result = await this.client.send(command);

      // Si hay unprocessed y no hemos excedido retries, reintentar
      if (result.UnprocessedKeys && Object.keys(result.UnprocessedKeys).length > 0 && attempt < MAX_RETRIES) {
        this.logger.warn('Retrying unprocessed keys', {
          attempt,
          unprocessedCount: this.countKeys(result.UnprocessedKeys)
        });

        // Exponential backoff
        await this.sleep(100 * Math.pow(2, attempt));
        
        const retryResult = await this.executeBatchGetWithRetry(result.UnprocessedKeys, attempt + 1);
        
        // Merge results
        for (const [table, items] of Object.entries(retryResult.Responses || {})) {
          if (!result.Responses[table]) {
            result.Responses[table] = [];
          }
          result.Responses[table].push(...items);
        }
        
        result.UnprocessedKeys = retryResult.UnprocessedKeys;
      }

      return result;
    } catch (error) {
      this.logger.error('Batch get error', error, { attempt });
      throw error;
    }
  }

  /**
   * Ejecuta batch write con retry de unprocessed items
   */
  async executeBatchWriteWithRetry(requestItems, attempt = 1) {
    try {
      const command = new BatchWriteCommand({ RequestItems: requestItems });
      const result = await this.client.send(command);

      // Si hay unprocessed y no hemos excedido retries, reintentar
      if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0 && attempt < MAX_RETRIES) {
        this.logger.warn('Retrying unprocessed items', {
          attempt,
          unprocessedCount: this.countWriteRequests(result.UnprocessedItems)
        });

        // Exponential backoff
        await this.sleep(100 * Math.pow(2, attempt));
        
        const retryResult = await this.executeBatchWriteWithRetry(result.UnprocessedItems, attempt + 1);
        result.UnprocessedItems = retryResult.UnprocessedItems;
      }

      return result;
    } catch (error) {
      this.logger.error('Batch write error', error, { attempt });
      throw error;
    }
  }

  /**
   * Divide request items en chunks de BATCH_SIZE
   */
  chunkBatchGetRequests(requestItems) {
    const chunks = [];
    let currentChunk = {};
    let currentCount = 0;

    for (const [tableName, { Keys }] of Object.entries(requestItems)) {
      for (const key of Keys) {
        if (!currentChunk[tableName]) {
          currentChunk[tableName] = { Keys: [] };
        }
        
        currentChunk[tableName].Keys.push(key);
        currentCount++;

        if (currentCount >= BATCH_SIZE) {
          chunks.push(currentChunk);
          currentChunk = {};
          currentCount = 0;
        }
      }
    }

    if (currentCount > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Divide write requests en chunks de BATCH_SIZE
   */
  chunkBatchWriteRequests(requestItems) {
    const chunks = [];
    let currentChunk = {};
    let currentCount = 0;

    for (const [tableName, requests] of Object.entries(requestItems)) {
      for (const request of requests) {
        if (!currentChunk[tableName]) {
          currentChunk[tableName] = [];
        }
        
        currentChunk[tableName].push(request);
        currentCount++;

        if (currentCount >= BATCH_SIZE) {
          chunks.push(currentChunk);
          currentChunk = {};
          currentCount = 0;
        }
      }
    }

    if (currentCount > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Cuenta número de keys en request
   */
  countKeys(requestItems) {
    let count = 0;
    for (const table of Object.values(requestItems || {})) {
      count += (table.Keys?.length || 0);
    }
    return count;
  }

  /**
   * Cuenta número de write requests
   */
  countWriteRequests(requestItems) {
    let count = 0;
    for (const requests of Object.values(requestItems || {})) {
      count += (Array.isArray(requests) ? requests.length : 0);
    }
    return count;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Get múltiples items de una tabla
   */
  async batchGetFromTable(tableName, keys) {
    const result = await this.batchGet([{ tableName, keys }]);
    return result.responses[tableName] || [];
  }

  /**
   * Helper: Put múltiples items en una tabla
   */
  async batchPutToTable(tableName, items) {
    return await this.batchWrite([{ tableName, putItems: items }]);
  }

  /**
   * Helper: Delete múltiples items de una tabla
   */
  async batchDeleteFromTable(tableName, keys) {
    return await this.batchWrite([{ tableName, deleteKeys: keys }]);
  }
}

/**
 * Funciones de conveniencia
 */

/**
 * Crea instancia del helper
 */
function createBatchHelper(client = null, logger = null) {
  return new DynamoDBBatchHelper(client, logger);
}

/**
 * Quick batch get
 */
async function quickBatchGet(tableName, keys, client = null) {
  const helper = new DynamoDBBatchHelper(client);
  return await helper.batchGetFromTable(tableName, keys);
}

/**
 * Quick batch put
 */
async function quickBatchPut(tableName, items, client = null) {
  const helper = new DynamoDBBatchHelper(client);
  return await helper.batchPutToTable(tableName, items);
}

/**
 * Quick batch delete
 */
async function quickBatchDelete(tableName, keys, client = null) {
  const helper = new DynamoDBBatchHelper(client);
  return await helper.batchDeleteFromTable(tableName, keys);
}

module.exports = {
  DynamoDBBatchHelper,
  createBatchHelper,
  quickBatchGet,
  quickBatchPut,
  quickBatchDelete,
  BATCH_SIZE
};
