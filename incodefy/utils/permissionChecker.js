// utils/permissionChecker.js - Helper para verificar permisos
const fetch = require('node-fetch');

/**
 * Verifica si un usuario tiene un permiso específico en un grupo
 * @param {string} idToken - Token de autenticación del usuario
 * @param {string|object} groupId - ID del grupo a verificar (string o objeto con propiedad grupo_id)
 * @param {string} permission - Permiso a verificar (ej: 'dashboard.read')
 * @returns {Promise<{hasAccess: boolean, message: string, details: object}>}
 */
async function checkUserPermission(idToken, groupId, permission) {
  const TRACE = `[PermChecker-${Date.now()}]`;
  
  // Extraer grupo_id si es un objeto
  const grupoId = typeof groupId === 'string' ? groupId : groupId?.grupo_id;
  
  if (!grupoId) {
    console.error(`${TRACE} ❌ groupId inválido:`, groupId);
    return {
      hasAccess: false,
      message: 'ID de grupo inválido',
      details: { error: 'groupId debe ser un string o un objeto con propiedad grupo_id' }
    };
  }
  
  try {
    console.log(`${TRACE} 🔍 Verificando permiso "${permission}" en grupo "${grupoId}"`);
    
    const response = await fetch(`${process.env.API_BASE_URL}/check-permission`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        permission,
        group_id: grupoId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${TRACE} ❌ Error en API (${response.status}):`, errorText);
      return {
        hasAccess: false,
        message: `Error al verificar permiso: ${response.status}`,
        details: { error: errorText }
      };
    }

    const responseData = await response.json();
    const data = responseData.data || responseData;

    console.log(`${TRACE} ${data.has_access ? '✅' : '❌'} Resultado: ${data.has_access ? 'ACCESO CONCEDIDO' : 'ACCESO DENEGADO'}`);

    return {
      hasAccess: data.has_access,
      message: data.message || (data.has_access ? 'Acceso permitido' : 'Acceso denegado'),
      details: data
    };

  } catch (error) {
    console.error(`${TRACE} ❌ Excepción al verificar permiso:`, error.message);
    return {
      hasAccess: false,
      message: `Error de conexión: ${error.message}`,
      details: { error: error.message }
    };
  }
}

/**
 * Verifica múltiples permisos simultáneamente
 * @param {string} idToken - Token de autenticación del usuario
 * @param {string} groupId - ID del grupo a verificar
 * @param {string[]} permissions - Array de permisos a verificar
 * @returns {Promise<{[permission: string]: boolean}>}
 */
async function checkMultiplePermissions(idToken, groupId, permissions) {
  const TRACE = `[PermChecker-${Date.now()}]`;
  console.log(`${TRACE} 🔍 Verificando ${permissions.length} permisos en grupo "${groupId}"`);

  const results = {};
  
  // Ejecutar todas las verificaciones en paralelo
  const checks = permissions.map(permission => 
    checkUserPermission(idToken, groupId, permission)
      .then(result => ({ permission, hasAccess: result.hasAccess }))
  );

  const checkResults = await Promise.all(checks);
  
  checkResults.forEach(({ permission, hasAccess }) => {
    results[permission] = hasAccess;
  });

  console.log(`${TRACE} 📊 Resultados:`, results);
  return results;
}

/**
 * Obtiene todos los grupos y permisos del usuario
 * @param {string} idToken - Token de autenticación del usuario
 * @returns {Promise<{groups: array, hasAdminPermissions: boolean}>}
 */
async function getUserMemberships(idToken) {
  const TRACE = `[PermChecker-${Date.now()}]`;
  
  try {
    console.log(`${TRACE} 📡 Obteniendo membresías del usuario...`);
    
    const response = await fetch(`${process.env.API_BASE_URL}/my-permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${TRACE} ❌ Error en API (${response.status}):`, errorText);
      return { groups: [], hasAdminPermissions: false };
    }

    const responseData = await response.json();
    const data = responseData.data || responseData;

    console.log(`${TRACE} ✅ Membresías obtenidas: ${data.groups?.length || 0} grupos`);

    return {
      groups: data.groups || [],
      hasAdminPermissions: data.has_admin_permissions || false,
      userSub: data.user_sub
    };

  } catch (error) {
    console.error(`${TRACE} ❌ Excepción al obtener membresías:`, error.message);
    return { groups: [], hasAdminPermissions: false };
  }
}

/**
 * Middleware helper: Verifica si el usuario tiene al menos uno de los permisos especificados
 * @param {string[]} requiredPermissions - Array de permisos (OR lógico)
 */
function checkAnyPermission(...requiredPermissions) {
  return async (req, res, next) => {
    const TRACE = `[CheckAny-${Date.now()}]`;
    
    if (!req.session.user?.idToken) {
      return res.redirect('/login');
    }

    const grupoActivo = req.session.grupoActivo;
    if (!grupoActivo) {
      return res.redirect('/onboarding-espacios');
    }

    console.log(`${TRACE} 🔍 Verificando si tiene alguno de: ${requiredPermissions.join(', ')}`);

    // Verificar cada permiso
    for (const permission of requiredPermissions) {
      const result = await checkUserPermission(req.session.user.idToken, grupoActivo, permission);
      if (result.hasAccess) {
        console.log(`${TRACE} ✅ Tiene permiso: ${permission}`);
        return next();
      }
    }

    console.log(`${TRACE} ❌ No tiene ninguno de los permisos requeridos`);
    req.flash('error', `No tienes permisos suficientes. Necesitas uno de: ${requiredPermissions.join(', ')}`);
    return res.status(403).render('error', {
      error: 'Acceso denegado',
      message: `Permisos requeridos (al menos uno): ${requiredPermissions.join(', ')}`,
      currentPath: req.path
    });
  };
}

/**
 * Middleware helper: Verifica si el usuario tiene TODOS los permisos especificados
 * @param {string[]} requiredPermissions - Array de permisos (AND lógico)
 */
function checkAllPermissions(...requiredPermissions) {
  return async (req, res, next) => {
    const TRACE = `[CheckAll-${Date.now()}]`;
    
    if (!req.session.user?.idToken) {
      return res.redirect('/login');
    }

    const grupoActivo = req.session.grupoActivo;
    if (!grupoActivo) {
      return res.redirect('/onboarding-espacios');
    }

    console.log(`${TRACE} 🔍 Verificando si tiene TODOS: ${requiredPermissions.join(', ')}`);

    // Verificar todos los permisos en paralelo
    const results = await checkMultiplePermissions(
      req.session.user.idToken,
      grupoActivo,
      requiredPermissions
    );

    const missingPermissions = requiredPermissions.filter(perm => !results[perm]);

    if (missingPermissions.length === 0) {
      console.log(`${TRACE} ✅ Tiene todos los permisos requeridos`);
      return next();
    }

    console.log(`${TRACE} ❌ Faltan permisos: ${missingPermissions.join(', ')}`);
    req.flash('error', `No tienes todos los permisos necesarios. Faltan: ${missingPermissions.join(', ')}`);
    return res.status(403).render('error', {
      error: 'Acceso denegado',
      message: `Permisos requeridos (todos): ${requiredPermissions.join(', ')}`,
      currentPath: req.path
    });
  };
}

module.exports = {
  checkUserPermission,
  checkMultiplePermissions,
  getUserMemberships,
  checkAnyPermission,
  checkAllPermissions
};
