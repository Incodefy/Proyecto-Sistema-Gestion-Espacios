// middleware/injectPermissions.js
// Middleware que inyecta helpers de permisos en las vistas

const { hasPermission, hasAllPermissions, hasAnyPermission, getCurrentGroupPermissions } = require('../utils/refreshPermissions');

/**
 * Middleware que inyecta funciones de verificación de permisos
 * en las variables locales de las vistas (res.locals)
 */
function injectPermissions(req, res, next) {
  // Inyectar funciones helper en las vistas con manejo seguro
  res.locals.hasPermission = (permission) => {
    try {
      return hasPermission(req, permission);
    } catch (error) {
      console.error('Error en hasPermission:', error.message);
      return false;
    }
  };

  res.locals.hasAllPermissions = (...permissions) => {
    try {
      return hasAllPermissions(req, ...permissions);
    } catch (error) {
      console.error('Error en hasAllPermissions:', error.message);
      return false;
    }
  };

  res.locals.hasAnyPermission = (...permissions) => {
    try {
      return hasAnyPermission(req, ...permissions);
    } catch (error) {
      console.error('Error en hasAnyPermission:', error.message);
      return false;
    }
  };

  res.locals.getUserPermissions = () => {
    try {
      return getCurrentGroupPermissions(req);
    } catch (error) {
      console.error('Error en getUserPermissions:', error.message);
      return [];
    }
  };

  // Por compatibilidad, también inyectar has_admin_permissions
  res.locals.has_admin_permissions = req.session?.user?.has_admin_permissions || false;

  next();
}

module.exports = injectPermissions;
