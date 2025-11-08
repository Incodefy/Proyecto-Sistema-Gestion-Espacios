const ApiClient = require('../apiClient');

/**
 * Middleware para agregar el API client a req
 * Debe usarse DESPUÉS del middleware requireAuth
 */
const attachApiClient = (req, res, next) => {
  if (!req.session.user || !req.session.user.idToken) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  // Agregar el cliente API a la request
  req.apiClient = new ApiClient(req.session.user.idToken);
  
  next();
};

module.exports = attachApiClient;