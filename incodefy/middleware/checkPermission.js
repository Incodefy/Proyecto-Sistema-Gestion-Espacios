// middleware/checkPermission.js
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    const TRACE = `[CheckPerm]`;
    
    console.log(`\n${TRACE} ╔═══════════════════════════════════════╗`);
    console.log(`${TRACE} ║   VERIFICACIÓN DE PERMISOS           ║`);
    console.log(`${TRACE} ╚═══════════════════════════════════════╝`);
    console.log(`${TRACE} 🔐 Permiso requerido: "${requiredPermission}"`);
    console.log(`${TRACE} 🛣️  Ruta: ${req.method} ${req.path}`);
    console.log(`${TRACE} 🆔 Session ID: ${req.sessionID}`);
    
    // Verificar autenticación
    if (!req.session.user || !req.session.user.idToken) {
      console.log(`${TRACE} ❌ No autenticado`);
      return res.redirect('/login');
    }

    console.log(`${TRACE} 👤 Usuario: ${req.session.user.email}`);

    // Admin tiene acceso completo
    if (req.session.user.has_admin_permissions) {
      console.log(`${TRACE} ✅ Admin - Acceso concedido`);
      return next();
    }

    // Verificar grupo activo
    const grupoActivo = req.session.grupoActivo;
    if (!grupoActivo?.grupo_id) {
      console.log(`${TRACE} ❌ Sin grupo activo`);
      return res.redirect('/onboarding-espacios');
    }

    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo.grupo_id;
    console.log(`${TRACE} 📦 Grupo: ${grupoId}`);

    // Verificar permisos desde sesión
    const permissionsByGroup = req.session.user.permissions_by_group || {};
    const groupPermissions = permissionsByGroup[grupoId];
    
    if (!groupPermissions?.permissions) {
      console.log(`${TRACE} ⚠️ Sin permisos en sesión - Intentando API...`);
      
      try {
        const response = await fetch(`${process.env.API_BASE_URL}/check-permission`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${req.session.user.idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            permission: requiredPermission,
            group_id: grupoId
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data?.has_access || data.has_access) {
            console.log(`${TRACE} ✅ Acceso concedido (API)`);
            return next();
          }
        }
      } catch (err) {
        console.error(`${TRACE} ❌ Error API:`, err.message);
      }
      
      console.log(`${TRACE} 🚫 Acceso denegado`);
      return res.status(403).render('403', { error: 'Permisos insuficientes' });
    }

    // Verificar permiso específico
    const hasPermission = groupPermissions.permissions.includes(requiredPermission);
    
    console.log(`${TRACE} 📋 Rol: ${groupPermissions.role}, Tiene permiso: ${hasPermission ? '✅' : '❌'}`);

    if (hasPermission) {
      console.log(`${TRACE} ✅ Acceso concedido`);
      return next();
    } else {
      console.log(`${TRACE} 🚫 Acceso denegado`);
      return res.status(403).render('403', { 
        error: 'Permisos insuficientes',
        requiredPermission,
        userRole: groupPermissions.role
      });
    }
  };
};

module.exports = checkPermission;