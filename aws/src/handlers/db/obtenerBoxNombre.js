const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const boxId = event.queryStringParameters?.boxId;

  if (!boxId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar ?boxId=valor" })
    };
  }

  const params = {
    TableName: process.env.DB_CATALOGO,
    Key: {
      PK: `BOX#${boxId}`,
      SK: "#"
    }
  };

  try {
    const data = await client.send(new GetCommand(params));

    if (!data.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Box ${boxId} no encontrado` })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ nombre: data.Item.nombre || null })
    };

  } catch (err) {
    console.error("Error obteniendo box:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error obteniendo box" })
    };
  }
};
