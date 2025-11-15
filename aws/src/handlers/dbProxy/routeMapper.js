/**
 * Mapeo de rutas a funciones Lambda
 * Centraliza la lógica de enrutamiento del dbProxy
 */

const ROUTE_MAP = [
  { pattern: /pasillos/, functionName: 'obtenerPasillos', methods: ['GET'] },
  { pattern: /boxes(?!-)/, functionName: 'obtenerBoxes', methods: ['GET'] },
  { pattern: /agenda(?!-)/, functionName: 'obtenerAgendaPorFecha', methods: ['GET'] },
  { pattern: /especialidades/, functionName: 'obtenerEspecialidades', methods: ['GET'] },
  { pattern: /medicos(?!-)/, functionName: 'obtenerMedicos', methods: ['GET'] },
  { pattern: /agenda-box/, functionName: 'obtenerAgendaPorBox', methods: ['GET'] },
  { pattern: /agenda-medico/, functionName: 'obtenerAgendaPorMedico', methods: ['GET'] },
  { pattern: /agenda-id/, functionName: 'obtenerAgendaPorId', methods: ['GET'] },
  { pattern: /conflicto-box/, functionName: 'verificarConflictoBox', methods: ['GET'] },
  { pattern: /conflicto-medico/, functionName: 'verificarConflictoMedico', methods: ['GET'] },
  { pattern: /estado-no-atendido/, functionName: 'obtenerEstadoNoAtendido', methods: ['GET'] },
  { pattern: /insertar-agenda/, functionName: 'insertarAgenda', methods: ['POST'] },
  { pattern: /nuevo-estado-agenda/, functionName: 'actualizarEstadoAgenda', methods: ['PUT', 'POST'] },
  { pattern: /instrumentos-box/, functionName: 'obtenerInstrumentosPorBox', methods: ['GET'] },
  { pattern: /box-pasillo/, functionName: 'obtenerBoxYPasillo', methods: ['GET'] },
  { pattern: /agenda-box-fecha/, functionName: 'obtenerAgendaPorBoxYFecha', methods: ['GET'] },
  { pattern: /notificaciones/, functionName: 'obtenerNotificaciones', methods: ['GET'] },
  { pattern: /medico-nombre/, functionName: 'obtenerMedicoNombre', methods: ['GET'] },
  { pattern: /box-nombre/, functionName: 'obtenerBoxNombre', methods: ['GET'] },
  { pattern: /total-consultas/, functionName: 'obtenerTotalConsultas', methods: ['GET'] },
  { pattern: /boxes-disponibles/, functionName: 'obtenerBoxesDisponibles', methods: ['GET'] },
  { pattern: /especialidad-mas-demandada/, functionName: 'obtenerEspecialidadMasDemandada', methods: ['GET'] },
  { pattern: /consultas-especialidad/, functionName: 'obtenerConsultasPorEspecialidad', methods: ['GET'] },
  { pattern: /consultas-dia/, functionName: 'obtenerConsultasPorDia', methods: ['GET'] },
  { pattern: /rendimiento-medicos/, functionName: 'obtenerRendimientoMedicos', methods: ['GET'] },
  { pattern: /medicos-especialidades/, functionName: 'obtenerMedicosPorEspecialidades', methods: ['GET'] },
  { pattern: /consultas-en-curso/, functionName: 'obtenerConsultasEnCurso', methods: ['GET'] },
  { pattern: /eliminar-agenda/, functionName: 'eliminarAgenda', methods: ['DELETE', 'POST'] }
];

/**
 * Encuentra la función Lambda correspondiente a una ruta
 * @param {string} path - Ruta HTTP
 * @param {string} method - Método HTTP
 * @returns {string|null} - Nombre de la función Lambda o null
 */
function findTargetFunction(path, method = 'GET') {
  if (!path) {
    console.warn('⚠️ Path vacío recibido en findTargetFunction');
    return null;
  }

  const normalizedMethod = method.toUpperCase();

  for (const route of ROUTE_MAP) {
    if (route.pattern.test(path)) {
      // Verificar si el método HTTP es válido para esta ruta
      if (!route.methods.includes(normalizedMethod)) {
        console.warn(`⚠️ Método ${normalizedMethod} no permitido para ${route.functionName}`);
        continue;
      }
      return route.functionName;
    }
  }

  return null;
}

/**
 * Obtiene el nombre completo de la función Lambda
 * @param {string} functionName - Nombre base de la función
 * @returns {string} - Nombre completo con servicio y stage
 */
function getFullFunctionName(functionName) {
  const serviceName = process.env.SERVICE_NAME;
  const stage = process.env.STAGE;

  if (!serviceName || !stage) {
    throw new Error('SERVICE_NAME y STAGE deben estar definidos en las variables de entorno');
  }

  return `${serviceName}-${stage}-${functionName}`;
}

/**
 * Lista todas las rutas disponibles (útil para debugging)
 * @returns {Array} - Array de rutas configuradas
 */
function listAvailableRoutes() {
  return ROUTE_MAP.map(route => ({
    pattern: route.pattern.source,
    function: route.functionName,
    methods: route.methods
  }));
}

module.exports = {
  findTargetFunction,
  getFullFunctionName,
  listAvailableRoutes,
  ROUTE_MAP
};
