const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const medicoId = event.queryStringParameters?.medicoId;

  if (!medicoId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar ?medicoId=valor" })
    };
  }

  const params = {
    TableName: process.env.DB_CATALOGO,
    Key: {
      PK: `MEDICO#${medicoId}`,
      SK: "#"
    }
  };

  try {
    const data = await client.send(new GetCommand(params));

    if (!data.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Médico ${medicoId} no encontrado` })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ nombre: data.Item.nombre || null })
    };

  } catch (err) {
    console.error("Error obteniendo médico:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error obteniendo médico" })
    };
  }
};
