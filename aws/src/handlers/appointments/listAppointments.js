// handlers/appointments/listAppointments.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { Cache } = require("../../utils/cache");
const { createAPIHandler } = require("../../middleware/interceptors");
const { decryptPII } = require("../../utils/encryption");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

const appointmentsCache = new Cache({ ttl: 180, maxSize: 500 }); // 3 min

/**
 * Lista appointments de un grupo
 */
const listAppointments = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'listAppointments' });
  
  const grupoId = event.pathParameters?.grupo_id;
  const { fecha, espacio_id, ocupante_id } = event.queryStringParameters || {};
  
  validate('listAppointments', { grupo_id: grupoId });
  
  const cacheKey = `appointments:${grupoId}:${fecha || 'all'}:${espacio_id || 'all'}:${ocupante_id || 'all'}`;
  const cached = appointmentsCache.get(cacheKey);
  
  if (cached) {
    logger.info('Appointments obtenidos desde cache', { count: cached.length });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, appointments: cached, count: cached.length, cached: true })
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
  logger.info('Consultando appointments', { grupo_id: grupoId, fecha, espacio_id, ocupante_id });
  
  let params;
  
  if (ocupante_id) {
    params = {
      TableName: APPOINTMENTS_TABLE,
      IndexName: 'OcupanteIndex',
      KeyConditionExpression: 'GSI1PK = :ocupante' + (fecha ? ' AND begins_with(GSI1SK, :fecha)' : ''),
      ExpressionAttributeValues: {
        ':ocupante': ocupante_id.startsWith('OCCUPANT#') ? ocupante_id : `OCCUPANT#${ocupante_id}`,
        ':grupo': grupoId,
        ...(fecha && { ':fecha': fecha })
      },
      FilterExpression: 'grupo_id = :grupo'
    };
  } else if (espacio_id) {
    params = {
      TableName: APPOINTMENTS_TABLE,
      IndexName: 'EspacioIndex',
      KeyConditionExpression: 'GSI2PK = :espacio' + (fecha ? ' AND begins_with(GSI2SK, :fecha)' : ''),
      ExpressionAttributeValues: {
        ':espacio': espacio_id.startsWith('SUBSPACE#') ? espacio_id : `SUBSPACE#${espacio_id}`,
        ':grupo': grupoId,
        ...(fecha && { ':fecha': fecha })
      },
      FilterExpression: 'grupo_id = :grupo'
    };
  } else if (fecha) {
    params = {
      TableName: APPOINTMENTS_TABLE,
      IndexName: 'DateIndex',
      KeyConditionExpression: 'GSI3PK = :grupo AND begins_with(GSI3SK, :fecha)',
      ExpressionAttributeValues: { ':grupo': grupoId, ':fecha': fecha }
    };
  } else {
    params = {
      TableName: APPOINTMENTS_TABLE,
      KeyConditionExpression: 'PK = :grupo AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':grupo': grupoId, ':prefix': 'APPOINTMENT#' }
    };
  }
  
  const result = await retryDB(
    () => docClient.send(new QueryCommand(params)),
    { operation: 'listAppointments' }
  );
  
  // Desencriptar PII de appointments (v2.1)
  const rawAppointments = result.Items || [];
  const appointments = await Promise.all(
    rawAppointments.map(async (apt) => await decryptPII(apt))
  );
  
  appointmentsCache.set(cacheKey, appointments);
  
  logger.info('Appointments obtenidos, desencriptados y cacheados', { count: appointments.length });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, appointments, count: appointments.length })
  };
};

module.exports.handler = createAPIHandler(listAppointments, {
  rateLimit: { maxRequests: 150, windowSeconds: 60 }
});
