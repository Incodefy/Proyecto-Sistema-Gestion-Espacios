// middleware/nomenclatura.js

const DEBUG = process.env.DEBUG_NOMENCLATURA === 'true';

/**
 * Middleware para obtener la nomenclatura del grupo activo
 * y hacerla disponible en res.locals para todas las vistas
 * OPTIMIZADO: Cache en sesión + logs opcionales + skip rutas API
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

  // Skip para rutas API (no necesitan nomenclatura)
  if (req.path.startsWith('/api/')) {
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

    // Verificar cache en sesión (dura toda la sesión)
    if (req.session.nomenclaturaCache && 
        req.session.nomenclaturaCache.grupoId === grupoId) {
      res.locals.nomenclatura = req.session.nomenclaturaCache.data;
      req.nomenclatura = req.session.nomenclaturaCache.data;
      if (DEBUG) console.log('[Nomenclatura] ✅ Usando cache de sesión');
      return next();
    }

    // Si ya está en grupoActivo.nomenclatura, usar directamente
    if (grupoActivo.nomenclatura) {
      res.locals.nomenclatura = grupoActivo.nomenclatura;
      req.nomenclatura = grupoActivo.nomenclatura;
      
      // Guardar en cache de sesión
      req.session.nomenclaturaCache = {
        grupoId,
        data: grupoActivo.nomenclatura
      };
      
      if (DEBUG) console.log('[Nomenclatura] ✅ Usando nomenclatura de grupoActivo');
      return next();
    }

    // Último recurso: llamar a API (solo si no hay cache)
    if (req.apiClient) {
      const grupoResponse = await Promise.race([
        req.apiClient.obtenerGrupo(grupoId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      
      if (grupoResponse?.ok && grupoResponse.group?.nomenclatura) {
        res.locals.nomenclatura = grupoResponse.group.nomenclatura;
        req.nomenclatura = grupoResponse.group.nomenclatura;
        
        // Guardar en cache de sesión
        req.session.nomenclaturaCache = {
          grupoId,
          data: grupoResponse.group.nomenclatura
        };
        
        if (DEBUG) console.log('[Nomenclatura] ✅ Cargado desde API y cacheado');
      }
    }
  } catch (error) {
    if (DEBUG) console.log('[Nomenclatura] ⚠️ Error:', error.message);
  }

  next();
}

module.exports = nomenclaturaMiddleware;
