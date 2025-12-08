// handlers/appointments/checkConflict.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { Logger } = require("../../utils/logger");
const { createAPIHandler } = require("../../middleware/interceptors");
const { successResponse } = require("../../utils/errorHandler");
const { ValidationError } = require("../../utils/errorHandler");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

async function checkConflictHandler(event, logger) {
  const grupoId = event.pathParameters?.grupo_id;
  if (!grupoId) throw new ValidationError('grupo_id es requerido');

  const body = JSON.parse(event.body || '{}');
  const { fecha, hora_inicio, hora_fin, espacio_id, ocupante_id, exclude_appointment_id } = body;

  if (!fecha || !hora_inicio || !hora_fin) {
    throw new ValidationError('fecha, hora_inicio y hora_fin son requeridos');
  }

  if (!espacio_id && !ocupante_id) {
    throw new ValidationError('Debe proporcionar espacio_id u ocupante_id');
  }

  logger.info('Verificando conflictos', { fecha, hora_inicio, hora_fin, espacio_id, ocupante_id });

  const conflicts = [];

  const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const newStart = toMinutes(hora_inicio);
  const newEnd = toMinutes(hora_fin);    // Verificar conflictos en espacio
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

    logger.info('Verificación completa', { hasConflict, conflictsCount: conflicts.length });

    return successResponse({
      ok: true,
      hasConflict,
      conflicts,
      message: hasConflict 
        ? `Se encontraron ${conflicts.length} conflicto(s)` 
        : 'No hay conflictos'
    });
}

module.exports.handler = createAPIHandler(checkConflictHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });
