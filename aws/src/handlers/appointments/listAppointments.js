// handlers/appointments/listAppointments.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Lista appointments de un grupo
 * Query params:
 * - fecha (opcional): filtra por fecha específica
 * - espacio_id (opcional): filtra por espacio específico
 * - ocupante_id (opcional): filtra por ocupante
 */
exports.handler = async (event) => {
  console.log('📅 [LIST APPOINTMENTS] Event:', JSON.stringify(event, null, 2));

  try {
    const grupoId = event.pathParameters?.grupo_id;
    const { fecha, espacio_id, ocupante_id } = event.queryStringParameters || {};

    if (!grupoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'grupo_id es requerido' })
      };
    }

    let result;

    // Query por ocupante usando GSI1 (OcupanteIndex)
    if (ocupante_id) {
      const params = {
        TableName: APPOINTMENTS_TABLE,
        IndexName: 'OcupanteIndex',
        KeyConditionExpression: 'GSI1PK = :ocupante',
        ExpressionAttributeValues: {
          ':ocupante': ocupante_id.startsWith('OCCUPANT#') ? ocupante_id : `OCCUPANT#${ocupante_id}`,
          ':grupo': grupoId
        },
        FilterExpression: 'grupo_id = :grupo'
      };

      if (fecha) {
        params.KeyConditionExpression += ' AND begins_with(GSI1SK, :fecha)';
        params.ExpressionAttributeValues[':fecha'] = fecha;
      }

      result = await docClient.send(new QueryCommand(params));
    }
    // Query por espacio usando GSI2 (EspacioIndex)
    else if (espacio_id) {
      const params = {
        TableName: APPOINTMENTS_TABLE,
        IndexName: 'EspacioIndex',
        KeyConditionExpression: 'GSI2PK = :espacio',
        ExpressionAttributeValues: {
          ':espacio': espacio_id.startsWith('SUBSPACE#') ? espacio_id : `SUBSPACE#${espacio_id}`,
          ':grupo': grupoId
        },
        FilterExpression: 'grupo_id = :grupo'
      };

      if (fecha) {
        params.KeyConditionExpression += ' AND begins_with(GSI2SK, :fecha)';
        params.ExpressionAttributeValues[':fecha'] = fecha;
      }

      result = await docClient.send(new QueryCommand(params));
    }
    // Query por grupo y fecha usando GSI3 (DateIndex)
    else if (fecha) {
      const params = {
        TableName: APPOINTMENTS_TABLE,
        IndexName: 'DateIndex',
        KeyConditionExpression: 'GSI3PK = :grupo AND begins_with(GSI3SK, :fecha)',
        ExpressionAttributeValues: {
          ':grupo': grupoId,
          ':fecha': fecha
        }
      };

      result = await docClient.send(new QueryCommand(params));
    }
    // Sin filtros específicos - listar todos del grupo usando PK
    else {
      const params = {
        TableName: APPOINTMENTS_TABLE,
        KeyConditionExpression: 'PK = :grupo',
        ExpressionAttributeValues: {
          ':grupo': grupoId
        }
      };

      result = await docClient.send(new QueryCommand(params));
    }

    console.log(`✅ Encontrados ${result.Items?.length || 0} appointments`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ok: true,
        appointments: result.Items || [],
        count: result.Items?.length || 0
      })
    };

  } catch (error) {
    console.error('❌ Error listando appointments:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: 'Error interno del servidor',
        details: error.message
      })
    };
  }
};
