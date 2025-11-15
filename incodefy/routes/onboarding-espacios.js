const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');

router.use(requireAuth);
router.use(attachApiClient);

/**
 * GET /onboarding-espacios
 * Renderiza la página de onboarding para configuración de espacios
 */
router.get('/onboarding-espacios', async (req, res) => {
  try {
    // Verificar si el usuario ya tiene una configuración
    let configuracionExistente = null;
    let grupoActivo = null;

    try {
      // Intentar obtener el grupo activo
      const grupoActivoResponse = await req.apiClient.obtenerGrupoActivo();
      if (grupoActivoResponse && grupoActivoResponse.ok) {
        grupoActivo = grupoActivoResponse.grupo_activo;
      }
    } catch (err) {
      // Si no hay grupo activo, es normal en onboarding
      console.log('No hay grupo activo aún');
    }

    try {
      // Obtener todas las configuraciones
      const configResponse = await req.apiClient.obtenerConfiguracionEspacios();
      if (configResponse && configResponse.ok) {
        configuracionExistente = configResponse.configuracion;
      }
    } catch (err) {
      console.log('No hay configuraciones previas');
    }

    res.render('onboarding-espacios', {
      personalization: req.personalization || {},
      i18n: req.i18n || { language: 'es' },
      t: req.t || ((key) => key),
      configuracionExistente,
      grupoActivo,
      hasConfiguration: !!configuracionExistente
    });

  } catch (error) {
    console.error('Error renderizando onboarding-espacios:', error);
    res.status(500).render('error', {
      message: 'Error al cargar la página de configuración',
      error: error
    });
  }
});

/**
 * POST /api/espacios/configuracion
 * Proxy para guardar la configuración de espacios en Lambda
 */
router.post('/api/espacios/configuracion', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Express] POST /api/espacios/configuracion | ${TRACE_ID} ===`);

  try {
    const { nomenclatura, espacios, grupo_id } = req.body;

    // Validación básica en Express (antes de llamar Lambda)
    if (!nomenclatura || !nomenclatura.general || !nomenclatura.especifico) {
      console.warn(`[${TRACE_ID}] ⚠️ Validación fallida: nomenclatura incompleta`);
      return res.status(400).json({ 
        ok: false,
        error: 'Debe proporcionar la nomenclatura completa',
        trace_id: TRACE_ID
      });
    }

    if (!espacios || espacios.length === 0) {
      console.warn(`[${TRACE_ID}] ⚠️ Validación fallida: sin espacios`);
      return res.status(400).json({ 
        ok: false,
        error: 'Debe crear al menos un espacio',
        trace_id: TRACE_ID
      });
    }

    // Validar estructura de espacios
    const isValid = espacios.every(space => 
      space.name && 
      space.name.trim() !== '' && 
      space.specificSpaces && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name && spec.name.trim() !== '')
    );

    if (!isValid) {
      console.warn(`[${TRACE_ID}] ⚠️ Validación fallida: estructura de espacios incorrecta`);
      return res.status(400).json({ 
        ok: false,
        error: 'Todos los espacios deben tener nombre y al menos un espacio específico',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] ✅ Validaciones pasadas, llamando a Lambda...`);
    console.log(`[${TRACE_ID}] 📊 Datos:`, {
      nomenclatura,
      total_espacios: espacios.length,
      total_especificos: espacios.reduce((acc, e) => acc + e.specificSpaces.length, 0)
    });

    // Llamar a Lambda
    const response = await req.apiClient.guardarConfiguracionEspacios(nomenclatura, espacios, grupo_id);

    console.log(`[${TRACE_ID}] ✅ Lambda respondió exitosamente`);

    // Si todo salió bien y no hay grupo activo, asignar este como activo
    if (response && response.ok && response.data.grupo_id) {
      try {
        console.log(`[${TRACE_ID}] 🔄 Asignando grupo como activo...`);
        await req.apiClient.asignarGrupoActivo(response.data.grupo_id);
        console.log(`[${TRACE_ID}] ✅ Grupo asignado como activo`);
      } catch (activateErr) {
        console.warn(`[${TRACE_ID}] ⚠️ No se pudo activar el grupo automáticamente`, activateErr.message);
        // No es crítico, continuamos
      }
    }

    res.json({
      ok: true,
      message: 'Configuración guardada correctamente',
      data: response.data,
      trace_id: TRACE_ID,
      lambda_trace_id: response.trace_id
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error guardando configuración:`, error.message);
    
    // Extraer información del error de Lambda si está disponible
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al guardar la configuración',
      details: lambdaError?.details || error.message,
      trace_id: TRACE_ID,
      lambda_trace_id: lambdaError?.trace_id
    });
  }
});

/**
 * GET /api/espacios/configuracion
 * Obtiene la configuración de espacios del usuario
 */
router.get('/api/espacios/configuracion', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const { grupo_id } = req.query;

    console.log(`[${TRACE_ID}] 🔍 Obteniendo configuración${grupo_id ? ` para grupo: ${grupo_id}` : ''}`);

    const response = await req.apiClient.obtenerConfiguracionEspacios(grupo_id);

    console.log(`[${TRACE_ID}] ✅ Configuración obtenida`);

    res.json({
      ok: true,
      ...response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error obteniendo configuración:`, error.message);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al obtener la configuración',
      trace_id: TRACE_ID
    });
  }
});

/**
 * GET /api/espacios/lista
 * Lista todos los espacios de un grupo
 */
router.get('/api/espacios/lista', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const { grupo_id } = req.query;

    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 📋 Listando espacios del grupo: ${grupo_id}`);

    const response = await req.apiClient.listarEspacios(grupo_id);

    console.log(`[${TRACE_ID}] ✅ Espacios obtenidos: ${response.total}`);

    res.json({
      ok: true,
      ...response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error listando espacios:`, error.message);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al listar espacios',
      trace_id: TRACE_ID
    });
  }
});

/**
 * PUT /api/espacios/asignar-grupo
 * Asigna un grupo como activo para el usuario
 */
router.put('/api/espacios/asignar-grupo', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const { grupo_id } = req.body;

    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🎯 Asignando grupo activo: ${grupo_id}`);

    const response = await req.apiClient.asignarGrupoActivo(grupo_id);

    console.log(`[${TRACE_ID}] ✅ Grupo asignado exitosamente`);

    res.json({
      ok: true,
      ...response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error asignando grupo:`, error.message);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al asignar grupo activo',
      trace_id: TRACE_ID
    });
  }
});

/**
 * GET /api/espacios/grupo-activo
 * Obtiene el grupo activo del usuario
 */
router.get('/api/espacios/grupo-activo', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    console.log(`[${TRACE_ID}] 🔍 Obteniendo grupo activo`);

    const response = await req.apiClient.obtenerGrupoActivo();

    console.log(`[${TRACE_ID}] ✅ Grupo activo obtenido`);

    res.json({
      ok: true,
      ...response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error obteniendo grupo activo:`, error.message);
    
    // Si es 404, es porque no hay grupo activo (no es error crítico)
    if (error.response?.status === 404) {
      return res.status(404).json({
        ok: false,
        error: 'No hay grupo activo asignado',
        trace_id: TRACE_ID
      });
    }
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al obtener grupo activo',
      trace_id: TRACE_ID
    });
  }
});

/**
 * DELETE /api/espacios/configuracion
 * Elimina una configuración completa
 */
router.delete('/api/espacios/configuracion', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const { grupo_id } = req.query;

    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🗑️ Eliminando configuración: ${grupo_id}`);

    const response = await req.apiClient.eliminarConfiguracionEspacios(grupo_id);

    console.log(`[${TRACE_ID}] ✅ Configuración eliminada`);

    res.json({
      ok: true,
      ...response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error eliminando configuración:`, error.message);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al eliminar configuración',
      trace_id: TRACE_ID
    });
  }
});

/**
 * GET /api/espacios/estadisticas
 * Obtiene estadísticas de uso de espacios (helper endpoint)
 */
router.get('/api/espacios/estadisticas', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const { grupo_id } = req.query;

    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 📊 Obteniendo estadísticas para: ${grupo_id}`);

    // Obtener la lista de espacios
    const espaciosResponse = await req.apiClient.listarEspacios(grupo_id);

    const espacios = espaciosResponse.espacios || [];
    
    // Calcular estadísticas básicas
    const espaciosGenerales = espacios.filter(e => e.tipo && !e.pertenece_a);
    const espaciosEspecificos = espacios.filter(e => e.pertenece_a);

    const estadisticas = {
      total_espacios: espacios.length,
      espacios_generales: espaciosGenerales.length,
      espacios_especificos: espaciosEspecificos.length,
      promedio_especificos_por_general: espaciosGenerales.length > 0 
        ? (espaciosEspecificos.length / espaciosGenerales.length).toFixed(2)
        : 0,
      grupo_id
    };

    console.log(`[${TRACE_ID}] ✅ Estadísticas calculadas`);

    res.json({
      ok: true,
      estadisticas,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error obteniendo estadísticas:`, error.message);
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: 'Error al obtener estadísticas',
      trace_id: TRACE_ID
    });
  }
});

/**
 * GET /api/espacios/grupos-usuario
 * Lista todos los grupos a los que pertenece el usuario
 */
router.get('/api/espacios/grupos-usuario', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    console.log(`[${TRACE_ID}] 📋 Obteniendo grupos del usuario`);

    const response = await req.apiClient.listarGruposUsuario();

    console.log(`[${TRACE_ID}] ✅ Grupos obtenidos: ${response.total}`);

    res.json({
      ok: true,
      ...response,
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error obteniendo grupos:`, error.message);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false,
      error: lambdaError?.error || 'Error al obtener grupos',
      trace_id: TRACE_ID
    });
  }
});

module.exports = router;