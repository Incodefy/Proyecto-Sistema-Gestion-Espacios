/**
 * CQRS CreateAppointment Handler - Usando Command Bus
 * Este handler usa el command bus para ejecutar comandos y generar eventos
 * 
 * UPDATED: Integrado con Async Request-Reply Pattern
 * - Retorna 202 Accepted con operationId y statusUrl
 * - Cliente puede hacer polling en /operations/{operationId}
 * - Operación tracked automáticamente por CommandBus
 */

const { getCommandBus, Commands } = require("../../utils/commandBus");
const { handleCreateAppointment } = require("../../utils/commandHandlers");
const { createAPIHandler } = require("../../middleware/interceptors");
const Logger = require("../../utils/logger");

/**
 * Crear appointment usando CQRS
 */
const createAppointmentCQRS = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'createAppointmentCQRS' });
  
  const body = JSON.parse(event.body || '{}');
  const grupoId = event.pathParameters?.grupo_id;
  
  logger.info('Processing CreateAppointment command', { grupo_id: grupoId });

  // Preparar contexto (ahora incluye connectionId para WebSocket opcional)
  const context = {
    userId: event.requestContext?.authorizer?.jwt?.claims?.sub,
    userEmail: event.requestContext?.authorizer?.jwt?.claims?.email,
    userSub: event.requestContext?.authorizer?.jwt?.claims?.sub,
    correlationId: event.requestContext?.requestId,
    // WebSocket connectionId si existe en headers
    connectionId: event.headers?.['x-websocket-connection'] || event.headers?.['X-WebSocket-Connection']
  };

  // Preparar payload
  const payload = {
    grupo_id: grupoId,
    fecha: body.fecha,
    hora_inicio: body.hora_inicio,
    hora_fin: body.hora_fin,
    espacio: body.espacio_especifico,
    ocupante: body.ocupante,
    especialidad: body.especialidad,
    estado: body.estado,
    tipo_consulta: body.tipo_consulta,
    notas: body.notas
  };

  // Obtener command bus y registrar handler
  const commandBus = getCommandBus();
  if (!commandBus.handlers.has(Commands.CREATE_APPOINTMENT)) {
    commandBus.register(Commands.CREATE_APPOINTMENT, handleCreateAppointment);
  }

  // Ejecutar comando (retorna { operationId, result })
  const { operationId, result } = await commandBus.execute(Commands.CREATE_APPOINTMENT, payload, context);

  logger.info('CreateAppointment command executed', {
    operationId,
    appointmentId: result.appointmentId
  });

  // Construir statusUrl
  const statusUrl = `/operations/${operationId}`;

  return {
    statusCode: 202,  // Accepted - procesamiento asíncrono
    headers: {
      'Location': statusUrl // RFC 7231 - URL del recurso de status
    },
    body: JSON.stringify({
      operationId,
      statusUrl,
      message: 'Appointment creation initiated',
      pollInterval: 2000, // Recomendación: polling cada 2 segundos
      _notice: 'Use statusUrl to check operation status. Poll until status is COMPLETED or FAILED.'
    })
  };
};

module.exports.handler = createAPIHandler(createAppointmentCQRS, {
  rateLimit: { maxRequests: 30, windowSeconds: 60 }
});
