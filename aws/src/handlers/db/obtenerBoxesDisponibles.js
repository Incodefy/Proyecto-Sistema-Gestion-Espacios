const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  let body = null;

  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "El body debe ser un JSON válido." })
      };
    }
  }

  const boxes = body?.boxes;

  const params = {
    TableName: process.env.DB_CATALOGO
  };

  if (Array.isArray(boxes) && boxes.length > 0) {
    const placeholders = boxes.map((_, i) => `:b${i}`).join(", ");

    params.FilterExpression = `idBox IN (${placeholders})`;

    params.ExpressionAttributeValues = boxes.reduce((acc, box, index) => {
      acc[`:b${index}`] = box;
      return acc;
    }, {});
  }

  try {
    const data = await client.send(new ScanCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items || [])
    };

  } catch (err) {
    console.error("Error obteniendo boxes disponibles:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error obteniendo boxes disponibles"
      })
    };
  }
};
