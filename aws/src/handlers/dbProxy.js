const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambda = new LambdaClient();

module.exports.handler = async (event) => {
  console.log('=== INICIO dbProxy ===');
  console.log('Event completo:', JSON.stringify(event, null, 2));
  
  const path = event.path || event.rawPath; // HTTP API v2 usa rawPath
  console.log('Path recibido:', path);
  
  let target = null;

  if (path.includes("pasillos")) target = "obtenerPasillos";
  if (path.includes("boxes"))    target = "obtenerBoxes";
  if (path.includes("agenda")) target = "obtenerAgendaPorFecha";
  if (path.includes("especialidades"))    target = "obtenerEspecialidades";
  if (path.includes("medicos"))    target = "obtenerMedicos";
  if (path.includes("agenda-box")) target = "obtenerAgendaPorBox";
  if (path.includes("agenda-medico")) target = "obtenerAgendaPorMedico";
  if (path.includes("agenda-id")) target = "obtenerAgendaPorId";
  if (path.includes("conflicto-box")) target = "verificarConflictoBox";
  if (path.includes("conflicto-medico")) target = "verificarConflictoMedico";
  if (path.includes("estado-no-atendido")) target = "obtenerEstadoNoAtendido";
  if (path.includes("insertar-agenda")) target = "insertarAgenda";
  if (path.includes("nuevo-estado-agenda")) target = "actualizarEstadoAgenda";
  if (path.includes("instrumentos-box")) target = "obtenerInstrumentosPorBox";
  if (path.includes("box-pasillo")) target = "obtenerBoxYPasillo";
  if (path.includes("agenda-box-fecha")) target = "obtenerAgendaPorBoxYFecha";
  if (path.includes("notificaciones")) target = "obtenerNotificaciones";
  if (path.includes("medico-nombre")) target = "obtenerMedicoNombre";
  if (path.includes("box-nombre")) target = "obtenerBoxNombre";
  if (path.includes("total-consultas")) target = "obtenerTotalConsultas";
  if (path.includes("boxes-disponibles")) target = "obtenerBoxesDisponibles";
  if (path.includes("especialidad-mas-demandada")) target = "obtenerEspecialidadMasDemandada";
  if (path.includes("consultas-especialidad")) target = "obtenerConsultasPorEspecialidad";
  if (path.includes("consultas-dia")) target = "obtenerConsultasPorDia";
  if (path.includes("rendimiento-medicos")) target = "obtenerRendimientoMedicos";
  if (path.includes("medicos-especialidades")) target = "obtenerMedicosPorEspecialidades";
  if (path.includes("consultas-en-curso")) target = "obtenerConsultasEnCurso";
  if (path.includes("eliminar-agenda")) target = "eliminarAgenda";

  console.log('Target identificado:', target);

  if (!target) {
    console.log('ERROR: Ruta no válida');
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: "Ruta no válida", path: path }) 
    };
  }

  const functionName = `${process.env.SERVICE_NAME}-${process.env.STAGE}-${target}`;
  console.log('Nombre función Lambda a invocar:', functionName);
  console.log('Variables de entorno:', {
    SERVICE_NAME: process.env.SERVICE_NAME,
    STAGE: process.env.STAGE,
    DB_CATALOGO: process.env.DB_CATALOGO
  });

  try {
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(event))
    });

    console.log('Invocando Lambda...');
    const response = await lambda.send(command);
    console.log('Respuesta de Lambda recibida:', {
      StatusCode: response.StatusCode,
      PayloadLength: response.Payload.length
    });

    const result = JSON.parse(Buffer.from(response.Payload).toString());
    console.log('Resultado parseado:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('ERROR al invocar Lambda:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Error invocando función", 
        message: error.message,
        functionName: functionName
      })
    };
  }
};