// handlers/appointments/createAppointment.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { Logger } = require("../../utils/logger");
const { validate } = require("../../utils/validator");
const { retryDB } = require("../../utils/retry");
const { createAPIHandler } = require("../../middleware/interceptors");
const { encryptPII, decryptPII } = require("../../utils/encryption");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Crea un nuevo appointment
 */
const createAppointment = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createAppointment' });
  
  const body = JSON.parse(event.body || '{}');
  const grupoId = event.pathParameters?.grupo_id;
  
  validate('createAppointment', { ...body, grupo_id: grupoId });
  
  logger.info('Creando appointment', { 
    grupo_id: grupoId,
    fecha: body.fecha,
    ocupante: body.ocupante?.nombre
  });

    // Generar ID incremental (por ahora usamos timestamp para hacerlo único)
    const appointmentId = `APPOINTMENT#${Date.now()}`;
    const timestamp = new Date().toISOString();

    const appointment = {
      // PK/SK igual que los appointments existentes
      PK: grupoId,
      SK: appointmentId,
      
      // appointment_id para compatibilidad
      appointment_id: appointmentId,
      
      // GSI1: Por Ocupante (sin duplicar prefijo)
      GSI1PK: body.ocupante.id,
      GSI1SK: `${body.fecha}#${body.hora_inicio}`,
      
      // GSI2: Por Espacio (sin duplicar prefijo)
      GSI2PK: body.espacio_especifico.id,
      GSI2SK: `${body.fecha}#${body.hora_inicio}`,
      
      // GSI3: Por Grupo
      GSI3PK: grupoId,
      GSI3SK: `${body.fecha}#${body.hora_inicio}`,

      // Datos del appointment
      grupo_id: grupoId,
      fecha: body.fecha,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,

      // Espacio (usar nombres compatibles con appointments existentes)
      espacio_id: body.espacio_especifico.id,
      espacio_nombre: body.espacio_especifico.nombre,

      // Ocupante
      ocupante_id: body.ocupante.id,
      ocupante_nombre: body.ocupante.nombre,

      // Especialidad
      especialidad_id: body.especialidad?.id || null,
      especialidad_nombre: body.especialidad?.nombre || null,
      estado: body.estado || 'CONFIRMADA',
      tipo_consulta: body.tipo_consulta || null,
      observaciones: body.notas || null,
      created_at: timestamp,
      updated_at: timestamp,
      created_by: event.requestContext?.authorizer?.jwt?.claims?.sub || 'system'
    };

    // Encriptar PII antes de guardar (v2.1)
    const encryptedAppointment = await encryptPII(appointment);

    await retryDB(
      () => docClient.send(new PutCommand({
        TableName: APPOINTMENTS_TABLE,
        Item: encryptedAppointment
      })),
      { operation: 'createAppointment' }
    );

    logger.info('Appointment creado con PII encriptado', { appointmentId });

    // Desencriptar para response (v2.1)
    const decryptedAppointment = await decryptPII(encryptedAppointment);

    return {
      statusCode: 201,
      body: JSON.stringify({ ok: true, appointment: decryptedAppointment })
    };
};

module.exports.handler = createAPIHandler(createAppointment, {
  rateLimit: { maxRequests: 30, windowSeconds: 60 }
});
