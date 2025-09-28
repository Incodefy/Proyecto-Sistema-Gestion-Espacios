// incodefy/middleware/setLanguage.js

/**
 * Middleware para establecer el idioma de la sesión basado en la
 * configuración de personalización del usuario.
 */
function setLanguage(req, res, next) {
  // La personalización se adjunta en res.locals.personalization
  // gracias al middleware de personalización que ya tenemos.
  const personalization = res.locals.personalization;

  if (personalization && personalization['locale.language']) {
    const userLang = personalization['locale.language'];

    // Si el idioma del usuario es diferente al idioma actual de la petición,
    // lo cambiamos.
    if (req.i18n.language !== userLang) {
      req.i18n.changeLanguage(userLang, (err) => {
        if (err) {
          console.error('Error al cambiar el idioma de i18next:', err);
        }
        // Actualizamos la variable local para que las vistas la tengan disponible
        res.locals.lng = userLang;
        next();
      });
      return; // Importante para no llamar a next() dos veces
    }
  }

  // Si no hay personalización o el idioma ya es el correcto, continuamos.
  next();
}

module.exports = setLanguage;
