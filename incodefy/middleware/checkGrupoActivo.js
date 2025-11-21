const ApiClient = require('../apiClient');

/**
 * Middleware para verificar si el usuario tiene un grupo activo
 * Si no tiene grupo activo, redirige a /onboarding-espacios
 * Si ocurre un error al verificar, también redirige a onboarding
 * 
 * Cachea el resultado en la sesión para evitar llamadas repetidas
 */
const checkGrupoActivo = async (req, res, next) => {
  // Si no hay usuario autenticado, dejar que requireAuth lo maneje
  if (!req.session.user || !req.session.user.idToken) {
    return next();
  }

  // Evitar bucle infinito: si ya está en onboarding o endpoints relacionados, permitir acceso
  if (req.path === '/onboarding-espacios' || 
      req.path.startsWith('/api/espacios/') || 
      req.path.startsWith('/api/grupos/') ||
      req.path === '/groups' ||
      req.path.startsWith('/grupos/')) {
    return next();
  }

  try {
    // Si ya verificamos en esta sesión hace poco, usar el cache
    if (req.session.grupoActivoVerificado && req.session.grupoActivoVerificadoEn) {
      const ahora = Date.now();
      const hace5Minutos = 5 * 60 * 1000;
      
      if (ahora - req.session.grupoActivoVerificadoEn < hace5Minutos) {
        console.log(`[checkGrupoActivo] ✅ Usando cache - Grupo activo: ${req.session.grupoActivo?.grupo_id || 'ninguno'}`);
        
        if (req.session.grupoActivo && req.session.grupoActivo.grupo_id) {
          req.grupoActivo = req.session.grupoActivo;
          return next();
        } else {
          console.log(`[checkGrupoActivo] ⚠️ Cache indica que no hay grupo activo, redirigiendo`);
          return res.redirect('/onboarding-espacios');
        }
      }
    }

    // Crear cliente API con el token del usuario (ya disponible en req.apiClient si attachApiClient se ejecutó antes)
    const apiClient = req.apiClient || new (require('../apiClient'))(req.session.user.idToken);
    
    console.log(`[checkGrupoActivo] 🔍 Verificando grupo activo para: ${req.session.user.email} (ruta: ${req.path})`);
    
    // Intentar obtener el grupo activo
    const grupoActivoResponse = await apiClient.obtenerGrupoActivo();
    
    console.log(`[checkGrupoActivo] 📦 Respuesta API:`, grupoActivoResponse);
    
    if (grupoActivoResponse && grupoActivoResponse.ok && grupoActivoResponse.grupo_activo) {
      // El usuario tiene un grupo activo, cachear y continuar
      req.session.grupoActivo = grupoActivoResponse.grupo_activo;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      
      console.log(`[checkGrupoActivo] ✅ Grupo activo encontrado: ${grupoActivoResponse.grupo_activo.grupo_id}`);
      req.grupoActivo = grupoActivoResponse.grupo_activo;
      return next();
    } else {
      // No hay grupo activo
      console.log(`[checkGrupoActivo] ⚠️ No hay grupo activo para el usuario`);
      req.session.grupoActivo = null;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      
      return res.redirect('/onboarding-espacios');
    }

  } catch (error) {
    // Si es 404, significa que no hay grupo activo (esperado)
    if (error.response?.status === 404) {
      console.log(`[checkGrupoActivo] ℹ️ No hay grupo activo (404)`);
      req.session.grupoActivo = null;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      
      return res.redirect('/onboarding-espacios');
    }
    
    // Para otros errores, registrar pero redirigir a onboarding como medida de seguridad
    console.error(`[checkGrupoActivo] ❌ Error verificando grupo activo:`, error.message);
    console.error(`[checkGrupoActivo] ❌ Error completo:`, error.response?.data || error);
    return res.redirect('/onboarding-espacios');
  }
};

// Función helper para invalidar el cache del grupo activo
checkGrupoActivo.invalidarCache = (req) => {
  if (req.session) {
    delete req.session.grupoActivo;
    delete req.session.grupoActivoVerificado;
    delete req.session.grupoActivoVerificadoEn;
    console.log(`[checkGrupoActivo] 🔄 Cache invalidado`);
  }
};

module.exports = checkGrupoActivo;
