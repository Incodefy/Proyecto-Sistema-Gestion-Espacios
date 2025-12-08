// handlers/appointments/deleteAppointment.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Elimina un appointment
 */
const deleteAppointment = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'deleteAppointment' });
  
  const grupoId = event.pathParameters?.grupo_id;
  const appointmentId = event.pathParameters?.id;
  const { fecha, hora_inicio } = event.queryStringParameters || {};
  
  validate('deleteAppointment', { grupo_id: grupoId, appointmentId, fecha, hora_inicio });
  
  logger.info('Eliminando appointment', { grupo_id: grupoId, appointmentId });
  
  const PK = grupoId;
  const SK = appointmentId.startsWith('APPOINTMENT#') ? appointmentId : `APPOINTMENT#${appointmentId}`;
  
  await retryDB(
    () => docClient.send(new DeleteCommand({
      TableName: APPOINTMENTS_TABLE,
      Key: { PK, SK }
    })),
    { operation: 'deleteAppointment' }
  );
  
  logger.info('Appointment eliminado exitosamente', { appointmentId });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: 'Appointment eliminado correctamente' })
  };
};

module.exports.handler = createAPIHandler(deleteAppointment, {
  rateLimit: { maxRequests: 20, windowSeconds: 60 }
});
