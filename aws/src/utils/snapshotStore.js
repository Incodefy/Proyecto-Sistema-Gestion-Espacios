/**
 * Snapshot Store for Event Sourcing Optimization
 * 
 * Snapshots reduce the time to rebuild aggregate state by storing
 * periodic snapshots of the aggregate state. When rebuilding, we start
 * from the latest snapshot and apply only subsequent events.
 * 
 * Estrategia:
 * - Snapshot cada 100 eventos
 * - Retención: últimos 3 snapshots por agregado
 * - TTL: 90 días (se regeneran según necesidad)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { retryDB } = require('./retry');
const { Logger } = require('./logger');

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(dynamoDB);

const SNAPSHOTS_TABLE = process.env.SNAPSHOTS_TABLE;
const SNAPSHOT_FREQUENCY = 100; // Snapshot cada 100 eventos
const MAX_SNAPSHOTS_PER_AGGREGATE = 3; // Retener últimos 3 snapshots

class SnapshotStore {
  constructor() {
    this.logger = new Logger('SnapshotStore');
    
    if (!SNAPSHOTS_TABLE) {
      this.logger.warn('SNAPSHOTS_TABLE not configured');
    }
  }

  /**
   * Save a snapshot of aggregate state
   * @param {string} aggregateType - Tipo de agregado (Appointment, Group, etc)
   * @param {string} aggregateId - ID del agregado
   * @param {Object} state - Estado actual del agregado
   * @param {number} version - Versión del agregado (número de eventos aplicados)
   * @param {string} userId - Usuario que ejecutó la acción
   */
  async saveSnapshot(aggregateType, aggregateId, state, version, userId = 'system') {
    if (!SNAPSHOTS_TABLE) {
      this.logger.warn('Snapshot save skipped - table not configured');
      return null;
    }

    const snapshotId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const snapshot = {
      // Primary Key: aggregateType#aggregateId
      PK: `${aggregateType}#${aggregateId}`,
      // Sort Key: VERSION#version (allows querying by version)
      SK: `VERSION#${String(version).padStart(10, '0')}`,
      
      // Snapshot metadata
      snapshotId,
      aggregateType,
      aggregateId,
      version,
      timestamp,
      createdBy: userId,
      
      // State data (compressed if large)
      state: this.compressState(state),
      stateSize: JSON.stringify(state).length,
      
      // TTL: 90 días
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60)
    };

    await retryDB(
      () => docClient.send(new PutCommand({
        TableName: SNAPSHOTS_TABLE,
        Item: snapshot
      })),
      { operation: 'saveSnapshot' }
    );

    this.logger.info('Snapshot saved', {
      aggregateType,
      aggregateId,
      version,
      snapshotId,
      stateSize: snapshot.stateSize
    });

    // Cleanup old snapshots (keep only last N)
    await this.cleanupOldSnapshots(aggregateType, aggregateId);

    return snapshot;
  }

  /**
   * Get the latest snapshot for an aggregate
   * @param {string} aggregateType
   * @param {string} aggregateId
   * @returns {Object|null} Snapshot con state y version, o null si no existe
   */
  async getLatestSnapshot(aggregateType, aggregateId) {
    if (!SNAPSHOTS_TABLE) {
      return null;
    }

    const result = await retryDB(
      () => docClient.send(new QueryCommand({
        TableName: SNAPSHOTS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `${aggregateType}#${aggregateId}`
        },
        Limit: 1,
        ScanIndexForward: false // Most recent first (highest version)
      })),
      { operation: 'getLatestSnapshot' }
    );

    if (!result.Items || result.Items.length === 0) {
      this.logger.debug('No snapshot found', { aggregateType, aggregateId });
      return null;
    }

    const snapshot = result.Items[0];

    this.logger.debug('Snapshot retrieved', {
      aggregateType,
      aggregateId,
      version: snapshot.version,
      snapshotId: snapshot.snapshotId
    });

    return {
      state: this.decompressState(snapshot.state),
      version: snapshot.version,
      timestamp: snapshot.timestamp,
      snapshotId: snapshot.snapshotId
    };
  }

  /**
   * Get snapshot at specific version
   * @param {string} aggregateType
   * @param {string} aggregateId
   * @param {number} version
   */
  async getSnapshotAtVersion(aggregateType, aggregateId, version) {
    if (!SNAPSHOTS_TABLE) {
      return null;
    }

    const result = await retryDB(
      () => docClient.send(new GetCommand({
        TableName: SNAPSHOTS_TABLE,
        Key: {
          PK: `${aggregateType}#${aggregateId}`,
          SK: `VERSION#${String(version).padStart(10, '0')}`
        }
      })),
      { operation: 'getSnapshotAtVersion' }
    );

    if (!result.Item) {
      return null;
    }

    return {
      state: this.decompressState(result.Item.state),
      version: result.Item.version,
      timestamp: result.Item.timestamp,
      snapshotId: result.Item.snapshotId
    };
  }

  /**
   * Check if aggregate should create snapshot
   * @param {number} currentVersion - Versión actual (número de eventos)
   * @returns {boolean}
   */
  shouldCreateSnapshot(currentVersion) {
    return currentVersion > 0 && currentVersion % SNAPSHOT_FREQUENCY === 0;
  }

  /**
   * Clean up old snapshots, keeping only the latest N
   */
  async cleanupOldSnapshots(aggregateType, aggregateId) {
    if (!SNAPSHOTS_TABLE) {
      return;
    }

    try {
      // Get all snapshots for this aggregate
      const result = await retryDB(
        () => docClient.send(new QueryCommand({
          TableName: SNAPSHOTS_TABLE,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `${aggregateType}#${aggregateId}`
          },
          ScanIndexForward: false // Most recent first
        })),
        { operation: 'cleanupOldSnapshots' }
      );

      const snapshots = result.Items || [];

      // Keep only MAX_SNAPSHOTS_PER_AGGREGATE
      if (snapshots.length > MAX_SNAPSHOTS_PER_AGGREGATE) {
        const snapshotsToDelete = snapshots.slice(MAX_SNAPSHOTS_PER_AGGREGATE);

        for (const snapshot of snapshotsToDelete) {
          await docClient.send(new DeleteCommand({
            TableName: SNAPSHOTS_TABLE,
            Key: {
              PK: snapshot.PK,
              SK: snapshot.SK
            }
          }));

          this.logger.debug('Old snapshot deleted', {
            aggregateType,
            aggregateId,
            version: snapshot.version,
            snapshotId: snapshot.snapshotId
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old snapshots', {
        aggregateType,
        aggregateId,
        error: error.message
      });
      // Non-critical error, don't throw
    }
  }

  /**
   * Compress state for storage (simple implementation)
   * For large states, consider using zlib compression
   */
  compressState(state) {
    // Simple JSON stringification
    // TODO: Add zlib compression for states > 50KB
    return state;
  }

  /**
   * Decompress state from storage
   */
  decompressState(state) {
    return state;
  }

  /**
   * Get all snapshots for an aggregate (for debugging/audit)
   */
  async getAllSnapshots(aggregateType, aggregateId) {
    if (!SNAPSHOTS_TABLE) {
      return [];
    }

    const result = await retryDB(
      () => docClient.send(new QueryCommand({
        TableName: SNAPSHOTS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `${aggregateType}#${aggregateId}`
        },
        ScanIndexForward: false
      })),
      { operation: 'getAllSnapshots' }
    );

    return result.Items || [];
  }

  /**
   * Delete all snapshots for an aggregate
   * Use with caution - typically only for testing or aggregate deletion
   */
  async deleteAllSnapshots(aggregateType, aggregateId) {
    if (!SNAPSHOTS_TABLE) {
      return;
    }

    const snapshots = await this.getAllSnapshots(aggregateType, aggregateId);

    for (const snapshot of snapshots) {
      await docClient.send(new DeleteCommand({
        TableName: SNAPSHOTS_TABLE,
        Key: {
          PK: snapshot.PK,
          SK: snapshot.SK
        }
      }));
    }

    this.logger.info('All snapshots deleted', {
      aggregateType,
      aggregateId,
      count: snapshots.length
    });
  }
}

// Singleton
let snapshotStoreInstance = null;

function getSnapshotStore() {
  if (!snapshotStoreInstance) {
    snapshotStoreInstance = new SnapshotStore();
  }
  return snapshotStoreInstance;
}

module.exports = {
  SnapshotStore,
  getSnapshotStore,
  SNAPSHOT_FREQUENCY,
  MAX_SNAPSHOTS_PER_AGGREGATE
};
