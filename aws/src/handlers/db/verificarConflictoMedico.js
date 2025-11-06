const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

module.exports.handler = async (event) => {
    const { medico_id, fecha, hora_inicio, hora_fin } = event.queryStringParameters;

    if (!medico_id || !fecha || !hora_inicio || !hora_fin) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Faltan parámetros obligatorios: medico_id, fecha, hora_inicio, hora_fin." })
        };
    }

    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!fechaRegex.test(fecha)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Fecha debe tener formato YYYY-MM-DD." })
        };
    }

    const horaRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fin)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Las horas deben tener el formato HH:mm." })
        };
    }

    const [horaInicioH, horaInicioM] = hora_inicio.split(":").map(Number);
    const [horaFinH, horaFinM] = hora_fin.split(":").map(Number);
    if (horaInicioH > horaFinH || (horaInicioH === horaFinH && horaInicioM >= horaFinM)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "La hora de inicio no puede ser mayor o igual a la hora de fin." })
        };
    }

    const params = {
        TableName: process.env.DB_AGENDA,
        IndexName: "MedicoFechaIndex",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK BETWEEN :hIni AND :hFin",
        ExpressionAttributeValues: {
            ":pk": `MEDICO#${medico_id}#DATE#${fecha}`,
            ":hIni": hora_inicio,
            ":hFin": hora_fin
        }
    };

    try {
        const data = await client.send(new QueryCommand(params));

        const conflictos = data.Items.filter(agenda => {
            const agendaHoraInicio = agenda.horaInicio;
            const agendaHoraFin = agenda.horaFin;

        return (hora_inicio < agendaHoraFin && hora_fin > agendaHoraInicio);
        });

        if (conflictos.length > 0) {
        return {
            statusCode: 200,
            body: JSON.stringify({ conflicto: true, conflictos })
        };
        } else {
        return {
            statusCode: 200,
            body: JSON.stringify({ conflicto: false })
        };
        }
    } catch (err) {
        console.error("Error verificando conflicto de box:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error verificando conflicto de box" })
        };
    }
};
