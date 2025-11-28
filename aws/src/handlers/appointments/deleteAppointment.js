// handlers/appointments/deleteAppointment.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const APPOINTMENTS_TABLE = process.env.APPOINTMENTS_TABLE;

/**
 * Elimina un appointment
 * Path: /groups/{grupo_id}/appointments/{id}
 * Query params: fecha, hora_inicio (necesarios para identificar el appointment)
 */
exports.handler = async (event) => {
  console.log('🗑️ [DELETE APPOINTMENT] Event:', JSON.stringify(event, null, 2));

  try {
    const grupoId = event.pathParameters?.grupo_id;
    const appointmentId = event.pathParameters?.id;
    const { fecha, hora_inicio } = event.queryStringParameters || {};

    if (!grupoId || !appointmentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'grupo_id y appointment id son requeridos' })
      };
    }

    if (!fecha || !hora_inicio) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Query params fecha y hora_inicio son requeridos para eliminar' 
        })
      };
    }

    // Usar el formato correcto: PK = grp_xxx, SK = APPOINTMENT#id o appointment_id completo
    const PK = grupoId;
    const SK = appointmentId.startsWith('APPOINTMENT#') ? appointmentId : `APPOINTMENT#${appointmentId}`;

    console.log(`[DELETE] Intentando eliminar: PK=${PK}, SK=${SK}`);

    await docClient.send(new DeleteCommand({
      TableName: APPOINTMENTS_TABLE,
      Key: { PK, SK }
    }));

    console.log(`✅ Appointment eliminado: ${appointmentId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        ok: true,
        message: 'Appointment eliminado correctamente'
      })
    };

  } catch (error) {
    console.error('❌ Error eliminando appointment:', error);
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
