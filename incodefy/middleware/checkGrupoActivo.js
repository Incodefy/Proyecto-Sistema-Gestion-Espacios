const ApiClientV2 = require('../apiClientV2');

const DEBUG = process.env.DEBUG_GRUPO_ACTIVO === 'true';

/**
 * Middleware SIMPLIFICADO para verificar grupo activo
 * Confía en la sesión configurada durante el login
 * OPTIMIZADO: Logs opcionales + cache extendido
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
  
  // Excluir recursos estáticos (CSS, JS, imágenes, fuentes, iconos)
  const esRecursoEstatico = /\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(req.path);
  if (esRecursoEstatico || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/icons/') || req.path.startsWith('/logos/') || req.path.startsWith('/fondo/') || req.path.startsWith('/public/')) {
    return next();
  }

  if (rutasExcluidas.some(ruta => req.path === ruta || req.path.startsWith(ruta))) {
    return next();
  }

  if (DEBUG) {
    console.log(`\n[checkGrupoActivo] ═══ INICIO ═══`);
    console.log(`[checkGrupoActivo] 🛣️  Ruta: ${req.path}`);
    console.log(`[checkGrupoActivo] 👤 Usuario: ${req.session.user?.email || 'NINGUNO'}`);
  }

  // Usar cache de sesión (configurado en login) - Reducido a 30 segundos para nomenclatura fresca
  if (req.session.grupoActivoVerificado) {
    const cacheValido = Date.now() - (req.session.grupoActivoVerificadoEn || 0) < 30 * 1000; // 30 segundos
    
    if (cacheValido) {
      if (req.session.grupoActivo?.grupo_id) {
        // Si el cache no tiene userRole, invalidarlo y obtener de nuevo
        if (!req.session.userRole) {
          if (DEBUG) console.log(`[checkGrupoActivo] ⚠️ Cache sin userRole - Invalidando y obteniendo de nuevo`);
          // No usar cache, continuar al flujo de API
        } else {
          if (DEBUG) console.log(`[checkGrupoActivo] ✅ Cache válido con userRole: ${req.session.userRole} (30s)`);
          req.grupoActivo = req.session.grupoActivo;
          res.locals.userRole = req.session.userRole;
          return next();
        }
      } else {
        if (DEBUG) console.log(`[checkGrupoActivo] ⚠️ Cache válido pero sin grupo activo`);
        return res.redirect('/onboarding-espacios');
      }
    } else {
      if (DEBUG) console.log(`[checkGrupoActivo] ⏰ Cache expirado (>30s) - Renovando...`);
    }
  }

  // Si no hay cache válido, verificar con API
  try {
    if (DEBUG) console.log(`[checkGrupoActivo] 🔍 Verificando con API...`);
    const apiClient = req.apiClient || new ApiClientV2(req.session.user.idToken);
    const grupoActivoResponse = await apiClient.obtenerGrupoActivo();
    
    if (grupoActivoResponse?.ok && grupoActivoResponse.grupo_activo) {
      req.session.grupoActivo = grupoActivoResponse.grupo_activo;
      req.session.grupoActivoVerificado = true;
      req.session.grupoActivoVerificadoEn = Date.now();
      req.grupoActivo = grupoActivoResponse.grupo_activo;
      
      // Obtener el rol del usuario en el grupo activo
      try {
        if (DEBUG) console.log(`[checkGrupoActivo] 🔍 Obteniendo miembros del grupo:`, grupoActivoResponse.grupo_activo.grupo_id);
        const miembrosResponse = await apiClient.listarMiembrosGrupo(grupoActivoResponse.grupo_activo.grupo_id);
        
        if (miembrosResponse?.ok && miembrosResponse.miembros) {
          if (DEBUG) console.log(`[checkGrupoActivo] 👥 Total miembros:`, miembrosResponse.miembros.length);
          
          const currentMember = miembrosResponse.miembros.find(m => {
            const matchSub = m.user_sub === req.session.user.sub || m.id === req.session.user.sub;
            const matchEmail = m.email === req.session.user.email || m.user_email === req.session.user.email;
            return matchSub || matchEmail;
          });
          
          if (currentMember) {
            req.session.userRole = currentMember.role || currentMember.rol;
            res.locals.userRole = req.session.userRole;
            if (DEBUG) console.log(`[checkGrupoActivo] ✅ Rol asignado: ${req.session.userRole}`);
          } else if (DEBUG) {
            console.log(`[checkGrupoActivo] ❌ Usuario NO encontrado en la lista de miembros`);
          }
        } else if (DEBUG) {
          console.log(`[checkGrupoActivo] ❌ Respuesta de miembros inválida o sin miembros`);
        }
      } catch (roleError) {
        if (DEBUG) {
          console.log(`[checkGrupoActivo] ❌ Error obteniendo rol:`, roleError.message);
        }
      }
      
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
    if (DEBUG) console.log(`[checkGrupoActivo] ❌ Error:`, error.message);
    
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
    delete req.session.userRole;
    delete req.session.nomenclaturaCache;
    if (DEBUG) console.log(`[checkGrupoActivo] 🔄 Cache invalidado`);
  }
};

module.exports = checkGrupoActivo;
