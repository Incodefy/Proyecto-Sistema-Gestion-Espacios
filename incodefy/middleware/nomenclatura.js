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

    // ⭐ Obtener nomenclatura fresca del grupo (optimizado sin timeout artificial)
    if (req.apiClient) {
      try {
        const grupoResponse = await req.apiClient.obtenerGrupo(grupoId);
        
        if (grupoResponse?.ok && grupoResponse.group?.nomenclatura) {
          res.locals.nomenclatura = grupoResponse.group.nomenclatura;
          req.nomenclatura = grupoResponse.group.nomenclatura;
          
          if (DEBUG) console.log('[Nomenclatura] ✅ Cargado fresco desde API:', grupoResponse.group.nomenclatura);
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
