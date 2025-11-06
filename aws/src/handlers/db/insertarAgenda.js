const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Debe enviar un body con la agenda." })
    };
  }

  let agendaInput;
  try {
    agendaInput = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "El body debe ser un JSON válido." })
    };
  }

  const {
    idAgenda,
    idBox,
    boxNombre,
    idMedico,
    medicoNombre,
    idEspecialidad,
    especialidadNombre,
    idEstado,
    estadoNombre,
    fecha,
    horaInicio,
    horaFin,
    tipoConsulta
  } = agendaInput;

  const required = {
    idAgenda, idBox, boxNombre, idMedico, medicoNombre,
    idEspecialidad, especialidadNombre, idEstado, estadoNombre,
    fecha, horaInicio, horaFin, tipoConsulta
  };

  for (const [key, value] of Object.entries(required)) {
    if (value === undefined || value === null || value === "") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `El campo '${key}' es obligatorio.` })
      };
    }
  }

  const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!fechaRegex.test(fecha)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "La fecha debe tener formato YYYY-MM-DD." })
    };
  }

  const horaRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!horaRegex.test(horaInicio) || !horaRegex.test(horaFin)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Las horas deben estar en formato HH:mm." })
    };
  }

  const [hI, mI] = horaInicio.split(":").map(Number);
  const [hF, mF] = horaFin.split(":").map(Number);
  if (hI > hF || (hI === hF && mI >= mF)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "horaInicio debe ser menor que horaFin." })
    };
  }

  const skHora = String(horaInicio).startsWith("HORA#")
    ? String(horaInicio).split("#")[1]
    : String(horaInicio);

  const item = {
    PK: `BOX#${idBox}#DATE#${fecha}`,
    SK: skHora,

    idAgenda: Number(idAgenda),
    idBox: Number(idBox),
    boxNombre,
    idMedico: Number(idMedico),
    medicoNombre,
    idEspecialidad: Number(idEspecialidad),
    especialidadNombre,
    idEstado: Number(idEstado),
    estadoNombre,
    fecha,
    horaInicio: skHora,
    horaFin,
    tipoConsulta,

    GSI1PK: `MEDICO#${idMedico}#DATE#${fecha}`,
    GSI1SK: skHora,
    GSI2PK: `DATE#${fecha}`,
    GSI2SK: skHora
  };

  const params = {
    TableName: process.env.DB_AGENDA,
    Item: item,
    ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
  };

  try {
    await client.send(new PutCommand(params));

    return {
      statusCode: 201,
      body: JSON.stringify({
        mensaje: "Agenda insertada correctamente",
        item
      })
    };

  } catch (err) {
    console.error("Error insertando agenda:", err);

    if (err.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: "Ya existe una agenda en ese horario para ese box." })
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error insertando agenda" })
    };
  }
};
