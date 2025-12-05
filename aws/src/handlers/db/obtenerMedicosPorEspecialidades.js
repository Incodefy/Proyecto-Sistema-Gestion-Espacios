const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require('../../utils/response');
const Logger = require('../../utils/logger');
const { retryDB } = require("../../utils/retry");
const { validate, schemas } = require("../../utils/validator");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const obtenerMedicosPorEspecialidades = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'obtenerMedicosPorEspecialidades' });
  
  let especialidades;
  try {
    const body = JSON.parse(event.body || "{}");
    especialidades = body.especialidades;
  } catch (err) {
    throw new ValidationError('El body debe ser JSON válido con especialidades', 'INVALID_JSON');
  }

  if (!Array.isArray(especialidades) || especialidades.length === 0) {
    throw new ValidationError('Debe enviar una lista de especialidades', 'INVALID_ESPECIALIDADES');
  }

  const data = await retryDB(
    () => client.send(new ScanCommand({
      TableName: process.env.DB_CATALOGO,
      FilterExpression: "begins_with(PK, :pk)",
      ExpressionAttributeValues: { ":pk": "MEDICO#" }
    })),
    { operation: 'obtenerMedicosPorEspecialidades', especialidades }
  );

  const medicoIds = data.Items
    .filter(item => especialidades.includes(item.idEspecialidad))
    .map(item => item.idMedico);

  logger.info('Médicos filtrados por especialidades', { 
    especialidades_count: especialidades.length,
    medicos_count: medicoIds.length 
  });
  
  return successResponse(medicoIds, 200, { count: medicoIds.length });
};

module.exports.handler = createAPIHandler(obtenerMedicosPorEspecialidades, { rateLimit: { maxRequests: 80, windowSeconds: 60 } });
