// middleware/nomenclatura.js

/**
 * Middleware para obtener la nomenclatura del grupo activo
 * y hacerla disponible en res.locals para todas las vistas
 */
async function nomenclaturaMiddleware(req, res, next) {
  console.log('\n[Nomenclatura] ══════════ INICIO ══════════');
  console.log('[Nomenclatura] 🛣️  Ruta:', req.path);
  console.log('[Nomenclatura] 👤 Usuario:', req.session?.user?.email || 'NINGUNO');
  console.log('[Nomenclatura] 📦 Grupo activo:', req.session?.grupoActivo?.grupo_id || 'NINGUNO');
  console.log('[Nomenclatura] 🔌 API Client:', req.apiClient ? 'PRESENTE' : 'AUSENTE');

  // Valores por defecto
  res.locals.nomenclatura = {
    general: 'General',
    especifico: 'Específico',
    ocupante: 'Ocupante'
  };
  req.nomenclatura = res.locals.nomenclatura;

  // Solo ejecutar si hay usuario autenticado y grupo activo
  if (!req.session.user || !req.session.grupoActivo) {
    console.log('[Nomenclatura] ⚠️ Sin usuario o grupo activo, usando defaults');
    console.log('[Nomenclatura] ══════════ FIN ══════════\n');
    return next();
  }

  try {
    const grupoActivo = req.session.grupoActivo;
    const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
    
    console.log('[Nomenclatura] 🔍 Grupo ID extraído:', grupoId);

    if (grupoId && req.apiClient) {
      console.log('[Nomenclatura] 📡 Llamando a obtenerGrupo()...');
      
      // Agregar timeout de 5 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout obtaining group')), 5000)
      );
      
      const grupoResponse = await Promise.race([
        req.apiClient.obtenerGrupo(grupoId),
        timeoutPromise
      ]);
      
      console.log('[Nomenclatura] ✅ Respuesta recibida:', grupoResponse?.ok);
      
      if (grupoResponse && grupoResponse.ok && grupoResponse.group?.nomenclatura) {
        res.locals.nomenclatura = grupoResponse.group.nomenclatura;
        req.nomenclatura = grupoResponse.group.nomenclatura; // También en req para acceso directo
        console.log('[Nomenclatura] ✅ Nomenclatura actualizada:', res.locals.nomenclatura);
      } else {
        console.log('[Nomenclatura] ⚠️ Respuesta inválida, usando defaults');
        req.nomenclatura = res.locals.nomenclatura;
      }
    } else {
      console.log('[Nomenclatura] ⚠️ Sin grupoId o apiClient, usando defaults');
      req.nomenclatura = res.locals.nomenclatura;
    }
  } catch (error) {
    console.log('[Nomenclatura] ❌ Error:', error.message);
    console.log('[Nomenclatura] ⚠️ Usando nomenclatura por defecto');
    req.nomenclatura = res.locals.nomenclatura;
  }

  console.log('[Nomenclatura] ══════════ FIN ══════════\n');
  next();
}

module.exports = nomenclaturaMiddleware;
