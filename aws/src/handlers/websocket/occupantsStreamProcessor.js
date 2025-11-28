const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  console.log('👤 Occupants Stream Event:', JSON.stringify(event, null, 2));

  const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE;
  const WS_ENDPOINT = process.env.WS_ENDPOINT;

  if (!CONNECTIONS_TABLE || !WS_ENDPOINT) {
    console.error('❌ Missing environment variables');
    return { statusCode: 500, body: 'Configuration error' };
  }

  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: WS_ENDPOINT
  });

  for (const record of event.Records) {
    const eventName = record.eventName; // INSERT, MODIFY, REMOVE
    console.log(`🔔 Event: ${eventName}`);

    if (!['INSERT', 'MODIFY', 'REMOVE'].includes(eventName)) {
      continue;
    }

    // Unmarshall DynamoDB data
    const newImage = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
    const oldImage = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
    const occupantData = newImage || oldImage;

    if (!occupantData) {
      console.warn('⚠️ No data in stream record');
      continue;
    }

    // Extraer grupo_id del PK (formato: GROUP#id)
    const grupo_id = occupantData.PK?.replace('GROUP#', '');
    
    if (!grupo_id) {
      console.warn('⚠️ No grupo_id found in occupant data');
      continue;
    }

    console.log(`📍 Grupo ID: ${grupo_id}`);

    // Determinar tipo de mensaje
    let messageType, messageData;

    if (eventName === 'INSERT') {
      messageType = 'OCCUPANT_CREATED';
      messageData = {
        nombre: occupantData.nombre,
        apellido: occupantData.apellido,
        rut: occupantData.rut,
        espacio: occupantData.espacio_nombre || 'Sin asignar',
        id: occupantData.SK
      };
    } else if (eventName === 'MODIFY') {
      messageType = 'OCCUPANT_MODIFIED';
      messageData = {
        nombre: newImage.nombre,
        apellido: newImage.apellido,
        rut: newImage.rut,
        id: newImage.SK,
        changes: getChanges(oldImage, newImage)
      };
    } else if (eventName === 'REMOVE') {
      messageType = 'OCCUPANT_DELETED';
      messageData = {
        nombre: oldImage.nombre,
        apellido: oldImage.apellido,
        rut: oldImage.rut,
        id: oldImage.SK
      };
    }

    // Consultar conexiones activas del grupo
    try {
      const { Items: connections } = await dynamodb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        IndexName: 'GrupoIndex',
        KeyConditionExpression: 'grupo_id = :grupo_id',
        ExpressionAttributeValues: {
          ':grupo_id': grupo_id
        }
      }));

      console.log(`📡 Enviando a ${connections?.length || 0} conexiones`);

      // Enviar mensaje a todas las conexiones del grupo
      const sendPromises = (connections || []).map(async (conn) => {
        try {
          await apiGateway.send(new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: JSON.stringify({
              type: messageType,
              data: messageData
            })
          }));
          console.log(`✅ Mensaje enviado a ${conn.connectionId}`);
        } catch (err) {
          if (err.statusCode === 410) {
            console.log(`🗑️ Conexión obsoleta: ${conn.connectionId}`);
            // TODO: Eliminar conexión obsoleta de la tabla
          } else {
            console.error(`❌ Error enviando a ${conn.connectionId}:`, err);
          }
        }
      });

      await Promise.all(sendPromises);
    } catch (error) {
      console.error('❌ Error querying connections:', error);
    }
  }

  return { statusCode: 200, body: 'OK' };
};

function getChanges(oldImage, newImage) {
  if (!oldImage || !newImage) return {};
  
  const changes = {};
  const fields = ['nombre', 'apellido', 'rut', 'espacio_id', 'espacio_nombre', 'estado', 'diagnostico'];
  
  for (const field of fields) {
    if (oldImage[field] !== newImage[field]) {
      changes[field] = {
        old: oldImage[field],
        new: newImage[field]
      };
    }
  }
  
  return changes;
}
