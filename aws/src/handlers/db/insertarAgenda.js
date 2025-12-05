const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { validate, schemas } = require("../../utils/validator");
const { ValidationError, DuplicateError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const insertarAgenda = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'insertarAgenda' });
  
  if (!event.body) throw new ValidationError('Debe enviar un body con la agenda', 'MISSING_BODY');

  let agendaInput;
  try {
    agendaInput = JSON.parse(event.body);
  } catch (err) {
    throw new ValidationError('El body debe ser JSON válido', 'INVALID_JSON');
  }

  // Validar estructura con esquemas básicos
  const {
    idAgenda, idSpace, spaceName, idOccupant, occupantName,
    idEspecialidad, especialidadNombre, idEstado, estadoNombre,
    fecha, horaInicio, horaFin, tipoConsulta
  } = agendaInput;

  if (!idAgenda || !idSpace || !fecha || !horaInicio || !horaFin) {
    throw new ValidationError('Faltan campos obligatorios', 'MISSING_FIELDS');
  }

  // Validar rango horario
  const horaInicioNorm = String(horaInicio).startsWith("HORA#") 
    ? String(horaInicio).split("#")[1] 
    : String(horaInicio);
    
  const [hI, mI] = horaInicioNorm.split(":").map(Number);
  const [hF, mF] = horaFin.split(":").map(Number);
  if (hI > hF || (hI === hF && mI >= mF)) {
    throw new ValidationError('horaInicio debe ser menor que horaFin', 'INVALID_TIME_RANGE');
  }

  const item = {
    PK: `${idSpace}#DATE#${fecha}`,
    SK: horaInicioNorm,
    idAgenda: String(idAgenda),
    idSpace: String(idSpace),
    spaceName,
    idOccupant: String(idOccupant),
    occupantName,
    idEspecialidad: String(idEspecialidad),
    especialidadNombre,
    idEstado: Number(idEstado),
    estadoNombre,
    fecha,
    horaInicio: horaInicioNorm,
    horaFin,
    tipoConsulta,
    GSI1PK: `${idOccupant}#DATE#${fecha}`,
    GSI1SK: horaInicioNorm,
    GSI2PK: `DATE#${fecha}`,
    GSI2SK: horaInicioNorm
  };

  try {
    await retryDB(
      () => client.send(new PutCommand({
        TableName: process.env.DB_AGENDA,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
      })),
      { operation: 'insertarAgenda', idAgenda, fecha }
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      logger.warn('Agenda duplicada detectada', { fecha, espacio: idSpace, hora: horaInicioNorm });
      throw new DuplicateError('Agenda', `${idSpace}#${fecha}#${horaInicioNorm}`);
    }
    throw err;
  }

  logger.info('Agenda insertada exitosamente', { 
    idAgenda, fecha, ocupante: occupantName, espacio: spaceName 
  });

  return successResponse({ mensaje: "Agenda insertada correctamente", item }, 201);
};

module.exports.handler = createAPIHandler(insertarAgenda, { rateLimit: { maxRequests: 40, windowSeconds: 60 } });
