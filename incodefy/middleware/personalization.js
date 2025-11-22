const fetch = require('node-fetch');

/**
 * Middleware para obtener la configuración de personalización del usuario
 * desde la API de AWS y adjuntarla a la petición.
 */
async function personalizationMiddleware(req, res, next) {
  // Solo se ejecuta si hay un usuario autenticado con un token
  if (!req.session.user || !req.session.user.idToken) {
    console.log('🎨 Middleware personalización: Usuario no autenticado, saltando...');
    return next();
  }

  // Evita hacer fetch repetidamente en la misma petición si ya se cargó
  if (res.locals.personalization) {
    console.log('🎨 Middleware personalización: Ya existe en res.locals, usando cache');
    return next();
  }

  try {
    const url = `${process.env.API_BASE_URL}/personalization`;
    console.log('🎨 Middleware personalización: Obteniendo desde', url);
    
    const apiResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`
      }
    });

    if (apiResponse.ok) {
      const responseData = await apiResponse.json();
      console.log('🎨 Middleware personalización: Respuesta completa:', responseData);
      
      // La respuesta viene en formato { success: true, data: { final_parameters: {...} } }
      const data = responseData.data || responseData;
      const finalParameters = data.final_parameters || {};
      
      console.log('🎨 Middleware personalización: final_parameters extraídos:', finalParameters);
      
      // Adjuntamos los parámetros finales a res.locals para que estén disponibles
      // en los siguientes middlewares y en las vistas.
      res.locals.personalization = finalParameters;
      console.log('🎨 Middleware personalización: Guardado en res.locals:', res.locals.personalization);
    } else {
      console.error('🎨 Middleware personalización: Error HTTP', apiResponse.status, apiResponse.statusText);
      res.locals.personalization = {}; // Usar objeto vacío en caso de error
    }
  } catch (error) {
    console.error('🎨 Middleware personalización: Error de red:', error.message);
    res.locals.personalization = {}; // Usar objeto vacío en caso de error
  }

  next();
}

module.exports = personalizationMiddleware;
