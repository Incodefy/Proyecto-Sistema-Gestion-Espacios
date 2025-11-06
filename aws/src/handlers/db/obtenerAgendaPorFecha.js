const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const fecha = event.queryStringParameters?.fecha;

    if (!fecha) {
        return {
        statusCode: 400,
        body: JSON.stringify({ error: "Debe enviar ?fecha=YYYY-MM-DD" })
        };
    }

  const params = {
    TableName: process.env.DB_AGENDA,
    IndexName: "FechaIndex",
    KeyConditionExpression: "GSI2PK = :fecha",
    ExpressionAttributeValues: {
      ":fecha": `DATE#${fecha}`
    }
  };

  try {
    const result = await client.send(new QueryCommand(params));
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items || [])
    };
  } catch (err) {
    console.error("Error Dynamo:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error obteniendo agenda" })
    };
  }
};
