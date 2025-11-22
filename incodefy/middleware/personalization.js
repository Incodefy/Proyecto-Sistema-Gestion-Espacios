const fetch = require('node-fetch');

/**
 * Middleware para obtener la configuración de personalización del usuario
 * desde la API de AWS y adjuntarla a la petición.
 */
const DEBUG = process.env.DEBUG_MIDDLEWARE === 'true';

async function personalizationMiddleware(req, res, next) {
  // Solo se ejecuta si hay un usuario autenticado con un token
  if (!req.session.user || !req.session.user.idToken) {
    return next();
  }

  // Evita hacer fetch repetidamente en la misma petición si ya se cargó
  if (res.locals.personalization) {
    return next();
  }

  try {
    const url = `${process.env.API_BASE_URL}/personalization`;
    
    const apiResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`
      }
    });

    if (apiResponse.ok) {
      const responseData = await apiResponse.json();
      
      // La respuesta viene en formato { success: true, data: { final_parameters: {...} } }
      const data = responseData.data || responseData;
      const finalParameters = data.final_parameters || {};
      
      // Adjuntamos los parámetros finales a res.locals para que estén disponibles
      // en los siguientes middlewares y en las vistas.
      res.locals.personalization = finalParameters;
      
      if (DEBUG) {
        console.log('🎨 Personalization loaded for', req.session.user.email);
      }
    } else {
      console.error('❌ Personalization API error:', apiResponse.status);
      res.locals.personalization = {};
    }
  } catch (error) {
    console.error('❌ Personalization fetch error:', error.message);
    res.locals.personalization = {};
  }

  next();
}

module.exports = personalizationMiddleware;
