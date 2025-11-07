//Proyecto-Hospital-Padre-Hurtado\aws\src\handlers\health.js
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Health check endpoint para validar el estado del sistema
 * Verifica conectividad con DynamoDB y retorna información del entorno
 */
exports.check = async (event) => {
  const startTime = Date.now();
  
  try {
    // Verificar conexión a DynamoDB
    const command = new ListTablesCommand({});
    await client.send(command);

    const responseTime = Date.now() - startTime;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        stage: process.env.STAGE || 'unknown'
      })
    };
  }
};
