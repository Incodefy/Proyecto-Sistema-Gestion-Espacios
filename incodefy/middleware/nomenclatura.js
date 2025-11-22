// middleware/nomenclatura.js
const DEBUG = process.env.DEBUG_MIDDLEWARE === 'true';

/**
 * Middleware para obtener la nomenclatura del grupo activo
 * y hacerla disponible en res.locals para todas las vistas
 */
async function nomenclaturaMiddleware(req, res, next) {
  // Valores por defecto
  res.locals.nomenclatura = {
    general: 'General',
    especifico: 'Específico',
    ocupante: 'Ocupante'
  };
  req.nomenclatura = res.locals.nomenclatura;

  // Solo ejecutar si hay usuario autenticado y grupo activo
  if (!req.session.user || !req.session.grupoActivo) {
    return next();
  }

  try {
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;

    if (grupoId && req.apiClient) {
      // Agregar timeout de 5 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout obtaining group')), 5000)
      );
      
      const grupoResponse = await Promise.race([
        req.apiClient.obtenerGrupo(grupoId),
        timeoutPromise
      ]);
      
      if (grupoResponse && grupoResponse.ok && grupoResponse.group?.nomenclatura) {
        res.locals.nomenclatura = grupoResponse.group.nomenclatura;
        req.nomenclatura = grupoResponse.group.nomenclatura;
        
        if (DEBUG) {
          console.log('[Nomenclatura] ✅ Loaded for', grupoId);
        }
      } else {
        req.nomenclatura = res.locals.nomenclatura;
      }
    } else {
      req.nomenclatura = res.locals.nomenclatura;
    }
  } catch (error) {
    if (DEBUG) console.error('[Nomenclatura] ❌ Error:', error.message);
    req.nomenclatura = res.locals.nomenclatura;
  }

  next();
}

module.exports = nomenclaturaMiddleware;
