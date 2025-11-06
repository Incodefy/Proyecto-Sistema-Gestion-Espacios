const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

// Datos de notificaciones (los registros que proporcionaste)
const notificaciones = [
  {
    id: 2,
    tipo: "importacion",
    descripcion: "Se han importado 2 consultas.",
    detalle: [
      {
        box: "Box 3",
        fecha: "2025-06-01",
        estado: "No atendido",
        idfila: "a1f11f23-d1f4-4c2f-b4a1-df45a1a2a5c6",
        medico: "Matías Leiva",
        horafin: "11:00:00",
        horainicio: "10:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 5",
        fecha: "2025-06-02",
        estado: "No atendido",
        idfila: "d913f0a2-7f88-4d0f-a7ac-3a7c547f8452",
        medico: "José Luis Marín",
        horafin: "12:00:00",
        horainicio: "11:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      }
    ],
    fecha: "2025-06-25 10:05:15"
  },
  {
    id: 3,
    tipo: "importacion",
    descripcion: "Se han importado 4 consultas.",
    detalle: [
      {
        box: "Box 4",
        fecha: "2025-06-10",
        estado: "No atendido",
        idfila: "7d5c354e-f9f5-4c62-bbb2-cf3aab8c8f9c",
        medico: "Carla Soto",
        horafin: "14:00:00",
        horainicio: "13:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 6",
        fecha: "2025-06-12",
        estado: "No atendido",
        idfila: "b1d6b44b-f0d9-4d80-9a35-636db7ab7c8a",
        medico: "Rodrigo Salas",
        horafin: "15:00:00",
        horainicio: "14:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 8",
        fecha: "2025-06-14",
        estado: "No atendido",
        idfila: "2f759f29-49d0-4319-a78d-e23cb39071f9",
        medico: "Pablo Santander",
        horafin: "16:00:00",
        horainicio: "15:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 9",
        fecha: "2025-06-16",
        estado: "No atendido",
        idfila: "c92e9d26-1db7-420f-b279-e01c5d06a8d3",
        medico: "Ignacio Fuentes",
        horafin: "17:00:00",
        horainicio: "16:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      }
    ],
    fecha: "2025-06-30 11:22:42"
  },
  {
    id: 4,
    tipo: "importacion",
    descripcion: "Se han importado 5 consultas.",
    detalle: [
      {
        box: "Box 10",
        fecha: "2025-06-18",
        estado: "No atendido",
        idfila: "4b5e13e7-d746-4903-ae87-e44be784c01d",
        medico: "Ignacio Fuentes",
        horafin: "10:00:00",
        horainicio: "09:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 12",
        fecha: "2025-06-20",
        estado: "No atendido",
        idfila: "7a2f8b01-925f-46de-9be9-cb5d91c6c2ff",
        medico: "Matías Leiva",
        horafin: "12:00:00",
        horainicio: "11:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 14",
        fecha: "2025-06-22",
        estado: "No atendido",
        idfila: "b687d320-204e-44d1-82b5-1fd953cbf5a1",
        medico: "Laura Zamora",
        horafin: "13:00:00",
        horainicio: "12:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 15",
        fecha: "2025-06-24",
        estado: "No atendido",
        idfila: "d687d320-204e-44d1-82b5-1fd953cbf5a1",
        medico: "José Luis Marín",
        horafin: "14:00:00",
        horainicio: "13:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      },
      {
        box: "Box 18",
        fecha: "2025-06-26",
        estado: "No atendido",
        idfila: "f43f8e8d-dfb1-497a-bc97-f09cc4fef842",
        medico: "Felipe Vázquez",
        horafin: "15:00:00",
        horainicio: "14:00:00",
        tipoconsulta: "Médica",
        sobreposicion: false,
        conflicto_tipo: "ninguno"
      }
    ],
    fecha: "2025-07-02 12:40:27"
  }
];

// Función para insertar notificaciones
async function insertNotificaciones() {
  for (const notificacion of notificaciones) {
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-notificacion', // Nombre correcto de la tabla de notificaciones
      Item: {
        PK: { S: `NOTI#${notificacion.id}` },
        SK: { S: `#` },
        id: { N: String(notificacion.id) },
        tipo: { S: notificacion.tipo },
        descripcion: { S: notificacion.descripcion },
        detalle: { S: JSON.stringify(notificacion.detalle) }, // Almacenamos el detalle como un string JSON
        fecha: { S: notificacion.fecha }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Llamada a la función de inserción
(async () => {
  try {
    await insertNotificaciones();
    console.log("Notificaciones insertadas exitosamente.");
  } catch (error) {
    console.error("Error insertando notificaciones:", error);
  }
})();
