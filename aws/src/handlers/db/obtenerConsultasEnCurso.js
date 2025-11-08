const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  const { hora_actual, estadosPermitidos } = event.queryStringParameters;

  if (!hora_actual || !estadosPermitidos || estadosPermitidos.length !== 2) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar hora_actual y 2 estados permitidos." })
    };
  }

  const hoy = new Date();
  hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
  const fechaFormateada = hoy.toISOString().split("T")[0];

  console.log("Fecha correcta:", fechaFormateada);
  console.log("Hora actual:", hora_actual);
  console.log("Estados permitidos:", estadosPermitidos);

  // 3. Parámetros para DynamoDB
  const params = {
    TableName: process.env.DB_AGENDA,
    IndexName: "FechaIndex",
    KeyConditionExpression: "GSI2PK = :fecha",
    FilterExpression:
      "idEstado IN (:estado1, :estado2) AND horaInicio <= :hora_actual AND horaFin > :hora_actual",
    ExpressionAttributeValues: {
      ":fecha": `DATE#${fechaFormateada}`,
      ":estado1": estadosPermitidos[0],
      ":estado2": estadosPermitidos[1],
      ":hora_actual": hora_actual,
    }
  };

  try {
    const data = await client.send(new QueryCommand(params));

    return {
      statusCode: 200,
      body: JSON.stringify(data.Items || [])
    };

  } catch (err) {
    console.error("Error obteniendo consultas en curso:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error obteniendo consultas en curso"
      })
    };
  }
};
