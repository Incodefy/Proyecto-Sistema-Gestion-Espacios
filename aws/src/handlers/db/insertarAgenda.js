const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse, validationErrorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const logger = createLogger({ handler: 'insertarAgenda' });

module.exports.handler = async (event) => {
  const endTrace = logger.startTrace('insert-agenda');
  
  if (!event.body) {
    logger.warn('Missing request body');
    endTrace({ success: false, reason: 'no_body' });
    return errorResponse('Debe enviar un body con la agenda', 400);
  }

  let agendaInput;
  try {
    agendaInput = JSON.parse(event.body);
  } catch (err) {
    logger.error('Invalid JSON in body', err);
    endTrace({ success: false, reason: 'invalid_json' });
    return errorResponse('El body debe ser un JSON válido', 400);
  }

  // Validar con AJV
  const validation = validate(agendaInput, 'insertarAgenda');
  if (!validation.valid) {
    logger.warn('Validation failed', { errors: validation.errors });
    endTrace({ success: false, reason: 'validation' });
    return validationErrorResponse(validation.errors);
  }

  const {
    idAgenda, idBox, boxNombre, idMedico, medicoNombre,
    idEspecialidad, especialidadNombre, idEstado, estadoNombre,
    fecha, horaInicio, horaFin, tipoConsulta
  } = validation.data;

  // Validación adicional: horaInicio < horaFin
  const [hI, mI] = horaInicio.replace('HORA#', '').split(":").map(Number);
  const [hF, mF] = horaFin.split(":").map(Number);
  if (hI > hF || (hI === hF && mI >= mF)) {
    logger.warn('Invalid time range', { horaInicio, horaFin });
    endTrace({ success: false, reason: 'invalid_time_range' });
    return errorResponse('horaInicio debe ser menor que horaFin', 400);
  }

  // Normalizar horaInicio (eliminar prefijo HORA# si existe)
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
    
    logger.info('Agenda inserted successfully', { 
      idAgenda, 
      fecha, 
      medico: medicoNombre,
      box: boxNombre 
    });
    endTrace({ success: true });

    return successResponse({
      mensaje: "Agenda insertada correctamente",
      item
    }, 201);

  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      logger.warn('Duplicate agenda detected', { fecha, box: idBox, hora: skHora });
      endTrace({ success: false, reason: 'duplicate' });
      return errorResponse('Ya existe una agenda en ese horario para ese box', 409);
    }

    logger.error('Failed to insert agenda', err, { idAgenda, fecha });
    endTrace({ success: false, error: err.message });
    return errorResponse('Error insertando agenda', 500);
  }
};
