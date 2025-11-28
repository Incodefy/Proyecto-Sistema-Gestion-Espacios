const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { notifyEspacioCreado, notifyEspacioModificado, notifyEspacioEliminado } = require("../../utils/notificationHelper");

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

exports.handler = async (event) => {
  console.log('📨 Spaces Stream Event:', JSON.stringify(event, null, 2));

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
    const spaceData = newImage || oldImage;

    if (!spaceData) {
      console.warn('⚠️ No data in stream record');
      continue;
    }

    // Extraer grupo_id del PK (formato: GROUP#id)
    const grupo_id = spaceData.PK?.replace('GROUP#', '');
    
    if (!grupo_id) {
      console.warn('⚠️ No grupo_id found in space data');
      continue;
    }

    console.log(`📍 Grupo ID: ${grupo_id}`);

    // Determinar tipo de espacio y mensaje
    let messageType, messageData;
    const isGeneralSpace = spaceData.SK?.startsWith('GENERALSPACE#');
    const spaceType = isGeneralSpace ? 'general' : 'específico';

    if (eventName === 'INSERT') {
      messageType = 'SPACE_CREATED';
      messageData = {
        type: spaceType,
        nombre: spaceData.nombre,
        id: spaceData.SK
      };
    } else if (eventName === 'MODIFY') {
      messageType = 'SPACE_MODIFIED';
      messageData = {
        type: spaceType,
        nombre: spaceData.nombre,
        id: spaceData.SK,
        changes: getChanges(oldImage, newImage)
      };
    } else if (eventName === 'REMOVE') {
      messageType = 'SPACE_DELETED';
      messageData = {
        type: spaceType,
        nombre: oldImage.nombre,
        id: oldImage.SK
      };
    }

    // Obtener miembros del grupo para notificaciones
    let groupMembers = [];
    try {
      const { Items: members } = await dynamodb.send(new QueryCommand({
        TableName: process.env.GROUP_MEMBERS_TABLE,
        KeyConditionExpression: 'group_id = :group_id',
        ExpressionAttributeValues: {
          ':group_id': grupo_id
        }
      }));
      groupMembers = members || [];
      console.log(`👥 ${groupMembers.length} miembros encontrados para notificar`);
    } catch (error) {
      console.error('❌ Error obteniendo miembros del grupo:', error);
    }

    // Guardar notificaciones en DynamoDB
    if (groupMembers.length > 0) {
      const userSubs = groupMembers.map(m => m.user_sub).filter(Boolean);
      const createdBy = spaceData.created_by || 'system';
      
      try {
        if (eventName === 'INSERT') {
          await notifyEspacioCreado({
            userSubs,
            grupoId: grupo_id,
            createdBy,
            espacioId: spaceData.SK,
            espacioNombre: spaceData.nombre,
            espacioTipo: spaceType
          });
          console.log('✅ Notificaciones de espacio creado guardadas');
        } else if (eventName === 'MODIFY') {
          const changes = getChanges(oldImage, newImage);
          if (Object.keys(changes).length > 0) {
            await notifyEspacioModificado({
              userSubs,
              grupoId: grupo_id,
              createdBy,
              espacioId: spaceData.SK,
              espacioNombre: spaceData.nombre,
              espacioTipo: spaceType,
              cambios: changes
            });
            console.log('✅ Notificaciones de espacio modificado guardadas');
          }
        } else if (eventName === 'REMOVE') {
          await notifyEspacioEliminado({
            userSubs,
            grupoId: grupo_id,
            createdBy: oldImage.created_by || 'system',
            espacioId: oldImage.SK,
            espacioNombre: oldImage.nombre,
            espacioTipo: spaceType
          });
          console.log('✅ Notificaciones de espacio eliminado guardadas');
        }
      } catch (error) {
        console.error('❌ Error guardando notificaciones:', error);
      }
    }

    // Consultar conexiones activas del grupo para WebSocket
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
  const fields = ['nombre', 'capacidad', 'descripcion', 'estado'];
  
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
