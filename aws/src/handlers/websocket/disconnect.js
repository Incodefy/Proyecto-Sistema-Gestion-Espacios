// handlers/websocket/disconnect.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;

/**
 * Handler para $disconnect de WebSocket
 * Elimina el connectionId de DynamoDB
 */
exports.handler = async (event) => {
  console.log('🔌 [WS DISCONNECT] Event:', JSON.stringify(event, null, 2));

  try {
    const connectionId = event.requestContext.connectionId;

    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));

    console.log(`✅ Conexión eliminada: ${connectionId}`);

    return {
      statusCode: 200,
      body: 'Desconectado'
    };
  } catch (error) {
    console.error('❌ Error en disconnect:', error);
    return {
      statusCode: 500,
      body: 'Error al desconectar'
    };
  }
};
