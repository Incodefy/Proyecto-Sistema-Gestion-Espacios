const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

// Estados de tu sistema
const estados = [
  { idEstado: 1, nombre: "Atendido" },
  { idEstado: 2, nombre: "No atendido" }
];

async function insertEstados() {
  for (const estado of estados) {
    const params = {
      TableName: "aws-cognito-jwt-login-dev-catalogo",
      Item: {
        PK: { S: `ESTADO#${estado.idEstado}` },
        SK: { S: "#" },
        idEstado: { N: String(estado.idEstado) },
        nombre: { S: estado.nombre }
      }
    };

    await client.send(new PutItemCommand(params));
  }
}

(async () => {
  try {
    await insertEstados();
    console.log("Estados insertados correctamente.");
  } catch (error) {
    console.error("Error insertando estados:", error);
  }
})();
