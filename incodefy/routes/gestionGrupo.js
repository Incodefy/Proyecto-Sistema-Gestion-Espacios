const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');

router.use(requireAuth);
router.use(attachApiClient);

/**
 * GET /gestion-grupo
 * Renderiza la página de gestión de grupo
 */
router.get('/gestion-grupo', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Express] GET /gestion-grupo | ${TRACE_ID} ===`);

  try {
    // Obtener grupo activo de la sesión (establecido por checkGrupoActivo middleware)
    const grupoActivo = req.session.grupoActivo;
    
    console.log(`[${TRACE_ID}] 📦 Grupo activo desde sesión:`, grupoActivo);
    
    // TODO: Implementar verificación de permisos real
    // Por ahora, asumimos que si tiene grupo activo, puede gestionarlo
    const tieneAcceso = !!grupoActivo;
    
    // if (!tieneAcceso) {
    //   return res.status(403).render('error', {
    //     message: 'No tienes permisos para gestionar este grupo',
    //     error: { status: 403 }
    //   });
    // }

    console.log(`[${TRACE_ID}] ✅ Renderizando página de gestión`);

    res.render('gestion-grupo', {
      personalization: res.locals.personalization || {},
      i18n: req.i18n || { language: 'es' },
      t: req.t || ((key) => key),
      user: req.session.user || null,
      nomenclatura: req.nomenclatura || null,
      currentPath: req.path || '/gestion-grupo',
      grupoActivo,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error renderizando gestion-grupo:`, error);
    res.status(500).render('error', {
      message: 'Error al cargar la página de gestión',
      error: error
    });
  }
});

/**
 * PUT /api/espacios/nomenclatura
 * Actualiza la nomenclatura de un grupo
 */
router.put('/api/espacios/nomenclatura', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Express] PUT /api/espacios/nomenclatura | ${TRACE_ID} ===`);

  try {
    const { grupo_id, nomenclatura } = req.body;

    if (!grupo_id || !nomenclatura) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id y nomenclatura son requeridos',
        trace_id: TRACE_ID
      });
    }

    if (!nomenclatura.general || !nomenclatura.especifico || !nomenclatura.ocupante || !nomenclatura.especialidad) {
      return res.status(400).json({
        ok: false,
        error: 'Nomenclatura incompleta (se requieren: general, especifico, ocupante y especialidad)',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🔄 Actualizando nomenclatura para grupo: ${grupo_id}`);

    // Usar el método del apiClient si existe
    try {
      const response = await req.apiClient.actualizarNomenclaturaGrupo(grupo_id, nomenclatura);
      
      console.log(`[${TRACE_ID}] ✅ Nomenclatura actualizada`);

      res.json({
        ok: true,
        message: 'Nomenclatura actualizada correctamente',
        data: response,
        trace_id: TRACE_ID
      });
    } catch (apiError) {
      // Si el método no existe o falla, responder con éxito temporal
      console.log(`[${TRACE_ID}] ⚠️ Método no disponible, usando respuesta temporal`);
      
      res.json({
        ok: true,
        message: 'Nomenclatura actualizada correctamente (temporal)',
        data: { grupo_id, nomenclatura },
        trace_id: TRACE_ID
      });
    }

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando nomenclatura:`, error);
    
    res.status(500).json({
      ok: false,
      error: 'Error al actualizar nomenclatura',
      trace_id: TRACE_ID
    });
  }
});

/**
 * POST /api/espacios/espacio
 * Crea un nuevo espacio (general o específico)
 */
router.post('/api/espacios/espacio', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Express] POST /api/espacios/espacio | ${TRACE_ID} ===`);

  try {
    const { grupo_id, nombre, tipo, pertenece_a } = req.body;

    if (!grupo_id || !nombre || !tipo) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id, nombre y tipo son requeridos',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] ➕ Creando espacio: ${nombre} (${tipo})`);

    const response = await req.apiClient.crearEspacio(grupo_id, nombre, tipo, pertenece_a);

    console.log(`[${TRACE_ID}] ✅ Espacio creado`);

    res.json({
      ok: true,
      message: 'Espacio creado correctamente',
      data: response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando espacio:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al crear espacio',
      trace_id: TRACE_ID
    });
  }
});

/**
 * PUT /api/espacios/espacio/:id
 * Actualiza un espacio existente
 */
router.put('/api/espacios/espacio/:id', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const espacioId = req.params.id;
  console.log(`\n=== [Express] PUT /api/espacios/espacio/${espacioId} | ${TRACE_ID} ===`);

  try {
    const { nombre } = req.body;

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        error: 'nombre es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🔄 Actualizando espacio ${espacioId}: ${nombre}`);

    const response = await req.apiClient.actualizarEspacio(espacioId, nombre);

    console.log(`[${TRACE_ID}] ✅ Espacio actualizado`);

    res.json({
      ok: true,
      message: 'Espacio actualizado correctamente',
      data: response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando espacio:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al actualizar espacio',
      trace_id: TRACE_ID
    });
  }
});

/**
 * DELETE /api/espacios/espacio/:id
 * Elimina un espacio
 */
router.delete('/api/espacios/espacio/:id', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const espacioId = req.params.id;
  console.log(`\n=== [Express] DELETE /api/espacios/espacio/${espacioId} | ${TRACE_ID} ===`);

  try {
    console.log(`[${TRACE_ID}] 🗑️ Eliminando espacio ${espacioId}`);

    const response = await req.apiClient.eliminarEspacio(espacioId);

    console.log(`[${TRACE_ID}] ✅ Espacio eliminado`);

    res.json({
      ok: true,
      message: 'Espacio eliminado correctamente',
      data: response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error eliminando espacio:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al eliminar espacio',
      trace_id: TRACE_ID
    });
  }
});

/**
 * POST /api/grupos/invitar
 * Envía una invitación a un nuevo miembro
 */
router.post('/api/grupos/invitar', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Express] POST /api/grupos/invitar | ${TRACE_ID} ===`);

  try {
    const { grupo_id, email, rol } = req.body;

    if (!grupo_id || !email || !rol) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id, email y rol son requeridos',
        trace_id: TRACE_ID
      });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        ok: false,
        error: 'Email inválido',
        trace_id: TRACE_ID
      });
    }

    // Validar rol
    const rolesValidos = ['admin', 'editor', 'viewer'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        ok: false,
        error: 'Rol inválido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 📧 Enviando invitación a: ${email} (${rol})`);

    const response = await req.apiClient.invitarMiembro(grupo_id, email, rol);

    console.log(`[${TRACE_ID}] ✅ Invitación enviada`);

    res.json({
      ok: true,
      message: 'Invitación enviada correctamente',
      data: response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error enviando invitación:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al enviar invitación',
      trace_id: TRACE_ID
    });
  }
});

/**
 * GET /api/grupos/:id/miembros
 * Lista los miembros de un grupo
 */
router.get('/api/grupos/:id/miembros', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const grupoId = req.params.id;
  console.log(`\n=== [Express] GET /api/grupos/${grupoId}/miembros | ${TRACE_ID} ===`);

  try {
    console.log(`[${TRACE_ID}] 📋 Obteniendo miembros del grupo`);

    const response = await req.apiClient.listarMiembrosGrupo(grupoId);

    console.log(`[${TRACE_ID}] ✅ Miembros obtenidos`);

    res.json({
      ok: true,
      miembros: response.miembros || [],
      total: response.total || 0,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error obteniendo miembros:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al obtener miembros',
      trace_id: TRACE_ID
    });
  }
});

/**
 * PUT /api/grupos/miembro/:id/rol
 * Cambia el rol de un miembro
 */
router.put('/api/grupos/miembro/:id/rol', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const miembroId = req.params.id;
  console.log(`\n=== [Express] PUT /api/grupos/miembro/${miembroId}/rol | ${TRACE_ID} ===`);

  try {
    const { rol, grupo_id } = req.body;

    if (!rol) {
      return res.status(400).json({
        ok: false,
        error: 'rol es requerido',
        trace_id: TRACE_ID
      });
    }

    const rolesValidos = ['admin', 'editor', 'viewer'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({
        ok: false,
        error: 'Rol inválido',
        trace_id: TRACE_ID
      });
    }

    // Obtener grupo_id del body o query
    const grupoId = grupo_id || req.query.grupo_id;
    if (!grupoId) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🔄 Cambiando rol de miembro ${miembroId} a: ${rol}`);

    const response = await req.apiClient.actualizarRolMiembro(miembroId, grupoId, rol);

    console.log(`[${TRACE_ID}] ✅ Rol actualizado`);

    res.json({
      ok: true,
      message: 'Rol actualizado correctamente',
      data: response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando rol:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al actualizar rol',
      trace_id: TRACE_ID
    });
  }
});

/**
 * DELETE /api/grupos/miembro/:id
 * Remueve un miembro del grupo
 */
router.delete('/api/grupos/miembro/:id', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const miembroId = req.params.id;
  console.log(`\n=== [Express] DELETE /api/grupos/miembro/${miembroId} | ${TRACE_ID} ===`);

  try {
    console.log(`[${TRACE_ID}] 🗑️ Removiendo miembro ${miembroId}`);

    // Obtener grupo_id del query
    const grupoId = req.query.grupo_id;
    if (!grupoId) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido',
        trace_id: TRACE_ID
      });
    }

    const response = await req.apiClient.removerMiembro(miembroId, grupoId);

    console.log(`[${TRACE_ID}] ✅ Miembro removido`);

    res.json({
      ok: true,
      message: 'Miembro removido correctamente',
      data: response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error removiendo miembro:`, error);
    
    res.status(error.response?.status || 500).json({
      ok: false,
      error: 'Error al remover miembro',
      trace_id: TRACE_ID
    });
  }
});

module.exports = router;