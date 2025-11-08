const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  let especialidades;
  
  try {
    const body = JSON.parse(event.body || "{}");
    especialidades = body.especialidades;
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "El body debe ser un JSON válido con la lista de especialidades." })
    };
  }

  if (!Array.isArray(especialidades) || especialidades.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar una lista de especialidades." })
    };
  }

  const params = {
    TableName: process.env.DB_CATALOGO,
    FilterExpression: "begins_with(PK, :pk)",
    ExpressionAttributeValues: {
      ":pk": "MEDICO#"
    }
  };

  try {
    const data = await client.send(new ScanCommand(params));

    const medicoIds = data.Items
      .filter(item => especialidades.includes(item.idEspecialidad))
      .map(item => item.idMedico);

    return {
      statusCode: 200,
      body: JSON.stringify(medicoIds)
    };

  } catch (err) {
    console.error("Error obteniendo médicos por especialidad:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error obteniendo médicos por especialidad" })
    };
  }
};
