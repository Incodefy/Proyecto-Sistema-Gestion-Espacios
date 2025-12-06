/**
 * Automated Snapshot Creation Lambda
 * 
 * This Lambda is triggered periodically (via EventBridge/CloudWatch Events)
 * to create snapshots for aggregates that have exceeded the threshold
 * without automatic snapshot creation.
 * 
 * Use cases:
 * 1. Backfill snapshots for old aggregates
 * 2. Create snapshots for aggregates approaching threshold
 * 3. Maintenance/optimization runs
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { getEventStore } = require('../../utils/eventStore');
const { getSnapshotStore, SNAPSHOT_FREQUENCY } = require('../../utils/snapshotStore');
const { Logger } = require('../../utils/logger');

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(dynamoDB);

const EVENTS_TABLE = process.env.EVENTS_TABLE;
const BATCH_SIZE = 10; // Process 10 aggregates at a time

exports.handler = async (event) => {
  const logger = new Logger('AutoSnapshotCreator');
  const eventStore = getEventStore();
  const snapshotStore = getSnapshotStore();

  logger.info('Starting automated snapshot creation', {
    batchSize: BATCH_SIZE,
    snapshotFrequency: SNAPSHOT_FREQUENCY
  });

  try {
    // Get aggregates that need snapshots
    const aggregatesToSnapshot = await findAggregatesNeedingSnapshots(docClient, logger);

    logger.info('Found aggregates needing snapshots', {
      count: aggregatesToSnapshot.length
    });

    let successCount = 0;
    let errorCount = 0;

    // Process in batches
    for (let i = 0; i < aggregatesToSnapshot.length; i += BATCH_SIZE) {
      const batch = aggregatesToSnapshot.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (aggregate) => {
          try {
            // Check if recent snapshot exists
            const latestSnapshot = await snapshotStore.getLatestSnapshot(
              aggregate.aggregateType,
              aggregate.aggregateId
            );

            // Only create if no snapshot or old snapshot
            if (!latestSnapshot || (aggregate.version - latestSnapshot.version) >= SNAPSHOT_FREQUENCY) {
              await eventStore.createSnapshotAsync(
                aggregate.aggregateType,
                aggregate.aggregateId,
                aggregate.version,
                'system-auto'
              );

              logger.info('Snapshot created', {
                aggregateType: aggregate.aggregateType,
                aggregateId: aggregate.aggregateId,
                version: aggregate.version
              });

              successCount++;
            }
          } catch (error) {
            logger.error('Failed to create snapshot', {
              aggregateType: aggregate.aggregateType,
              aggregateId: aggregate.aggregateId,
              error: error.message
            });
            errorCount++;
          }
        })
      );

      // Small delay between batches to avoid throttling
      if (i + BATCH_SIZE < aggregatesToSnapshot.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Automated snapshot creation completed', {
      totalProcessed: aggregatesToSnapshot.length,
      successCount,
      errorCount
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Automated snapshot creation completed',
        totalProcessed: aggregatesToSnapshot.length,
        successCount,
        errorCount
      })
    };

  } catch (error) {
    logger.error('Automated snapshot creation failed', {
      error: error.message,
      stack: error.stack
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Automated snapshot creation failed',
        error: error.message
      })
    };
  }
};

/**
 * Find aggregates that need snapshots
 * Strategy: Scan events table and group by aggregate, count events
 */
async function findAggregatesNeedingSnapshots(docClient, logger) {
  const aggregates = new Map();

  try {
    let lastEvaluatedKey = null;
    let scanCount = 0;

    do {
      const params = {
        TableName: EVENTS_TABLE,
        ProjectionExpression: 'PK, SK, aggregateType, aggregateId',
        Limit: 1000
      };

      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await docClient.send(new ScanCommand(params));

      // Group by aggregate and count
      for (const item of result.Items || []) {
        const key = `${item.aggregateType}#${item.aggregateId}`;
        
        if (!aggregates.has(key)) {
          aggregates.set(key, {
            aggregateType: item.aggregateType,
            aggregateId: item.aggregateId,
            version: 0
          });
        }

        aggregates.get(key).version++;
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
      scanCount++;

      logger.debug('Scanned events batch', {
        scanCount,
        itemsScanned: result.Items?.length || 0,
        aggregatesFound: aggregates.size
      });

    } while (lastEvaluatedKey && scanCount < 10); // Limit to 10 scans (10k items max)

    // Filter aggregates that meet snapshot threshold
    const needingSnapshots = Array.from(aggregates.values())
      .filter(agg => agg.version >= SNAPSHOT_FREQUENCY);

    return needingSnapshots;

  } catch (error) {
    logger.error('Failed to find aggregates needing snapshots', {
      error: error.message
    });
    throw error;
  }
}
