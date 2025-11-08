const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async () => {
  const params = {
    TableName: process.env.DB_NOTIFICACION,
    Limit: 50
  };

  try {
    const data = await client.send(new ScanCommand(params));

    const items = data.Items || [];

    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    return {
      statusCode: 200,
      body: JSON.stringify(items)
    };

  } catch (err) {
    console.error("Error obteniendo notificaciones:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error obteniendo notificaciones" })
    };
  }
};
