const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

// Datos de instrumentos y su relación con los boxes
const instrumentos = [
  { idInstrumento: 1, nombre: 'Estetoscopio', tipo: 'MEDICO' },
  { idInstrumento: 2, nombre: 'Lámpara de exploración', tipo: 'INMOBILIARIO' },
  { idInstrumento: 3, nombre: 'Tensiómetro', tipo: 'MEDICO' },
  { idInstrumento: 4, nombre: 'Otoscopio', tipo: 'MEDICO' },
  { idInstrumento: 5, nombre: 'Termómetro', tipo: 'MEDICO' },
  { idInstrumento: 6, nombre: 'Oftalmoscopio', tipo: 'MEDICO' },
  { idInstrumento: 7, nombre: 'Linterna clínica', tipo: 'MEDICO' },
  { idInstrumento: 8, nombre: 'Cinta métrica', tipo: 'MEDICO' },
  { idInstrumento: 9, nombre: 'Martillo de reflejos', tipo: 'MEDICO' },
  { idInstrumento: 10, nombre: 'Guantes desechables', tipo: 'MEDICO' },
  { idInstrumento: 11, nombre: 'Camilla', tipo: 'INMOBILIARIO' },
  { idInstrumento: 12, nombre: 'Escritorio médico', tipo: 'INMOBILIARIO' },
  { idInstrumento: 13, nombre: 'Silla para paciente', tipo: 'INMOBILIARIO' },
  { idInstrumento: 14, nombre: 'Gabinete clínico', tipo: 'INMOBILIARIO' },
  { idInstrumento: 15, nombre: 'Basurero clínico', tipo: 'INMOBILIARIO' },
  { idInstrumento: 16, nombre: 'Lavamano', tipo: 'INMOBILIARIO' },
  { idInstrumento: 17, nombre: 'Porta guantes/toallas', tipo: 'INMOBILIARIO' },
  { idInstrumento: 18, nombre: 'Biombo', tipo: 'INMOBILIARIO' }
];

const boxInstrumentos = [
  { idBox: 1, idInstrumento: 2, cantidad: 1 },
  { idBox: 1, idInstrumento: 3, cantidad: 1 },
  { idBox: 1, idInstrumento: 4, cantidad: 1 },
  { idBox: 1, idInstrumento: 5, cantidad: 1 },
  { idBox: 1, idInstrumento: 6, cantidad: 1 },
  { idBox: 1, idInstrumento: 7, cantidad: 1 },
  { idBox: 1, idInstrumento: 8, cantidad: 1 },
  { idBox: 1, idInstrumento: 9, cantidad: 1 },
  { idBox: 1, idInstrumento: 10, cantidad: 2 },
  { idBox: 1, idInstrumento: 11, cantidad: 1 },
  { idBox: 1, idInstrumento: 12, cantidad: 1 },
];

// Función para insertar instrumentos
async function insertInstrumentos() {
  for (const instrumento of instrumentos) {
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-catalogo', // Nombre de la tabla de catalogo
      Item: {
        PK: { S: `INSTR#${instrumento.idInstrumento}` },
        SK: { S: '#' },
        idInstrumento: { N: String(instrumento.idInstrumento) },
        nombre: { S: instrumento.nombre },
        tipo: { S: instrumento.tipo }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Función para insertar los instrumentos por box
async function insertBoxInstrumentos() {
  for (const boxInst of boxInstrumentos) {
    const instrumento = instrumentos.find(i => i.idInstrumento === boxInst.idInstrumento);
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-box-instrumento', // Nombre de la tabla de relaciones Box-Instrumento
      Item: {
        PK: { S: `BOX#${boxInst.idBox}` },
        SK: { S: `INSTR#${boxInst.idInstrumento}` },
        cantidad: { N: String(boxInst.cantidad) },
        instrumentoNombre: { S: instrumento.nombre },
        instrumentoTipo: { S: instrumento.tipo }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Llamadas a las funciones
(async () => {
  try {
    await insertInstrumentos();
    await insertBoxInstrumentos();
    console.log("Instrumentos y relaciones Box-Instrumento insertados exitosamente.");
  } catch (error) {
    console.error("Error insertando instrumentos y relaciones:", error);
  }
})();
