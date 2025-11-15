/**
 * DB Proxy Handler - Enruta peticiones a funciones Lambda específicas
 * Refactorizado para mejor mantenibilidad y separación de responsabilidades
 */

const { findTargetFunction, getFullFunctionName, listAvailableRoutes } = require('./dbProxy/routeMapper');
const { invokeLambda } = require('./dbProxy/lambdaInvoker');

module.exports.handler = async (event) => {
  console.log('=== INICIO dbProxy ===');
  
  // Log solo en modo debug para no saturar CloudWatch
  if (process.env.DEBUG === 'true') {
    console.log('Event completo:', JSON.stringify(event, null, 2));
  }

  // Extraer información de la petición
  const path = event.path || event.rawPath; // HTTP API v2 usa rawPath
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  
  console.log(`📍 Petición: ${method} ${path}`);

  // Validar que la ruta existe
  if (!path) {
    console.error('❌ No se recibió un path válido');
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: "Path no válido",
        availableRoutes: listAvailableRoutes()
      })
    };
  }

  // Buscar la función Lambda correspondiente
  const targetFunction = findTargetFunction(path, method);

  if (!targetFunction) {
    console.error(`❌ No se encontró función para: ${method} ${path}`);
    return {
      statusCode: 404,
      body: JSON.stringify({ 
        error: "Ruta no encontrada",
        path: path,
        method: method,
        hint: "Verifica que la ruta esté registrada en routeMapper.js",
        availableRoutes: listAvailableRoutes()
      })
    };
  }

  // Obtener el nombre completo de la función Lambda
  let fullFunctionName;
  try {
    fullFunctionName = getFullFunctionName(targetFunction);
  } catch (error) {
    console.error('❌ Error obteniendo nombre de función:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error de configuración",
        message: error.message
      })
    };
  }

  console.log(`🎯 Target: ${targetFunction} -> ${fullFunctionName}`);

  // Invocar la función Lambda
  try {
    const result = await invokeLambda(fullFunctionName, event);
    console.log(`✅ dbProxy completado exitosamente para ${targetFunction}`);
    return result;

  } catch (error) {
    console.error(`❌ Error en dbProxy para ${targetFunction}:`, error);
    
    // Si el error ya tiene formato de respuesta HTTP, retornarlo
    if (error.statusCode && error.body) {
      return error;
    }

    // Crear respuesta de error genérica
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error procesando la petición",
        message: error.message || 'Error desconocido',
        path: path,
        targetFunction: targetFunction
      })
    };
  }
};