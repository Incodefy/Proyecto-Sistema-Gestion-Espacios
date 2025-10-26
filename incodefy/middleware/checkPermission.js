// middleware/checkPermission.js
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    // Verificar que el usuario esté autenticado
    if (!req.session.user || !req.session.user.idToken) {
      req.flash('error', 'Debes iniciar sesión para acceder a esta página');
      return res.redirect('/login');
    }

    const userPermissions = req.session.user.permissions || [];

    console.log("Permisos: ", userPermissions)
    
    if (userPermissions.includes('admin.users') || userPermissions.includes(requiredPermission)) {
      return next();
    }

    // Sin permisos suficientes
    console.log(`❌ Usuario ${req.session.user.email} sin permiso ${requiredPermission}`);
    req.flash('error', `No tienes permisos para acceder a esta sección. Permiso requerido: ${requiredPermission}`);
    
    return res.status(403).render('error', {
      error: 'Acceso denegado',
      message: `No tienes el permiso necesario: ${requiredPermission}`,
      currentPath: req.path
    });
  };
};

module.exports = checkPermission;