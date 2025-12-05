/**
 * DB Proxy Handler - Enruta peticiones a funciones Lambda específicas
 */

const { findTargetFunction, getFullFunctionName, listAvailableRoutes } = require('./dbProxy/routeMapper');
const { invokeLambda } = require('./dbProxy/lambdaInvoker');
const Logger = require('../utils/logger');

module.exports.handler = async (event) => {
  const logger = Logger.fromEvent(event).child({ handler: 'dbProxy' });
  logger.info('Iniciando dbProxy');

  const path = event.path || event.rawPath;
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  
  logger.info('Petición recibida', { method, path });

  if (!path) {
    logger.error('Path no válido');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Path no válido", availableRoutes: listAvailableRoutes() })
    };
  }

  const targetFunction = findTargetFunction(path, method);

  if (!targetFunction) {
    logger.error('Función no encontrada', { method, path });
    return {
      statusCode: 404,
      body: JSON.stringify({ 
        error: "Ruta no encontrada",
        path, method,
        hint: "Verifica que la ruta esté registrada en routeMapper.js",
        availableRoutes: listAvailableRoutes()
      })
    };
  }

  let fullFunctionName;
  try {
    fullFunctionName = getFullFunctionName(targetFunction);
  } catch (error) {
    logger.error('Error obteniendo nombre de función', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error de configuración", message: error.message })
    };
  }

  logger.info('Invocando función', { targetFunction, fullFunctionName });

  try {
    const result = await invokeLambda(fullFunctionName, event);
    logger.info('dbProxy completado exitosamente');
    return result;
  } catch (error) {
    logger.error('Error en dbProxy', error, { targetFunction });
    if (error.statusCode && error.body) return error;
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error procesando la petición",
        message: error.message || 'Error desconocido',
        path, targetFunction
      })
    };
  }
};