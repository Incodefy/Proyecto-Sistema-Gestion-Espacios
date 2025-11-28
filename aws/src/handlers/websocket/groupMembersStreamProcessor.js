const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  console.log('👥 GroupMembers Stream Event:', JSON.stringify(event, null, 2));

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
    const memberData = newImage || oldImage;

    if (!memberData) {
      console.warn('⚠️ No data in stream record');
      continue;
    }

    // El grupo_id es directamente el PK (no tiene prefijo en esta tabla)
    const grupo_id = memberData.group_id;
    
    if (!grupo_id) {
      console.warn('⚠️ No grupo_id found in member data');
      continue;
    }

    console.log(`📍 Grupo ID: ${grupo_id}`);

    // Determinar tipo de mensaje
    let messageType, messageData;

    if (eventName === 'INSERT') {
      messageType = 'MEMBER_ADDED';
      messageData = {
        email: memberData.user_email,
        nombre: memberData.user_name || memberData.user_email?.split('@')[0],
        rol: memberData.role,
        user_sub: memberData.user_sub
      };
    } else if (eventName === 'MODIFY') {
      // Detectar si cambió el rol
      const roleChanged = oldImage.role !== newImage.role;
      
      if (roleChanged) {
        messageType = 'ROLE_CHANGED';
        messageData = {
          email: newImage.user_email,
          nombre: newImage.user_name || newImage.user_email?.split('@')[0],
          oldRole: oldImage.role,
          newRole: newImage.role,
          user_sub: newImage.user_sub
        };
      } else {
        // Otros cambios (nombre, etc.)
        messageType = 'MEMBER_MODIFIED';
        messageData = {
          email: newImage.user_email,
          nombre: newImage.user_name || newImage.user_email?.split('@')[0],
          rol: newImage.role,
          user_sub: newImage.user_sub,
          changes: getChanges(oldImage, newImage)
        };
      }
    } else if (eventName === 'REMOVE') {
      messageType = 'MEMBER_REMOVED';
      messageData = {
        email: oldImage.user_email,
        nombre: oldImage.user_name || oldImage.user_email?.split('@')[0],
        rol: oldImage.role,
        user_sub: oldImage.user_sub
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
  const fields = ['user_name', 'user_email', 'role', 'apellido', 'telefono'];
  
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
