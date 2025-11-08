const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const idAgenda = event.queryStringParameters?.idAgenda;

  if (!idAgenda) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar ?idAgenda=valor" })
    };
  }

  const params = {
    TableName: process.env.DB_AGENDA,
    IndexName: "GSI3_IdAgenda",
    KeyConditionExpression: "GSI3PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `IDAGENDA#${idAgenda}`
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));

    if (!data.Items || data.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Agenda no encontrada" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items[0])
    };

  } catch (err) {
    console.error("Error obtenerAgendaPorId:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error interno obteniendo agenda" })
    };
  }
};
