const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

// Datos de la agenda (ejemplo)
const agenda = [
  {
    idAgenda: 1,
    idBox: 1,
    boxNombre: "Box 1",
    idMedico: 2,
    medicoNombre: "Felipe Vázquez",
    idEspecialidad: 1,
    especialidadNombre: "Cardiología",
    idEstado: 1,
    estadoNombre: "Atendido",
    fecha: "2025-09-15",
    horaInicio: "15:00",
    horaFin: "16:00",
    tipoConsulta: "Médica"
  },
  {
    idAgenda: 2,
    idBox: 1,
    boxNombre: "Box 1",
    idMedico: 2,
    medicoNombre: "Felipe Vázquez",
    idEspecialidad: 1,
    especialidadNombre: "Cardiología",
    idEstado: 2,
    estadoNombre: "No atendido",
    fecha: "2025-09-15",
    horaInicio: "16:00",
    horaFin: "17:00",
    tipoConsulta: "Médica"
  },
  // Agrega más registros si es necesario
];

// Función para insertar agenda
async function insertAgenda() {
  for (const item of agenda) {
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-agenda',  // Nombre correcto de la tabla
      Item: {
        PK: { S: `BOX#${item.idBox}#DATE#${item.fecha}` },
        SK: { S: item.horaInicio },
        idAgenda: { N: String(item.idAgenda) },
        idBox: { N: String(item.idBox) },
        boxNombre: { S: item.boxNombre },
        idMedico: { N: String(item.idMedico) },
        medicoNombre: { S: item.medicoNombre },
        idEspecialidad: { N: String(item.idEspecialidad) },
        especialidadNombre: { S: item.especialidadNombre },
        idEstado: { N: String(item.idEstado) },
        estadoNombre: { S: item.estadoNombre },
        fecha: { S: item.fecha },
        horaInicio: { S: item.horaInicio },
        horaFin: { S: item.horaFin },
        tipoConsulta: { S: item.tipoConsulta },
        GSI1PK: { S: `MEDICO#${item.idMedico}#DATE#${item.fecha}` },
        GSI1SK: { S: item.horaInicio },
        GSI2PK: { S: `DATE#${item.fecha}` },
        GSI2SK: { S: item.horaInicio }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Llamada a la función de inserción
(async () => {
  try {
    await insertAgenda();
    console.log("Agenda insertada exitosamente.");
  } catch (error) {
    console.error("Error insertando agenda:", error);
  }
})();
