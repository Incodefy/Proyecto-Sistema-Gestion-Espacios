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

    // Primero necesitamos obtener el appointment para conocer su PK y SK
    // Esto requiere una búsqueda por GSI o scan, por ahora asumimos que se pasa fecha en body
    if (!body.fecha_actual) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Se requiere fecha_actual para localizar el appointment' 
        })
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
      tipo_consulta: 'tipo_consulta'
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

    if (updateFields.length === 1) { // Solo updated_at
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No hay campos para actualizar' })
      };
    }

    const updateExpression = `SET ${updateFields.join(', ')}`;

    // Para simplificar, buscaremos primero el appointment
    // En producción, considera pasar PK y SK desde el frontend
    const PK = `GRUPO#${grupoId}#FECHA#${body.fecha_actual}`;
    const SK = `APPOINTMENT#${appointmentId}#${body.hora_inicio_actual || '00:00'}`;

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
