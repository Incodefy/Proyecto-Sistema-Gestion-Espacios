const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');

router.use(requireAuth);
router.use(attachApiClient);

/**
 * DEBUG ENDPOINT - Eliminar después de solucionar el problema
 */
router.get('/debug/session-info', (req, res) => {
  res.json({
    session_exists: !!req.session,
    user: {
      email: req.session?.user?.email,
      sub: req.session?.user?.sub,
      has_idToken: !!req.session?.user?.idToken,
      has_admin_permissions: req.session?.user?.has_admin_permissions,
      idToken_preview: req.session?.user?.idToken?.substring(0, 50) + '...'
    },
    grupo_activo: req.session?.grupoActivo,
    instructions: 'Para probar: cd incodefy && node test-grupos-simple.js <COPIA_EL_TOKEN_COMPLETO>'
  });
});

/**
 * DEBUG ENDPOINT - Devuelve el token completo para pruebas
 */
router.get('/debug/get-token', (req, res) => {
  if (!req.session?.user?.idToken) {
    return res.status(401).json({ error: 'No hay token en sesión' });
  }
  
  res.json({
    idToken: req.session.user.idToken,
    email: req.session.user.email,
    sub: req.session.user.sub,
    command: `cd incodefy && node test-grupos-simple.js "${req.session.user.idToken}"`
  });
});

/**
 * GET /onboarding-espacios (ruta principal del router)
 * Renderiza la página de onboarding para configuración de espacios
 */
router.get('/', async (req, res) => {
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

router.get('/api/grupos/:id', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const { id } = req.params;
  const { asignar_activo } = req.query;

  console.log(`\n=== [Express] GET /api/grupos/${id} | ${TRACE_ID} ===`);

  try {
    const response = await req.apiClient.obtenerGrupo(id);

    if (!response.ok) {
      console.warn(`[${TRACE_ID}] ⚠️ Grupo no encontrado o sin acceso`);
      return res.status(404).json(response);
    }

    // Si se solicita asignar como activo y el grupo está configurado
    if (asignar_activo === 'true' && response.group && response.group.configured === true) {
      try {
        console.log(`[${TRACE_ID}] 🔄 Asignando grupo como activo...`);
        await req.apiClient.asignarGrupoActivo(id);
        console.log(`[${TRACE_ID}] ✅ Grupo asignado como activo`);
        
        // Invalidar cache del middleware
        const checkGrupoActivo = require('../middleware/checkGrupoActivo');
        checkGrupoActivo.invalidarCache(req);
      } catch (assignErr) {
        console.warn(`[${TRACE_ID}] ⚠️ No se pudo asignar grupo como activo:`, assignErr.message);
        // No bloqueamos, continuamos
      }
    }

    console.log(`[${TRACE_ID}] ✅ Grupo obtenido exitosamente`);
    return res.json(response);
  } catch (err) {
    console.error(`[${TRACE_ID}] ❌ Error consultando grupo:`, err.message);
    return res.status(500).json({ ok: false, error: "Error consultando grupo" });
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
    const { espacios, especialidades, ocupantes, tipos_instrumentos, instrumentos, grupo_id } = req.body;

    // Validación básica en Express (antes de llamar Lambda)
    if (!grupo_id) {
      console.warn(`[${TRACE_ID}] ⚠️ Validación fallida: grupo_id no proporcionado`);
      return res.status(400).json({ 
        ok: false,
        error: 'Debe proporcionar el grupo_id',
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
      grupo_id,
      total_espacios: espacios.length,
      total_especificos: espacios.reduce((acc, e) => acc + e.specificSpaces.length, 0),
      total_especialidades: especialidades?.length || 0,
      total_ocupantes: ocupantes?.length || 0,
      total_tipos_instrumentos: tipos_instrumentos?.length || 0,
      total_instrumentos: instrumentos?.length || 0
    });

    // Llamar a Lambda
    const response = await req.apiClient.guardarEspacios(
      grupo_id, 
      espacios, 
      ocupantes, 
      especialidades,
      tipos_instrumentos || [],
      instrumentos || []
    );

    console.log(`[${TRACE_ID}] ✅ Lambda respondió exitosamente`);

    // Si todo salió bien y no hay grupo activo, asignar este como activo
    if (response && response.ok && response.grupo_id) {
      try {
        console.log(`[${TRACE_ID}] 🔄 Asignando grupo como activo...`);
        await req.apiClient.asignarGrupoActivo(response.grupo_id);
        console.log(`[${TRACE_ID}] ✅ Grupo asignado como activo`);
        
        // Invalidar el cache del middleware checkGrupoActivo
        const checkGrupoActivo = require('../middleware/checkGrupoActivo');
        checkGrupoActivo.invalidarCache(req);
        console.log(`[${TRACE_ID}] 🔄 Cache de grupo activo invalidado`);
        
        // REFRESCAR PERMISOS: Obtener los permisos del usuario en el nuevo grupo
        try {
          console.log(`[${TRACE_ID}] 🔐 Refrescando permisos del usuario...`);
          const permissionsResponse = await req.apiClient.getMyPermissions();
          
          console.log(`[${TRACE_ID}] 📋 Respuesta de permisos:`, JSON.stringify(permissionsResponse, null, 2));
          
          if (permissionsResponse?.permissions_by_group) {
            // La respuesta de Lambda ya viene con permissions_by_group expandidos
            req.session.user.permissions_by_group = permissionsResponse.permissions_by_group;
            req.session.user.has_admin_permissions = permissionsResponse.has_admin_permissions || false;
            req.session.user.groups = permissionsResponse.groups || [];
            
            // Guardar la sesión de forma explícita
            await new Promise((resolve, reject) => {
              req.session.save((err) => {
                if (err) {
                  console.error(`[${TRACE_ID}] ❌ Error guardando sesión:`, err);
                  reject(err);
                } else {
                  console.log(`[${TRACE_ID}] ✅ Sesión guardada exitosamente`);
                  resolve();
                }
              });
            });
            
            const permisosNuevoGrupo = permissionsResponse.permissions_by_group[response.grupo_id];
            console.log(`[${TRACE_ID}] ✅ Permisos refrescados y sesión guardada:`, {
              grupos: permissionsResponse.groups?.length || 0,
              rol_en_nuevo_grupo: permisosNuevoGrupo?.role,
              permisos_en_nuevo_grupo: permisosNuevoGrupo?.permissions?.length || 0,
              primeros_5_permisos: permisosNuevoGrupo?.permissions?.slice(0, 5),
              session_permissions_by_group_keys: Object.keys(req.session.user.permissions_by_group || {})
            });
          } else {
            console.warn(`[${TRACE_ID}] ⚠️ Respuesta sin permissions_by_group`);
          }
        } catch (permErr) {
          console.error(`[${TRACE_ID}] ❌ Error refrescando permisos:`, permErr.message);
          console.error(`[${TRACE_ID}] Stack:`, permErr.stack);
          // No es crítico, el usuario puede hacer logout/login
        }
        
      } catch (activateErr) {
        console.warn(`[${TRACE_ID}] ⚠️ No se pudo activar el grupo automáticamente`, activateErr.message);
        // No es crítico, continuamos
      }
    }

    res.json({
      ok: true,
      message: 'Configuración guardada correctamente',
      total_generales: response.total_generales,
      total_especificos: response.total_especificos,
      total_especialidades: response.total_especialidades || 0,
      total_ocupantes: response.total_ocupantes || 0,
      total_tipos_instrumentos: response.total_tipos_instrumentos || 0,
      total_instrumentos: response.total_instrumentos || 0,
      grupo_id: response.grupo_id,
      trace_id: TRACE_ID,
      lambda_trace_id: response.trace
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
    console.log(`[${TRACE_ID}] 🔍 Obteniendo grupos para usuario:`, {
      email: req.session?.user?.email,
      sub: req.session?.user?.sub,
      idToken: req.session?.user?.idToken ? '(presente)' : '(ausente)'
    });
    
    const response = await req.apiClient.listarGruposUsuario();
    
    console.log(`[${TRACE_ID}] 📦 Respuesta de API:`, {
      ok: response?.ok,
      total: response?.total,
      grupos: response?.grupos?.length
    });
    
    res.json(response);
  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error listando grupos:`, error);
    res.status(500).json({ ok: false, error: 'Error al obtener grupos' });
  }
});

router.post('/api/grupos', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [Express] POST /api/grupos | ${TRACE_ID} ===`);
  
  try {
    const { nombre } = req.body; // Cambiado de 'name' a 'nombre'
    console.log(`[${TRACE_ID}] 📥 Datos recibidos:`, { nombre });
    
    if (!nombre || !nombre.trim()) {
      console.warn(`[${TRACE_ID}] ⚠️ Nombre no proporcionado`);
      return res.status(400).json({ 
        ok: false, 
        error: 'Nombre del grupo es requerido',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🔄 Llamando a Lambda para crear grupo...`);
    const response = await req.apiClient.crearGrupo(nombre);

    console.log(`[${TRACE_ID}] ✅ Respuesta de Lambda:`, response);

    res.status(201).json({
      ok: true,
      group_id: response.group_id,
      trace_id: TRACE_ID,
      lambda_trace_id: response.trace_id
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error creando grupo:`, error.message);
    console.error(`[${TRACE_ID}] Stack:`, error.stack);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: lambdaError?.error || 'Error creando grupo',
      details: lambdaError?.details || error.message,
      trace_id: TRACE_ID,
      lambda_trace_id: lambdaError?.trace_id
    });
  }
});

/**
 * PUT /api/grupos/:groupId/nomenclatura
 * Actualiza la nomenclatura de un grupo
 */
router.put('/api/grupos/:groupId/nomenclatura', async (req, res) => {
  const TRACE_ID = `express-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const { groupId } = req.params;
  console.log(`\n=== [Express] PUT /api/grupos/${groupId}/nomenclatura | ${TRACE_ID} ===`);
  
  try {
    const { nomenclatura } = req.body;
    console.log(`[${TRACE_ID}] 📥 Datos recibidos:`, { nomenclatura });
    
    if (!nomenclatura || !nomenclatura.general || !nomenclatura.especifico) {
      console.warn(`[${TRACE_ID}] ⚠️ Nomenclatura incompleta`);
      return res.status(400).json({ 
        ok: false, 
        error: 'Debe proporcionar la nomenclatura completa (general y específico)',
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 🔄 Actualizando nomenclatura del grupo...`);
    const response = await req.apiClient.actualizarNomenclaturaGrupo(groupId, nomenclatura);

    console.log(`[${TRACE_ID}] ✅ Nomenclatura actualizada`);

    res.json({
      ok: true,
      message: 'Nomenclatura actualizada correctamente',
      trace_id: TRACE_ID
    });

  } catch (error) {
    console.error(`[${TRACE_ID}] ❌ Error actualizando nomenclatura:`, error.message);
    
    const lambdaError = error.response?.data;
    
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: lambdaError?.error || 'Error actualizando nomenclatura',
      details: lambdaError?.details || error.message,
      trace_id: TRACE_ID
    });
  }
});

module.exports = router;