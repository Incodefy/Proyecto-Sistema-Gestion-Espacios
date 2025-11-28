// handlers/appointments/createAppointment.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Crea un nuevo appointment
 * Body esperado:
 * {
 *   fecha: "2025-11-23",
 *   hora_inicio: "09:00",
 *   hora_fin: "10:00",
 *   espacio_general: { id: "SPACE#1", nombre: "Edificio A" },
 *   espacio_especifico: { id: "SUBSPACE#1", nombre: "Consultorio 1" },
 *   ocupante: { id: "OCCUPANT#1", nombre: "Dr. Juan Pérez" },
 *   especialidad: { id: "ESP#1", nombre: "Cardiología" },
 *   estado: "Programado",
 *   tipo_consulta: "Primera vez",
 *   notas: "Paciente nuevo"
 * }
 */
exports.handler = async (event) => {
  console.log('➕ [CREATE APPOINTMENT] Event:', JSON.stringify(event, null, 2));

  try {
    const grupoId = event.pathParameters?.grupo_id;
    const body = JSON.parse(event.body || '{}');

    // Validaciones
    if (!grupoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'grupo_id es requerido' })
      };
    }

    const required = ['fecha', 'hora_inicio', 'hora_fin', 'espacio_especifico', 'ocupante'];
    for (const field of required) {
      if (!body[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `Campo ${field} es requerido` })
        };
      }
    }

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

      // Metadata
      estado: body.estado || 'CONFIRMADA',
      tipo_consulta: body.tipo_consulta || null,
      observaciones: body.notas || null,
      
      created_at: timestamp,
      updated_at: timestamp
    };

    await docClient.send(new PutCommand({
      TableName: APPOINTMENTS_TABLE,
      Item: appointment
    }));

    console.log(`✅ Appointment creado: ${appointmentId}`);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ok: true,
        appointment
      })
    };

  } catch (error) {
    console.error('❌ Error creando appointment:', error);
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
