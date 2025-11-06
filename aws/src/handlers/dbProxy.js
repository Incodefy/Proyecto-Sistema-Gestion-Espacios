const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambda = new LambdaClient();

module.exports.handler = async (event) => {
  const path = event.path;
  let target = null;

  if (path.includes("pasillos")) target = "obtenerPasillos";
  if (path.includes("boxes"))    target = "obtenerBoxes";
  if (path.includes("agenda")) target = "obtenerAgendaPorFecha";
  if (path.includes("especialidades"))    target = "obtenerEspecialidades";
  if (path.includes("medicos"))    target = "obtenerMedicos";
  if (path.includes("agenda-box")) target = "obtenerAgendaPorBox";
  if (path.includes("agenda-medico")) target = "obtenerAgendaPorMedico";
  if (path.includes("conflicto-box")) target = "verificarConflictoBox";
  if (path.includes("conflicto-medico")) target = "verificarConflictoMedico";
  if (path.includes("estado-no-atendido")) target = "obtenerEstadoNoAtendido";
  if (path.includes("insertar-agenda")) target = "insertarAgenda";

  if (!target) {
    return { statusCode: 400, body: JSON.stringify({ error: "Ruta no válida" }) };
  }

  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: `${process.env.SERVICE_NAME}-${process.env.STAGE}-${target}`,
      Payload: Buffer.from(JSON.stringify(event))
    })
  );

  return JSON.parse(Buffer.from(response.Payload));
};
