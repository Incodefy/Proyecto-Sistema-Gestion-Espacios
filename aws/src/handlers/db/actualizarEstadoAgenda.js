const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambda = new LambdaClient();

module.exports.handler = async (event) => {
  let body;

  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Body inválido o vacío" })
    };
  }

  const { idAgenda, nuevoEstado } = body;

  if (!idAgenda || nuevoEstado === undefined || nuevoEstado === null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar { idAgenda, nuevoEstado }" })
    };
  }

  const estadoNum = Number(nuevoEstado);
  if (Number.isNaN(estadoNum)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "nuevoEstado debe ser numérico" })
    };
  }

  const invokeResult = await lambda.send(
    new InvokeCommand({
      FunctionName: `${process.env.SERVICE_NAME}-${process.env.STAGE}-obtenerAgendaPorId`,
      Payload: Buffer.from(JSON.stringify({
        queryStringParameters: { idAgenda }
      }))
    })
  );

  const payload = JSON.parse(new TextDecoder().decode(invokeResult.Payload));

  if (payload.statusCode !== 200) {
    return {
      statusCode: payload.statusCode,
      body: payload.body
    };
  }

  const agenda = JSON.parse(payload.body);

  const params = {
    TableName: process.env.DB_AGENDA,
    Key: {
      PK: agenda.PK,
      SK: agenda.SK
    },
    UpdateExpression: "SET idEstado = :estado",
    ExpressionAttributeValues: {
      ":estado": estadoNum
    },
    ReturnValues: "UPDATED_NEW"
  };

  try {
    const result = await dynamo.send(new UpdateCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify({
        mensaje: "Estado actualizado correctamente",
        updated: result.Attributes,
        pk: agenda.PK,
        sk: agenda.SK
      })
    };

  } catch (err) {
    console.error("Error actualizando estado agenda:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error actualizando agenda" })
    };
  }
};
