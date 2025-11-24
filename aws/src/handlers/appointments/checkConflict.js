// handlers/appointments/checkConflict.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Verifica conflictos de horario para un espacio u ocupante
 * Body esperado:
 * {
 *   fecha: "2025-11-23",
 *   hora_inicio: "09:00",
 *   hora_fin: "10:00",
 *   espacio_id: "SUBSPACE#1",  // opcional
 *   ocupante_id: "OCCUPANT#1",  // opcional
 *   exclude_appointment_id: "uuid"  // opcional, para updates
 * }
 */
exports.handler = async (event) => {
  console.log('🔍 [CHECK CONFLICT] Event:', JSON.stringify(event, null, 2));

  try {
    const grupoId = event.pathParameters?.grupo_id;
    const body = JSON.parse(event.body || '{}');

    if (!grupoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'grupo_id es requerido' })
      };
    }

    const { fecha, hora_inicio, hora_fin, espacio_id, ocupante_id, exclude_appointment_id } = body;

    if (!fecha || !hora_inicio || !hora_fin) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'fecha, hora_inicio y hora_fin son requeridos' })
      };
    }

    if (!espacio_id && !ocupante_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Debe proporcionar espacio_id u ocupante_id' })
      };
    }

    const conflicts = [];

    // Convertir horas a minutos para comparación
    const toMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const newStart = toMinutes(hora_inicio);
    const newEnd = toMinutes(hora_fin);

    // Verificar conflictos en espacio
    if (espacio_id) {
      const params = {
        TableName: APPOINTMENTS_TABLE,
        IndexName: 'EspacioIndex',
        KeyConditionExpression: 'GSI2PK = :espacio AND begins_with(GSI2SK, :fecha)',
        ExpressionAttributeValues: {
          ':espacio': `ESPACIO#${espacio_id}`,
          ':fecha': fecha,
          ':grupo': grupoId
        },
        FilterExpression: 'grupo_id = :grupo'
      };

      const result = await docClient.send(new QueryCommand(params));

      for (const appt of result.Items || []) {
        if (exclude_appointment_id && appt.id === exclude_appointment_id) {
          continue;
        }

        const existingStart = toMinutes(appt.hora_inicio);
        const existingEnd = toMinutes(appt.hora_fin);

        // Verificar solapamiento
        if (!(newEnd <= existingStart || newStart >= existingEnd)) {
          conflicts.push({
            type: 'espacio',
            appointment: appt,
            message: `Conflicto de horario en ${appt.espacio_especifico_nombre}`
          });
        }
      }
    }

    // Verificar conflictos en ocupante
    if (ocupante_id) {
      const params = {
        TableName: APPOINTMENTS_TABLE,
        IndexName: 'OcupanteIndex',
        KeyConditionExpression: 'GSI1PK = :ocupante AND begins_with(GSI1SK, :fecha)',
        ExpressionAttributeValues: {
          ':ocupante': `OCUPANTE#${ocupante_id}`,
          ':fecha': fecha,
          ':grupo': grupoId
        },
        FilterExpression: 'grupo_id = :grupo'
      };

      const result = await docClient.send(new QueryCommand(params));

      for (const appt of result.Items || []) {
        if (exclude_appointment_id && appt.id === exclude_appointment_id) {
          continue;
        }

        const existingStart = toMinutes(appt.hora_inicio);
        const existingEnd = toMinutes(appt.hora_fin);

        // Verificar solapamiento
        if (!(newEnd <= existingStart || newStart >= existingEnd)) {
          conflicts.push({
            type: 'ocupante',
            appointment: appt,
            message: `${appt.ocupante_nombre} ya tiene cita programada`
          });
        }
      }
    }

    const hasConflict = conflicts.length > 0;

    console.log(`${hasConflict ? '⚠️' : '✅'} Conflictos encontrados: ${conflicts.length}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ok: true,
        hasConflict,
        conflicts,
        message: hasConflict 
          ? `Se encontraron ${conflicts.length} conflicto(s)` 
          : 'No hay conflictos'
      })
    };

  } catch (error) {
    console.error('❌ Error verificando conflictos:', error);
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
