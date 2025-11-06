const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

// Datos de especialidades y médicos (los mismos que has mostrado antes)
const especialidades = [
  { idEspecialidad: 1, nombre: 'Cardiología' },
  { idEspecialidad: 2, nombre: 'Pediatría' },
  { idEspecialidad: 3, nombre: 'Ginecología' },
  { idEspecialidad: 4, nombre: 'Traumatología' },
  { idEspecialidad: 5, nombre: 'Dermatología' },
  { idEspecialidad: 6, nombre: 'Neurología' }
];

const medicos = [
  { idMedico: 1, nombre: 'Felipe Vázquez', idEspecialidad: 1 },
  { idMedico: 2, nombre: 'Matías Sandoval', idEspecialidad: 1 },
  { idMedico: 3, nombre: 'David Hernández', idEspecialidad: 1 },
  { idMedico: 4, nombre: 'Ignacia Herrera', idEspecialidad: 2 },
  { idMedico: 5, nombre: 'Carla Soto', idEspecialidad: 3 },
  { idMedico: 6, nombre: 'Tomás Rivas', idEspecialidad: 3 },
  { idMedico: 7, nombre: 'Camila Loyola', idEspecialidad: 3 },
  { idMedico: 8, nombre: 'Rodrigo Salas', idEspecialidad: 3 },
  { idMedico: 9, nombre: 'Paula Araya', idEspecialidad: 4 },
  { idMedico: 10, nombre: 'Ignacio Fuentes', idEspecialidad: 4 },
  { idMedico: 11, nombre: 'Matías Leiva', idEspecialidad: 4 },
  { idMedico: 12, nombre: 'Camila Barrera', idEspecialidad: 5 },
  { idMedico: 13, nombre: 'Laura Zamora', idEspecialidad: 5 },
  { idMedico: 14, nombre: 'Pablo Santander', idEspecialidad: 5 },
  { idMedico: 15, nombre: 'Isidora Palma', idEspecialidad: 6 },
  { idMedico: 16, nombre: 'Alejandro Cortés', idEspecialidad: 6 },
  { idMedico: 17, nombre: 'José Luis Marín', idEspecialidad: 2 },
  { idMedico: 18, nombre: 'Diego Cifuentes', idEspecialidad: 1 },
  { idMedico: 19, nombre: 'Álvaro Torres', idEspecialidad: 1 }
];

// Función para insertar especialidades
async function insertEspecialidades() {
  for (const especialidad of especialidades) {
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-catalogo',  // Nombre correcto de la tabla
      Item: {
        PK: { S: `ESP#${especialidad.idEspecialidad}` },
        SK: { S: '#' },
        idEspecialidad: { N: String(especialidad.idEspecialidad) },
        nombre: { S: especialidad.nombre }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Función para insertar médicos
async function insertMedicos() {
  for (const medico of medicos) {
    const especialidad = especialidades.find(e => e.idEspecialidad === medico.idEspecialidad);
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-catalogo',  // Nombre correcto de la tabla
      Item: {
        PK: { S: `MEDICO#${medico.idMedico}` },
        SK: { S: '#' },
        idMedico: { N: String(medico.idMedico) },
        nombre: { S: medico.nombre },
        idEspecialidad: { N: String(medico.idEspecialidad) },
        especialidadNombre: { S: especialidad.nombre },
        GBEPK: { S: `ESP#${medico.idEspecialidad}` },
        GBESK: { S: medico.nombre }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Llamadas a las funciones
(async () => {
  try {
    await insertEspecialidades();
    await insertMedicos();
    console.log("Datos insertados exitosamente.");
  } catch (error) {
    console.error("Error insertando datos:", error);
  }
})();
