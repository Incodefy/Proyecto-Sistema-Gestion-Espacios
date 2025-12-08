//Proyecto-Hospital-Padre-Hurtado\aws\src\handlers\health.js
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { Logger } = require('../utils/logger');
const { createAPIHandler } = require('../middleware/interceptors');
const { successResponse } = require('../utils/errorHandler');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function healthCheckHandler(event, logger) {
  const startTime = Date.now();
  
  const command = new ListTablesCommand({});
  await client.send(command);

  const responseTime = Date.now() - startTime;

  logger.info('Health check completado', { responseTime });

  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stage: process.env.STAGE || 'unknown',
    version: process.env.VERSION || '1.0.0',
    responseTime: `${responseTime}ms`,
    services: {
      dynamodb: 'connected',
          cognito: 'available',
          lambda: 'running'
        },
        tables: {
          userRoles: process.env.USER_ROLES_TABLE,
          permissions: process.env.PERMISSIONS_TABLE,
          parameters: process.env.PARAMETERS_TABLE
        }
      })
    };
  } catch (error) {
    console.error('Health check failed:', error);
    
    return {
      statusCode: 503,
      headers: getSecurityHeaders(),
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      cognito: 'available'
    }
  });
}

exports.check = createAPIHandler(healthCheckHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });
