const fetch = require('node-fetch');

/**
 * Middleware para obtener la configuración de personalización del usuario
 * desde la API de AWS y adjuntarla a la petición.
 */
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
    const apiResponse = await fetch(`${process.env.API_BASE_URL}/personalization`, {
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`
      }
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      // Adjuntamos los parámetros finales a res.locals para que estén disponibles
      // en los siguientes middlewares y en las vistas.
      res.locals.personalization = data.final_parameters || {};
    } else {
      console.error('Error al obtener la personalización:', apiResponse.statusText);
      res.locals.personalization = {}; // Usar objeto vacío en caso de error
    }
  } catch (error) {
    console.error('Error de red al obtener la personalización:', error);
    res.locals.personalization = {}; // Usar objeto vacío en caso de error
  }

  next();
}

module.exports = personalizationMiddleware;
