const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: 'us-east-1' });

// Datos de pasillos y boxes (con la información de tus tablas)
const pasillos = [
  { idPasillo: 1, nombre: 'Pasillo 1' },
  { idPasillo: 2, nombre: 'Pasillo 2' },
  { idPasillo: 3, nombre: 'Pasillo 3' }
];

const boxes = [
  { idBox: 1, nombre: 'Box 1', estado: 1, idPasillo: 1 },
  { idBox: 2, nombre: 'Box 2', estado: 0, idPasillo: 1 },
  { idBox: 3, nombre: 'Box 3', estado: 1, idPasillo: 1 },
  { idBox: 4, nombre: 'Box 4', estado: 1, idPasillo: 1 },
  { idBox: 5, nombre: 'Box 5', estado: 1, idPasillo: 1 },
  { idBox: 6, nombre: 'Box 6', estado: 1, idPasillo: 1 },
  { idBox: 7, nombre: 'Box 7', estado: 1, idPasillo: 1 },
  { idBox: 8, nombre: 'Box 8', estado: 0, idPasillo: 1 },
  { idBox: 9, nombre: 'Box 9', estado: 1, idPasillo: 1 },
  { idBox: 10, nombre: 'Box 10', estado: 1, idPasillo: 1 },
  { idBox: 11, nombre: 'Box 11', estado: 1, idPasillo: 1 },
  { idBox: 12, nombre: 'Box 12', estado: 1, idPasillo: 2 },
  { idBox: 13, nombre: 'Box 13', estado: 1, idPasillo: 2 },
  { idBox: 14, nombre: 'Box 14', estado: 1, idPasillo: 2 },
  { idBox: 15, nombre: 'Box 15', estado: 1, idPasillo: 2 },
  { idBox: 16, nombre: 'Box 16', estado: 1, idPasillo: 2 },
  { idBox: 17, nombre: 'Box 17', estado: 1, idPasillo: 2 },
  { idBox: 18, nombre: 'Box 18', estado: 1, idPasillo: 2 },
  { idBox: 19, nombre: 'Box 19', estado: 1, idPasillo: 2 },
  { idBox: 20, nombre: 'Box 20', estado: 1, idPasillo: 2 },
  { idBox: 21, nombre: 'Box 21', estado: 1, idPasillo: 2 },
  { idBox: 22, nombre: 'Box 22', estado: 1, idPasillo: 2 },
  { idBox: 23, nombre: 'Box 23', estado: 1, idPasillo: 3 },
  { idBox: 24, nombre: 'Box 24', estado: 1, idPasillo: 3 },
  { idBox: 25, nombre: 'Box 25', estado: 1, idPasillo: 3 },
  { idBox: 26, nombre: 'Box 26', estado: 1, idPasillo: 3 },
  { idBox: 27, nombre: 'Box 27', estado: 1, idPasillo: 3 },
  { idBox: 28, nombre: 'Box 28', estado: 1, idPasillo: 3 },
  { idBox: 29, nombre: 'Box 29', estado: 1, idPasillo: 3 }
];

// Función para insertar pasillos
async function insertPasillos() {
  for (const pasillo of pasillos) {
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-catalogo', // Nombre correcto de la tabla
      Item: {
        PK: { S: `PASILLO#${pasillo.idPasillo}` },
        SK: { S: '#' },
        idPasillo: { N: String(pasillo.idPasillo) },
        nombre: { S: pasillo.nombre }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Función para insertar boxes
async function insertBoxes() {
  for (const box of boxes) {
    const pasillo = pasillos.find(p => p.idPasillo === box.idPasillo);
    const params = {
      TableName: 'aws-cognito-jwt-login-dev-catalogo', // Nombre correcto de la tabla
      Item: {
        PK: { S: `BOX#${box.idBox}` },
        SK: { S: '#' },
        idBox: { N: String(box.idBox) },
        nombre: { S: box.nombre },
        estado: { N: String(box.estado) },
        idPasillo: { N: String(box.idPasillo) },
        pasilloNombre: { S: pasillo.nombre },
        GBPPK: { S: `PASILLO#${box.idPasillo}` },
        GBPSK: { S: box.nombre }
      }
    };
    await client.send(new PutItemCommand(params));
  }
}

// Llamadas a las funciones
(async () => {
  try {
    await insertPasillos();
    await insertBoxes();
    console.log("Pasillos y boxes insertados exitosamente.");
  } catch (error) {
    console.error("Error insertando pasillos y boxes:", error);
  }
})();
