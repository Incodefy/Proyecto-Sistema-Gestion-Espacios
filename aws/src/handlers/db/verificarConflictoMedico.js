const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { successResponse, errorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'verificarConflictoOcupante' });
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const endTrace = logger.startTrace('verificarConflictoOcupante');
    const { occupant_id, fecha, hora_inicio, hora_fin } = event.queryStringParameters || {};

    if (!occupant_id || !fecha || !hora_inicio || !hora_fin) {
        logger.warn("Parámetros faltantes", { occupant_id, fecha, hora_inicio, hora_fin });
        endTrace();
        return errorResponse("Faltan parámetros obligatorios: occupant_id, fecha, hora_inicio, hora_fin", 400);
    }

    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
        logger.warn("Formato de fecha inválido", { fecha });
        endTrace();
        return errorResponse("Fecha debe tener formato YYYY-MM-DD", 400);
    }

    const horaRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fin)) {
        logger.warn("Formato de hora inválido", { hora_inicio, hora_fin });
        endTrace();
        return errorResponse("Las horas deben tener el formato HH:mm", 400);
    }

    const [horaInicioH, horaInicioM] = hora_inicio.split(":").map(Number);
    const [horaFinH, horaFinM] = hora_fin.split(":").map(Number);
    if (horaInicioH > horaFinH || (horaInicioH === horaFinH && horaInicioM >= horaFinM)) {
        logger.warn("Hora de inicio mayor o igual a hora de fin", { hora_inicio, hora_fin });
        endTrace();
        return errorResponse("La hora de inicio no puede ser mayor o igual a la hora de fin", 400);
    }

    try {
        logger.info("Verificando conflicto de ocupante", { occupant_id, fecha, hora_inicio, hora_fin });
        
        const params = {
            TableName: process.env.DB_AGENDA,
            IndexName: "MedicoFechaIndex",
            KeyConditionExpression: "GSI1PK = :pk AND GSI1SK BETWEEN :hIni AND :hFin",
            ExpressionAttributeValues: {
                ":pk": `${occupant_id}#DATE#${fecha}`,
                ":hIni": hora_inicio,
                ":hFin": hora_fin
            }
        };

        const data = await client.send(new QueryCommand(params));

        const conflictos = data.Items.filter(agenda => {
            const agendaHoraInicio = agenda.horaInicio;
            const agendaHoraFin = agenda.horaFin;
            return (hora_inicio < agendaHoraFin && hora_fin > agendaHoraInicio);
        });

        const hasConflicto = conflictos.length > 0;
        
        logger.info("Verificación de conflicto completada", { 
            occupant_id, 
            fecha, 
            conflicto: hasConflicto,
            conflictosCount: conflictos.length
        });
        endTrace();

        return successResponse({ 
            conflicto: hasConflicto, 
            conflictos: hasConflicto ? conflictos : undefined 
        });
        
    } catch (err) {
        logger.error("Error verificando conflicto de ocupante", err, { occupant_id, fecha });
        endTrace();
        return errorResponse("Error verificando conflicto de ocupante", 500, { details: err.message });
    }
};
