const ApiClientV2 = require('../apiClientV2');

/**
 * Middleware para agregar el API client a req
 * Debe usarse DESPUÉS del middleware requireAuth
 */
const attachApiClient = (req, res, next) => {
  if (!req.session.user || !req.session.user.idToken) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // Agregar el cliente API a la request (usando V2)
  req.apiClient = new ApiClientV2(req.session.user.idToken, {
    userSub: req.session.user.sub
  });
  
  next();
};

module.exports = attachApiClient;