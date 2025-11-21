// middleware/checkPermission.js
const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    const TRACE = `[CheckPerm-${Date.now()}]`;
    
    console.log(`\n${TRACE} ═══════════════════════════════════════════════════════`);
    console.log(`${TRACE} 🔐 Verificando permiso: "${requiredPermission}"`);
    console.log(`${TRACE} 📍 Ruta solicitada: ${req.path}`);
    
    // Verificar que el usuario esté autenticado
    if (!req.session.user || !req.session.user.idToken) {
      console.log(`${TRACE} ❌ Usuario no autenticado`);
      req.flash('error', 'Debes iniciar sesión para acceder a esta página');
      return res.redirect('/login');
    }

    console.log(`${TRACE} 👤 Usuario: ${req.session.user.email}`);
    console.log(`${TRACE} 📊 Tiene permisos admin: ${req.session.user.has_admin_permissions}`);

    // Si tiene permisos de admin en cualquier grupo, permitir acceso
    if (req.session.user.has_admin_permissions) {
      console.log(`${TRACE} ✅ ACCESO CONCEDIDO - Usuario tiene permisos de admin`);
      console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
      return next();
    }

    // Si no tiene grupo activo, no puede acceder
    const grupoActivo = req.session.grupoActivo;
    if (!grupoActivo) {
      console.log(`${TRACE} ❌ Usuario no tiene grupo activo asignado`);
      console.log(`${TRACE} 🔄 Redirigiendo a /onboarding-espacios`);
      console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
      req.flash('error', 'Debes seleccionar un grupo para acceder a esta sección');
      return res.redirect('/onboarding-espacios');
    }

    // Extraer el grupo_id del objeto grupoActivo
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo.grupo_id;
    
    if (!grupoId) {
      console.log(`${TRACE} ❌ Grupo activo no tiene grupo_id válido`);
      console.log(`${TRACE} 📦 Valor actual: ${JSON.stringify(grupoActivo)}`);
      console.log(`${TRACE} 🔄 Redirigiendo a /onboarding-espacios`);
      console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
      req.flash('error', 'Grupo activo inválido, por favor selecciona uno nuevamente');
      return res.redirect('/onboarding-espacios');
    }

    console.log(`${TRACE} 📦 Grupo activo ID: ${grupoId}`);

    // VERIFICAR PERMISOS DESDE LA SESIÓN (ya no consultamos la API)
    const permissionsByGroup = req.session.user.permissions_by_group || {};
    const groupPermissions = permissionsByGroup[grupoId];
    
    if (!groupPermissions) {
      console.log(`${TRACE} ⚠️ No hay permisos en sesión para el grupo ${grupoId}`);
      console.log(`${TRACE} 🔄 Refrescando permisos desde API...`);
      
      // Fallback: si no hay permisos en sesión, hacer una consulta
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
          const responseData = await response.json();
          const data = responseData.data || responseData;
          
          if (data.has_access) {
            console.log(`${TRACE} ✅ ACCESO CONCEDIDO (API fallback)`);
            console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
            return next();
          }
        }
      } catch (err) {
        console.error(`${TRACE} ❌ Error en fallback API:`, err.message);
      }
      
      console.log(`${TRACE} 🚫 Bloqueando acceso - No hay permisos disponibles`);
      console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
      req.flash('error', 'No tienes permisos suficientes para acceder a esta sección');
      return res.status(403).render('403', { error: 'Permisos insuficientes' });
    }

    // Verificar si el usuario tiene el permiso requerido
    const hasPermission = groupPermissions.permissions.includes(requiredPermission);
    
    console.log(`${TRACE} 📋 Rol en grupo: ${groupPermissions.role}`);
    console.log(`${TRACE} 📋 Total permisos: ${groupPermissions.permissionsCount}`);
    console.log(`${TRACE} 🔍 Permiso "${requiredPermission}": ${hasPermission ? '✅ TIENE' : '❌ NO TIENE'}`);

    if (hasPermission) {
      console.log(`${TRACE} ✅ ACCESO CONCEDIDO - Permiso verificado desde sesión`);
      console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
      return next();
    } else {
      console.log(`${TRACE} ❌ ACCESO DENEGADO - Usuario sin el permiso requerido`);
      console.log(`${TRACE} 📋 Permisos disponibles:`, groupPermissions.permissions.slice(0, 5).join(', '), '...');
      console.log(`${TRACE} 🚫 Bloqueando acceso - Mostrando página de error 403`);
      console.log(`${TRACE} ═══════════════════════════════════════════════════════\n`);
      
      req.flash('error', 'No tienes permisos suficientes para acceder a esta sección');
      return res.status(403).render('403', { 
        error: 'Permisos insuficientes',
        requiredPermission,
        userRole: groupPermissions.role
      });
    }
  };
};

module.exports = checkPermission;