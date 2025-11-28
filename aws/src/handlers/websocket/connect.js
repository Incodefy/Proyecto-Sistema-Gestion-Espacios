// handlers/websocket/connect.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

/**
 * Handler para $connect de WebSocket
 * Guarda el connectionId en DynamoDB
 */
exports.handler = async (event) => {
  console.log('🔌 [WS CONNECT] Event:', JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;
    
    // Extraer grupo_id de query params o authorizer
    const queryParams = event.queryStringParameters || {};
    const grupoId = queryParams.grupo_id;

    if (!grupoId) {
      console.log('⚠️ Conexión sin grupo_id');
      return {
        statusCode: 400,
        body: 'grupo_id es requerido'
      };
    }

    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        grupo_id: grupoId,
        connected_at: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expira en 24 horas
      }
    }));

    console.log(`✅ Conexión guardada: ${connectionId} para grupo ${grupoId}`);

    return {
      statusCode: 200,
      body: 'Conectado'
    };
  } catch (error) {
    console.error('❌ Error en connect:', error);
    return {
      statusCode: 500,
      body: 'Error al conectar'
    };
  }
};
