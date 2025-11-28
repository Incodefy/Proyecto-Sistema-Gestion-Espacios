// handlers/websocket/streamProcessor.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { unmarshall } = require('@aws-sdk/util-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
const WS_ENDPOINT = process.env.WS_ENDPOINT;

/**
 * Procesa eventos de DynamoDB Stream y notifica a clientes WebSocket
 */
exports.handler = async (event) => {
  console.log('📡 [STREAM PROCESSOR] Records:', event.Records.length);

  for (const record of event.Records) {
    try {
      console.log('Record:', JSON.stringify(record, null, 2));

      // Extraer datos del appointment
      let appointmentData;
      let eventType = record.eventName; // INSERT, MODIFY, REMOVE

      if (record.eventName === 'REMOVE') {
        appointmentData = unmarshall(record.dynamodb.OldImage);
      } else {
        appointmentData = unmarshall(record.dynamodb.NewImage);
      }

      const grupoId = appointmentData.grupo_id || appointmentData.PK;

      console.log(`Evento ${eventType} para grupo ${grupoId}`);

      // Obtener conexiones activas para este grupo
      const connections = await getConnectionsByGroup(grupoId);
      console.log(`${connections.length} conexiones activas para el grupo`);

      // Enviar notificación a cada conexión
      const message = JSON.stringify({
        type: eventType,
        data: appointmentData
      });

      await Promise.all(
        connections.map(conn => sendMessageToConnection(conn.connectionId, message))
      );

    } catch (error) {
      console.error('❌ Error procesando record:', error);
    }
  }

  return { statusCode: 200 };
};

async function getConnectionsByGroup(grupoId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'GrupoIndex',
      KeyConditionExpression: 'grupo_id = :grupoId',
      ExpressionAttributeValues: {
        ':grupoId': grupoId
      }
    }));

    return result.Items || [];
  } catch (error) {
    console.error('Error obteniendo conexiones:', error);
    return [];
  }
}

async function sendMessageToConnection(connectionId, message) {
  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: WS_ENDPOINT
  });

  try {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(message)
    }));

    console.log(`✅ Mensaje enviado a ${connectionId}`);
  } catch (error) {
    if (error.statusCode === 410) {
      console.log(`Conexión obsoleta, eliminar: ${connectionId}`);
      // TODO: Eliminar conexión obsoleta de DynamoDB
    } else {
      console.error(`Error enviando mensaje a ${connectionId}:`, error);
    }
  }
}
