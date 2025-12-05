const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse } = require("../../utils/response");
const Logger = require("../../utils/logger");
const { retryDB } = require("../../utils/retry");
const { ValidationError } = require("../../utils/errors");
const { createAPIHandler } = require("../../middleware/interceptors");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const verificarConflictoMedico = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'verificarConflictoMedico' });
  const { occupant_id, fecha, hora_inicio, hora_fin } = event.queryStringParameters || {};
  
  if (!occupant_id || !fecha || !hora_inicio || !hora_fin) {
    throw new ValidationError('Faltan parámetros: occupant_id, fecha, hora_inicio, hora_fin', 'MISSING_PARAMS');
  }

  // Validar formato fecha YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new ValidationError('Fecha debe tener formato YYYY-MM-DD', 'INVALID_DATE_FORMAT');
  }

  // Validar formato hora HH:mm
  if (!/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(hora_inicio) || 
      !/^([01]?[0-9]|2[0-3]):([0-5][0-9])$/.test(hora_fin)) {
    throw new ValidationError('Las horas deben tener formato HH:mm', 'INVALID_TIME_FORMAT');
  }

  // Validar rango horario
  const [hI, mI] = hora_inicio.split(":").map(Number);
  const [hF, mF] = hora_fin.split(":").map(Number);
  if (hI > hF || (hI === hF && mI >= mF)) {
    throw new ValidationError('hora_inicio debe ser menor que hora_fin', 'INVALID_TIME_RANGE');
  }

  const data = await retryDB(
    () => client.send(new QueryCommand({
      TableName: process.env.DB_AGENDA,
      IndexName: "MedicoFechaIndex",
      KeyConditionExpression: "GSI1PK = :pk AND GSI1SK BETWEEN :hIni AND :hFin",
      ExpressionAttributeValues: {
        ":pk": `${occupant_id}#DATE#${fecha}`,
        ":hIni": hora_inicio,
        ":hFin": hora_fin
      }
    })),
    { operation: 'verificarConflictoMedico', occupant_id, fecha }
  );

  const conflictos = data.Items.filter(agenda => {
    const agendaHoraInicio = agenda.horaInicio;
    const agendaHoraFin = agenda.horaFin;
    return (hora_inicio < agendaHoraFin && hora_fin > agendaHoraInicio);
  });

  const hasConflicto = conflictos.length > 0;
  logger.info('Verificación de conflicto completada', { 
    occupant_id, fecha, conflicto: hasConflicto, conflictosCount: conflictos.length 
  });

  return successResponse({ 
    conflicto: hasConflicto, 
    conflictos: hasConflicto ? conflictos : undefined 
  });
};

module.exports.handler = createAPIHandler(verificarConflictoMedico, { rateLimit: { maxRequests: 100, windowSeconds: 60 } }); 
            conflictos: hasConflicto ? conflictos : undefined 
        });
        
    } catch (err) {
        logger.error("Error verificando conflicto de ocupante", err, { occupant_id, fecha });
        endTrace();
        return errorResponse("Error verificando conflicto de ocupante", 500, { details: err.message });
    }
};
