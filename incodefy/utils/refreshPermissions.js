// utils/refreshPermissions.js - Helper para refrescar permisos del usuario
const fetch = require('node-fetch');

/**
 * Refresca los permisos del usuario consultando la API y actualizando la sesión
 * @param {object} req - Objeto request de Express con sesión activa
 * @returns {Promise<{success: boolean, message: string, data?: object}>}
 */
async function refreshUserPermissions(req) {
  const TRACE = `[RefreshPerms-${Date.now()}]`;
  
  try {
    if (!req.session.user || !req.session.user.idToken) {
      console.error(`${TRACE} ❌ No hay usuario autenticado en sesión`);
      return {
        success: false,
        message: 'No hay sesión de usuario activa'
      };
    }

    console.log(`${TRACE} 🔄 Refrescando permisos para: ${req.session.user.email}`);
    
    const response = await fetch(`${process.env.API_BASE_URL}/my-permissions`, {
      headers: { 
        'Authorization': `Bearer ${req.session.user.idToken}` 
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${TRACE} ❌ Error al obtener permisos (${response.status}):`, errorText);
      return {
        success: false,
        message: `Error al consultar permisos: ${response.status}`
      };
    }

    const permissionsData = await response.json();
    const data = permissionsData.data || permissionsData;

    // Actualizar sesión con nuevos permisos
    req.session.user.groups = data.groups || [];
    req.session.user.has_admin_permissions = data.has_admin_permissions || false;
    req.session.user.permissions_by_group = data.permissions_by_group || {};

    console.log(`${TRACE} ✅ Permisos actualizados: ${data.groups?.length || 0} grupos`);
    console.log(`${TRACE} 🔐 Permisos admin: ${data.has_admin_permissions}`);

    // Log detallado
    if (data.permissions_by_group) {
      Object.entries(data.permissions_by_group).forEach(([groupId, info]) => {
        console.log(`${TRACE}   📋 ${groupId}: ${info.permissionsCount} permisos (${info.role})`);
      });
    }

    return {
      success: true,
      message: 'Permisos actualizados correctamente',
      data: {
        groups: data.groups,
        has_admin_permissions: data.has_admin_permissions,
        permissions_by_group: data.permissions_by_group
      }
    };

  } catch (err) {
    console.error(`${TRACE} ❌ Excepción al refrescar permisos:`, err.message);
    return {
      success: false,
      message: `Error al refrescar permisos: ${err.message}`
    };
  }
}

/**
 * Middleware que refresca los permisos del usuario antes de continuar
 * Útil para rutas donde se necesitan permisos actualizados (ej: después de cambiar de grupo)
 */
function refreshPermissionsMiddleware() {
  return async (req, res, next) => {
    const result = await refreshUserPermissions(req);
    
    if (!result.success) {
      console.warn(`⚠️ No se pudieron refrescar permisos: ${result.message}`);
      // Continuar de todas formas, usar permisos en cache
    }
    
    next();
  };
}

/**
 * Obtiene los permisos del usuario para el grupo activo
 * @param {object} req - Objeto request de Express con sesión activa
 * @returns {Array<string>} - Array de permisos o array vacío si no hay
 */
function getCurrentGroupPermissions(req) {
  const grupoActivo = req.session.grupoActivo;
  const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
  
  if (!grupoId) {
    return [];
  }

  const permissionsByGroup = req.session.user?.permissions_by_group || {};
  const groupPermissions = permissionsByGroup[grupoId];
  
  return groupPermissions?.permissions || [];
}

/**
 * Verifica si el usuario tiene un permiso específico en el grupo activo
 * @param {object} req - Objeto request de Express con sesión activa
 * @param {string} permission - Permiso a verificar
 * @returns {boolean} - true si tiene el permiso, false si no
 */
function hasPermission(req, permission) {
  // Admins tienen todos los permisos
  if (req.session.user?.has_admin_permissions) {
    return true;
  }

  const permissions = getCurrentGroupPermissions(req);
  return permissions.includes(permission);
}

/**
 * Verifica si el usuario tiene TODOS los permisos especificados
 * @param {object} req - Objeto request de Express con sesión activa
 * @param {...string} permissions - Permisos a verificar
 * @returns {boolean} - true si tiene todos, false si falta alguno
 */
function hasAllPermissions(req, ...permissions) {
  return permissions.every(perm => hasPermission(req, perm));
}

/**
 * Verifica si el usuario tiene AL MENOS UNO de los permisos especificados
 * @param {object} req - Objeto request de Express con sesión activa
 * @param {...string} permissions - Permisos a verificar
 * @returns {boolean} - true si tiene al menos uno, false si no tiene ninguno
 */
function hasAnyPermission(req, ...permissions) {
  return permissions.some(perm => hasPermission(req, perm));
}

module.exports = {
  refreshUserPermissions,
  refreshPermissionsMiddleware,
  getCurrentGroupPermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission
};
