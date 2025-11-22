const ApiClient = require('../apiClient');
const DEBUG = process.env.DEBUG_MIDDLEWARE === 'true';

/**
 * Middleware SIMPLIFICADO para verificar grupo activo
 * Confía en la sesión configurada durante el login
 */
const checkGrupoActivo = async (req, res, next) => {
  // Si no hay usuario autenticado, dejar que requireAuth lo maneje
  if (!req.session.user || !req.session.user.idToken) {
    return next();
  }

  // Rutas excluidas de verificación
  const rutasExcluidas = [
    '/onboarding-espacios',
    '/aceptar-invitacion',
    '/api/espacios/',
    '/api/grupos/',
    '/api/invitaciones/',
    '/groups',
    '/grupos/'
  ];

  if (rutasExcluidas.some(ruta => req.path === ruta || req.path.startsWith(ruta))) {
    return next();
  }

  // Usar cache de sesión (configurado en login)
  if (req.session.grupoActivoVerificado) {
    const cacheValido = Date.now() - (req.session.grupoActivoVerificadoEn || 0) < 5 * 60 * 1000;
    
    if (cacheValido) {
      if (req.session.grupoActivo?.grupo_id) {
        req.grupoActivo = req.session.grupoActivo;
        return next();
      } else {
        if (DEBUG) console.log(`[checkGrupoActivo] ⚠️ Cache válido pero sin grupo activo`);
        return res.redirect('/onboarding-espacios');
      }
    }
  }

  // Si no hay cache válido, verificar con API
  try {
    if (DEBUG) console.log(`[checkGrupoActivo] 🔍 Verificando con API para ${req.session.user.email}`);
    const apiClient = req.apiClient || new ApiClient(req.session.user.idToken);
    const grupoActivoResponse = await apiClient.obtenerGrupoActivo();
    
    if (grupoActivoResponse?.ok && grupoActivoResponse.grupo_activo) {
      req.session.grupoActivo = grupoActivoResponse.grupo_activo;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      req.grupoActivo = grupoActivoResponse.grupo_activo;
      
      if (DEBUG) console.log(`[checkGrupoActivo] ✅ Grupo encontrado: ${grupoActivoResponse.grupo_activo.grupo_id}`);
      return next();
    } else {
      req.session.grupoActivo = null;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      
      if (DEBUG) console.log(`[checkGrupoActivo] ⚠️ Sin grupo activo`);
      return res.redirect('/onboarding-espacios');
    }
  } catch (error) {
    console.error(`[checkGrupoActivo] ❌ Error:`, error.message);
    
    if (error.response?.status === 404) {
      req.session.grupoActivo = null;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      return res.redirect('/onboarding-espacios');
    }
    
    // En caso de error, permitir acceso (fail open) o redirigir según necesidad
    return res.redirect('/onboarding-espacios');
  }
};

// Función helper para invalidar el cache del grupo activo
checkGrupoActivo.invalidarCache = (req) => {
  if (req.session) {
    delete req.session.grupoActivo;
    delete req.session.grupoActivoVerificado;
    delete req.session.grupoActivoVerificadoEn;
    if (DEBUG) console.log(`[checkGrupoActivo] 🔄 Cache invalidado`);
  }
};

module.exports = checkGrupoActivo;
