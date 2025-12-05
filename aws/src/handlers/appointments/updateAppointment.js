// handlers/appointments/updateAppointment.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const Logger = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Actualiza un appointment existente
 */
const updateAppointment = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'updateAppointment' });
  
  const body = JSON.parse(event.body || '{}');
  const grupoId = event.pathParameters?.grupo_id;
  const appointmentId = event.pathParameters?.id;
  
  validate('updateAppointment', { ...body, grupo_id: grupoId, appointmentId });
  
  logger.info('Actualizando appointment', { grupo_id: grupoId, appointmentId });

  const updateFields = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  const updatableFields = {
    estado: 'estado', notas: 'notas', tipo_consulta: 'tipo_consulta',
    ocupante_id: 'ocupante_id', ocupante_nombre: 'ocupante_nombre',
    especialidad_id: 'especialidad_id', especialidad_nombre: 'especialidad_nombre',
    espacio_id: 'espacio_id', hora_inicio: 'hora_inicio', hora_fin: 'hora_fin',
    paciente_nombre: 'paciente_nombre', paciente_rut: 'paciente_rut',
    observaciones: 'observaciones'
  };
  
  Object.keys(updatableFields).forEach(field => {
    if (body[field] !== undefined) {
      updateFields.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = updatableFields[field];
      expressionAttributeValues[`:${field}`] = body[field];
    }
  });
  
  updateFields.push('#updated_at = :updated_at');
  expressionAttributeNames['#updated_at'] = 'updated_at';
  expressionAttributeValues[':updated_at'] = new Date().toISOString();
  
  if (body.ocupante_id) {
    updateFields.push('#GSI1PK = :GSI1PK');
    expressionAttributeNames['#GSI1PK'] = 'GSI1PK';
    expressionAttributeValues[':GSI1PK'] = body.ocupante_id;
  }
  
  if (body.espacio_id) {
    updateFields.push('#GSI2PK = :GSI2PK');
    expressionAttributeNames['#GSI2PK'] = 'GSI2PK';
    expressionAttributeValues[':GSI2PK'] = body.espacio_id;
  }

    // Si se actualiza fecha u hora_inicio, actualizar los SK de los GSI
    if (body.fecha || body.hora_inicio) {
      const fecha = body.fecha;
      const horaInicio = body.hora_inicio;
      
      if (fecha && horaInicio) {
        const gsiSK = `${fecha}#${horaInicio}`;
        updateFields.push('#GSI1SK = :GSI1SK', '#GSI2SK = :GSI2SK', '#GSI3SK = :GSI3SK');
        expressionAttributeNames['#GSI1SK'] = 'GSI1SK';
        expressionAttributeNames['#GSI2SK'] = 'GSI2SK';
        expressionAttributeNames['#GSI3SK'] = 'GSI3SK';
        expressionAttributeValues[':GSI1SK'] = gsiSK;
        expressionAttributeValues[':GSI2SK'] = gsiSK;
        expressionAttributeValues[':GSI3SK'] = gsiSK;
        
        // También actualizar el campo fecha si se cambió
        if (body.fecha) {
          updateFields.push('#fecha = :fecha');
          expressionAttributeNames['#fecha'] = 'fecha';
          expressionAttributeValues[':fecha'] = body.fecha;
        }
      }
    }

    if (updateFields.length === 1) { // Solo updated_at
      return {
  if (updateFields.length === 1) {
    logger.warn('No hay campos para actualizar');
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: 'No hay campos para actualizar' })
    };
  }

  const PK = grupoId;
  const SK = appointmentId.startsWith('APPOINTMENT#') ? appointmentId : `APPOINTMENT#${appointmentId}`;

  await retryDB(
    () => docClient.send(new UpdateCommand({
      TableName: APPOINTMENTS_TABLE,
      Key: { PK, SK },
      UpdateExpression: `SET ${updateFields.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    })),
    { operation: 'updateAppointment' }
  );

  logger.info('Appointment actualizado exitosamente', { appointmentId });

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, message: 'Appointment actualizado correctamente' })
  };
};

module.exports.handler = createAPIHandler(updateAppointment, {
  rateLimit: { maxRequests: 40, windowSeconds: 60 }
});
