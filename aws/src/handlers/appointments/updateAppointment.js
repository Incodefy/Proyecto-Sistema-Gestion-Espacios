// handlers/appointments/updateAppointment.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Actualiza un appointment existente
 * Path: /groups/{grupo_id}/appointments/{id}
 * Body: campos a actualizar
 */
exports.handler = async (event) => {
  console.log('✏️ [UPDATE APPOINTMENT] Event:', JSON.stringify(event, null, 2));

  try {
    const grupoId = event.pathParameters?.grupo_id;
    const appointmentId = event.pathParameters?.id;
    const body = JSON.parse(event.body || '{}');

    if (!grupoId || !appointmentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'grupo_id y appointment id son requeridos' })
      };
    }

    // Construir la lista de campos a actualizar
    const updateFields = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    // Campos actualizables
    const updatableFields = {
      estado: 'estado',
      notas: 'notas',
      tipo_consulta: 'tipo_consulta',
      ocupante_id: 'ocupante_id',
      ocupante_nombre: 'ocupante_nombre',
      especialidad_id: 'especialidad_id',
      especialidad_nombre: 'especialidad_nombre',
      espacio_id: 'espacio_id',
      hora_inicio: 'hora_inicio',
      hora_fin: 'hora_fin',
      paciente_nombre: 'paciente_nombre',
      paciente_rut: 'paciente_rut',
      observaciones: 'observaciones'
    };

    Object.keys(updatableFields).forEach(field => {
      if (body[field] !== undefined) {
        const placeholder = `#${field}`;
        const valuePlaceholder = `:${field}`;
        updateFields.push(`${placeholder} = ${valuePlaceholder}`);
        expressionAttributeNames[placeholder] = updatableFields[field];
        expressionAttributeValues[valuePlaceholder] = body[field];
      }
    });

    // Actualizar timestamp
    updateFields.push('#updated_at = :updated_at');
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeValues[':updated_at'] = new Date().toISOString();

    // Si se actualiza ocupante_id, actualizar GSI1PK
    if (body.ocupante_id) {
      updateFields.push('#GSI1PK = :GSI1PK');
      expressionAttributeNames['#GSI1PK'] = 'GSI1PK';
      expressionAttributeValues[':GSI1PK'] = body.ocupante_id;
    }

    // Si se actualiza espacio_id, actualizar GSI2PK
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
        statusCode: 400,
        body: JSON.stringify({ error: 'No hay campos para actualizar' })
      };
    }

    const updateExpression = `SET ${updateFields.join(', ')}`;

    // Usar la estructura correcta de PK y SK
    const PK = grupoId;  // Solo el grupo_id
    const SK = appointmentId;  // Ya viene como APPOINTMENT#n

    console.log(`Actualizando appointment con PK: ${PK}, SK: ${SK}`);

    const result = await docClient.send(new UpdateCommand({
      TableName: APPOINTMENTS_TABLE,
      Key: { PK, SK },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    }));

    console.log(`✅ Appointment actualizado: ${appointmentId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ok: true,
        appointment: result.Attributes
      })
    };

  } catch (error) {
    console.error('❌ Error actualizando appointment:', error);
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
