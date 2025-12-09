// middleware/nomenclatura.js

const DEBUG = process.env.DEBUG_NOMENCLATURA === 'true';

/**
 * Middleware para obtener la nomenclatura del grupo activo
 * y hacerla disponible en res.locals para todas las vistas
 * OPTIMIZADO: Cache en sesión (5 minutos) + skip rutas API y estáticas
 */
async function nomenclaturaMiddleware(req, res, next) {
  // Valores por defecto
  const defaults = {
    general: 'General',
    especifico: 'Específico',
    ocupante: 'Ocupante',
    especialidad: 'Especialidad',
    instrumento: 'Instrumento'
  };

  res.locals.nomenclatura = defaults;
  req.nomenclatura = defaults;

  // Skip para rutas API y archivos estáticos (no necesitan nomenclatura)
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') ||
      req.path.startsWith('/icons/') ||
      req.path.startsWith('/logos/') ||
      req.path.startsWith('/fondo/') ||
      /\.(css|js|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|map|webp)$/i.test(req.path)) {
    return next();
  }

  // Solo ejecutar si hay usuario autenticado y grupo activo
  if (!req.session.user || !req.session.grupoActivo) {
    return next();
  }

  try {
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
    
    if (!grupoId) {
      return next();
    }

    // ⭐ CACHE: Usar nomenclatura de sesión si está disponible y es reciente (5 minutos)
    if (req.session.nomenclatura && req.session.nomenclaturaGrupoId === grupoId) {
      const cacheValido = Date.now() - (req.session.nomenclaturaFetchedAt || 0) < 5 * 60 * 1000; // 5 minutos
      
      if (cacheValido) {
        res.locals.nomenclatura = req.session.nomenclatura;
        req.nomenclatura = req.session.nomenclatura;
        if (DEBUG) console.log('[Nomenclatura] ✅ Usando cache (5min):', req.session.nomenclatura);
        return next();
      }
    }

    // ⭐ Obtener nomenclatura fresca del grupo solo si cache expiró
    if (req.apiClient) {
      try {
        const grupoResponse = await req.apiClient.obtenerGrupo(grupoId);
        
        if (grupoResponse?.ok && grupoResponse.group?.nomenclatura) {
          const nomenclatura = grupoResponse.group.nomenclatura;
          
          // Guardar en cache de sesión
          req.session.nomenclatura = nomenclatura;
          req.session.nomenclaturaGrupoId = grupoId;
          req.session.nomenclaturaFetchedAt = Date.now();
          
          res.locals.nomenclatura = nomenclatura;
          req.nomenclatura = nomenclatura;
          
          if (DEBUG) console.log('[Nomenclatura] ✅ Cargado fresco desde API y cacheado:', nomenclatura);
        } else {
          if (DEBUG) console.log('[Nomenclatura] ⚠️ No se encontró nomenclatura en el grupo');
        }
      } catch (apiError) {
        if (DEBUG) console.log('[Nomenclatura] ⚠️ Error de API:', apiError.message);
      }
    }
  } catch (error) {
    if (DEBUG) console.log('[Nomenclatura] ⚠️ Error:', error.message);
  }

  next();
}

module.exports = nomenclaturaMiddleware;
