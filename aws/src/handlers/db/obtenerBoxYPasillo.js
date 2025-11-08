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
        body: JSON.stringify({ error: `BOX#${boxId} no existe` })
      };
    }

    const item = {
      idBox: data.Item.idBox,
      nombre: data.Item.nombre,
      estado: data.Item.estado,
      idPasillo: data.Item.idPasillo,
      pasilloNombre: data.Item.pasilloNombre
    };

    return {
      statusCode: 200,
      body: JSON.stringify(item)
    };

  } catch (err) {
    console.error("Error DynamoDB obtenerBoxYPasillo:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno obteniendo box" })
    };
  }
};
