const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const boxId = event.queryStringParameters?.boxId;
  const fecha = event.queryStringParameters?.fecha;

  if (!boxId || !fecha) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Debe enviar ?boxId=<valor>&fecha=<YYYY-MM-DD>"
      })
    };
  }

  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!fechaRegex.test(fecha)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "La fecha debe tener formato YYYY-MM-DD." })
    };
  }

  const pk = `BOX#${boxId}#DATE#${fecha}`;

  const params = {
    TableName: process.env.DB_AGENDA,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": pk
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items || [])
    };

  } catch (err) {
    console.error("Error obteniendo agendas por box y fecha:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error obteniendo agendas por box y fecha."
      })
    };
  }
};
