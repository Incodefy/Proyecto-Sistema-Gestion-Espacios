// routes/api.js
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { refreshUserPersonalization } = require('./auth');

// Middleware para verificar autenticación en API
const requireAuthAPI = (req, res, next) => {
  if (!req.session.user || !req.session.user.idToken) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  next();
};

// POST /api/personalization - Actualizar personalización del usuario
router.post('/personalization', requireAuthAPI, async (req, res) => {
  try {
    console.log('📝 Actualizando personalización:', req.body);

    const response = await fetch(`${process.env.API_BASE_URL}/personalization`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (response.ok && (data.ok || data.success)) {
      // Extraer los final_parameters
      const responseData = data.data || data;
      const finalParameters = responseData.final_parameters || {};
      
      console.log('✅ Personalización guardada. Final parameters:', finalParameters);
      console.log('🔵 NODE.JS - Respuesta completa del Lambda:', JSON.stringify(responseData, null, 2));
      
      // Actualizar la personalización en la sesión (merge con valores existentes)
      if (Object.keys(finalParameters).length > 0) {
        // Hacer merge en lugar de reemplazar completo
        req.session.user.personalization = {
          ...req.session.user.personalization,
          ...finalParameters
        };
        console.log('🔵 NODE.JS - Sesión actualizada con:', JSON.stringify(req.session.user.personalization, null, 2));
        
        // Manejo especial del idioma
        const newLang = finalParameters['locale.language'];
        if (newLang && typeof newLang === 'string') {
          req.session.language = newLang;
          
          // Cambiar idioma en i18n si es necesario
          if (req.i18n?.language !== newLang) {
            try {
              req.i18n.changeLanguage(newLang);
            } catch (e) {
              console.warn('⚠️ No se pudo cambiar idioma en i18n:', e.message);
            }
          }
          
          // El idioma se persiste SOLO en la sesión (cookie httpOnly segura)
          // No usamos cookie 'i18next' separada porque no soporta httpOnly
        }
      }
      
      // Guardar sesión antes de responder
      req.session.save((err) => {
        if (err) {
          console.error('❌ Error guardando sesión:', err);
          return res.status(500).json({
            ok: false,
            error: 'Error guardando la sesión'
          });
        }
        
        console.log('✅ Sesión actualizada correctamente');
        return res.json({
          ok: true,
          message: 'Personalización actualizada correctamente',
          saved_parameters: responseData.saved_parameters,
          personalization: finalParameters
        });
      });
    } else {
      console.error('❌ Error del API de personalización:', data);
      res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('❌ Error actualizando personalización:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// GET /api/personalization - Obtener personalización actual
router.get('/personalization', requireAuthAPI, async (req, res) => {
  try {
    const response = await fetch(process.env.API_BASE_URL,
      {
        headers: {
          'Authorization': `Bearer ${req.session.user.idToken}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      const errorData = await response.json();
      res.status(response.status).json(errorData);
    }
  } catch (error) {
    console.error('❌ Error obteniendo personalización:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno del servidor' 
    });
  }
});

// === RUTAS DE PRUEBA/DEBUG ===
router.get('/test/espacios-methods', requireAuthAPI, async (req, res) => {
  try {
    const { grupo_id } = req.query;
    
    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido en query params'
      });
    }
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    const results = {};
    
    // Test obtenerConfiguracionEspacios
    try {
      console.log('🧪 Testing obtenerConfiguracionEspacios...');
      const config = await apiClient.obtenerConfiguracionEspacios(grupo_id);
      results.configuracion = {
        success: true,
        data: config,
        type: typeof config,
        keys: Object.keys(config || {})
      };
    } catch (error) {
      results.configuracion = {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
    
    // Test listarEspacios
    try {
      console.log('🧪 Testing listarEspacios...');
      const espacios = await apiClient.listarEspacios(grupo_id);
      results.espacios = {
        success: true,
        data: espacios,
        type: typeof espacios,
        keys: Object.keys(espacios || {})
      };
    } catch (error) {
      results.espacios = {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
    
    // Test obtenerGrupo
    try {
      console.log('🧪 Testing obtenerGrupo...');
      const grupo = await apiClient.obtenerGrupo(grupo_id);
      results.grupo = {
        success: true,
        data: grupo,
        type: typeof grupo,
        keys: Object.keys(grupo || {})
      };
    } catch (error) {
      results.grupo = {
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      };
    }
    
    res.json({
      ok: true,
      grupo_id,
      results
    });
    
  } catch (error) {
    console.error('❌ Error en test:', error);
    res.status(500).json({
      ok: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// TEST DELETE - Debug endpoint
router.delete('/test/delete-espacio/:id', requireAuthAPI, async (req, res) => {
  try {
    const rawId = req.params.id;
    const decodedId = decodeURIComponent(req.params.id);
    const { grupo_id } = req.query;
    
    console.log('\n🧪 === TEST DELETE DEBUG ===');
    console.log('📦 Raw params.id:', rawId);
    console.log('📦 Decoded params.id:', decodedId);
    console.log('📦 Query grupo_id:', grupo_id);
    console.log('📦 Full query:', req.query);
    console.log('📦 Full params:', req.params);
    console.log('📦 Full URL:', req.url);
    console.log('📦 Original URL:', req.originalUrl);
    
    res.json({
      ok: true,
      debug: {
        rawId,
        decodedId,
        grupo_id,
        query: req.query,
        params: req.params,
        url: req.url,
        originalUrl: req.originalUrl
      }
    });
  } catch (error) {
    console.error('❌ Error en test delete:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// GET /api/espacios/grupo-activo - Obtener grupo activo del usuario
router.get('/espacios/grupo-activo', requireAuthAPI, async (req, res) => {
  try {
    console.log('📋 GET /api/espacios/grupo-activo - Usuario:', req.session.user?.email);
    
    // Obtener desde sesión primero (más rápido)
    const grupoActivoSesion = req.session.grupoActivo;
    
    if (grupoActivoSesion) {
      console.log('✅ Grupo activo desde sesión:', grupoActivoSesion);
      return res.json({
        ok: true,
        grupo_activo: grupoActivoSesion
      });
    }
    
    // Si no está en sesión, obtener desde personalización
    const personalizacion = res.locals.personalization || req.session.user?.personalization;
    const grupoActivoPersonalizacion = personalizacion?.['espacios.grupo_activo'];
    
    if (grupoActivoPersonalizacion?.grupo_id) {
      // Obtener detalles completos del grupo usando apiClient
      const ApiClientV2 = require('../apiClientV2');
      const apiClient = new ApiClientV2(req.session.user.idToken);
      
      try {
        const grupoResponse = await apiClient.obtenerGrupo(grupoActivoPersonalizacion.grupo_id);
        
        console.log('✅ Respuesta obtenerGrupo:', grupoResponse);
        
        // Extraer el objeto group de la respuesta
        const grupoDetalles = grupoResponse.group || grupoResponse;
        
        // Asegurar que tenga la estructura correcta
        const grupoFormateado = {
          grupo_id: grupoDetalles.group_id,
          nombre: grupoDetalles.nombre,
          created_at: grupoDetalles.created_at,
          owner_sub: grupoDetalles.owner_sub,
          nomenclatura: grupoDetalles.nomenclatura || null
        };
        
        console.log('✅ Grupo activo formateado:', grupoFormateado);
        
        return res.json({
          ok: true,
          grupo_activo: grupoFormateado
        });
      } catch (error) {
        console.error('⚠️ Error obteniendo detalles del grupo:', error);
        // Devolver lo que tenemos aunque sea parcial
        return res.json({
          ok: true,
          grupo_activo: {
            grupo_id: grupoActivoPersonalizacion.grupo_id,
            asignado_en: grupoActivoPersonalizacion.asignado_en
          }
        });
      }
    }
    
    // No hay grupo activo
    console.log('ℹ️ No hay grupo activo');
    return res.status(404).json({
      ok: false,
      error: 'No hay grupo activo'
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo grupo activo:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

// GET /api/espacios/grupos-usuario - Listar todos los grupos del usuario
router.get('/espacios/grupos-usuario', requireAuthAPI, async (req, res) => {
  try {
    console.log('📋 GET /api/espacios/grupos-usuario - Usuario:', req.session.user?.email);
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    const response = await apiClient.listarGruposUsuario();
    
    console.log('✅ Grupos obtenidos:', response);
    
    // La respuesta puede venir como { grupos: [...] } o directamente como array
    const grupos = response.grupos || response;
    
    res.json({
      ok: true,
      grupos: grupos,
      total: grupos.length
    });
    
  } catch (error) {
    console.error('❌ Error listando grupos:', error);
    
    // Si es 404, devolver array vacío en lugar de error
    if (error.response?.status === 404) {
      return res.json({
        ok: true,
        grupos: [],
        total: 0
      });
    }
    
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: 'Error obteniendo grupos',
      details: error.message
    });
  }
});

// PUT /api/espacios/asignar-grupo - Cambiar el grupo activo
router.put('/espacios/asignar-grupo', requireAuthAPI, async (req, res) => {
  try {
    const { grupo_id } = req.body;
    
    console.log('🔄 PUT /api/espacios/asignar-grupo - Grupo:', grupo_id);
    console.log('🔄 Usuario:', req.session.user?.email);
    
    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido'
      });
    }
    
    // Primero obtener detalles del grupo para validar que existe y el usuario tiene acceso
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    let grupoDetalles;
    try {
      console.log('📡 Obteniendo detalles del grupo:', grupo_id);
      const grupoResponse = await apiClient.obtenerGrupo(grupo_id);
      grupoDetalles = grupoResponse.group || grupoResponse;
      
      console.log('✅ Grupo encontrado:', grupoDetalles);
    } catch (error) {
      console.error('❌ Error obteniendo grupo:', error.message);
      console.error('❌ Stack:', error.stack);
      return res.status(404).json({
        ok: false,
        error: 'Grupo no encontrado o sin acceso',
        details: error.message
      });
    }
    
    // Actualizar en personalización del usuario
    const API_BASE_URL = process.env.API_BASE_URL;
    console.log('📡 Actualizando personalización en:', `${API_BASE_URL}/personalization`);
    
    const response = await fetch(`${API_BASE_URL}/personalization`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parameters: {
          'espacios.grupo_activo': {
            grupo_id: grupo_id,
            asignado_en: new Date().toISOString()
          }
        }
      })
    });
    
    const data = await response.json();
    console.log('📥 Respuesta de personalización:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('❌ Error actualizando personalización:', data);
      console.error('❌ Validation errors:', data.error?.details?.validationErrors);
      throw new Error(data.error?.message || 'Error actualizando personalización en Lambda');
    }
    
    // Actualizar personalización en sesión
    try {
      const finalParameters = data.data?.final_parameters || data.final_parameters || {};
      if (Object.keys(finalParameters).length > 0) {
        req.session.user.personalization = finalParameters;
        console.log('✅ Personalización actualizada en sesión');
      }
    } catch (err) {
      console.warn('⚠️ Error actualizando personalización en sesión:', err.message);
    }
    
    // Actualizar grupo activo en sesión inmediatamente
    req.session.grupoActivo = {
      grupo_id: grupoDetalles.group_id,
      nombre: grupoDetalles.nombre,
      nomenclatura: grupoDetalles.nomenclatura || null,
      configured: !!grupoDetalles.nomenclatura,
      asignado_en: new Date().toISOString()
    };
    
    // Invalidar caché de verificación de checkGrupoActivo
    delete req.session.grupoActivoVerificado;
    delete req.session.grupoActivoVerificadoEn;
    
    // Guardar sesión explícitamente
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('❌ Error guardando sesión:', err);
          reject(err);
        } else {
          console.log('✅ Sesión guardada correctamente');
          resolve();
        }
      });
    });
    
    console.log('✅ Grupo activo actualizado:', grupo_id);
    console.log('✅ Sesión actualizada con nuevo grupo:', req.session.grupoActivo);
    
    res.json({
      ok: true,
      message: 'Grupo activo actualizado',
      grupo_id: grupo_id,
      grupo_activo: req.session.grupoActivo
    });
    
  } catch (error) {
    console.error('❌ Error completo asignando grupo:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      ok: false, 
      error: 'Error asignando grupo',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/espacios/configuracion - Obtener configuración de espacios de un grupo
router.get('/espacios/configuracion', requireAuthAPI, async (req, res) => {
  try {
    const { grupo_id } = req.query;
    
    console.log('📋 GET /api/espacios/configuracion - Grupo:', grupo_id);
    
    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido'
      });
    }
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    try {
      // La nomenclatura está en obtenerGrupo, no en obtenerConfiguracionEspacios
      const grupoResponse = await apiClient.obtenerGrupo(grupo_id);
      const grupo = grupoResponse.group || grupoResponse;
      
      console.log('✅ Grupo obtenido:', grupo);
      
      // Devolver la nomenclatura del grupo
      const configuracion = {
        ok: true,
        configuracion: grupo.nomenclatura || null,
        grupo_id: grupo_id
      };
      
      console.log('✅ Configuración formateada:', configuracion);
      
      // Headers para prevenir cache
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json(configuracion);
      
    } catch (error) {
      console.error('❌ Error obteniendo grupo:', error.message);
      
      // Si es 404, devolver configuración vacía
      if (error.response?.status === 404) {
        return res.json({
          ok: true,
          configuracion: null,
          grupo_id
        });
      }
      
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: 'Error obteniendo configuración',
      details: error.message
    });
  }
});

// GET /api/espacios/lista - Listar espacios de un grupo
router.get('/espacios/lista', requireAuthAPI, async (req, res) => {
  try {
    const { grupo_id } = req.query;
    
    console.log('📋 GET /api/espacios/lista - Grupo:', grupo_id);
    
    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido'
      });
    }
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    const response = await apiClient.listarEspacios(grupo_id);
    
    console.log('✅ Respuesta de listarEspacios:', response);
    
    // La respuesta ya tiene la estructura correcta: { ok, grupo_id, espacios, total }
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error listando espacios:', error);
    
    // Si es 404, devolver lista vacía
    if (error.response?.status === 404) {
      return res.json({
        ok: true,
        grupo_id: req.query.grupo_id,
        espacios: [],
        total: 0
      });
    }
    
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: 'Error listando espacios',
      details: error.message
    });
  }
});

// POST /api/espacios/espacio - Crear un nuevo espacio
router.post('/espacios/espacio', requireAuthAPI, async (req, res) => {
  try {
    const { grupo_id, nombre, tipo, pertenece_a } = req.body;
    
    console.log('➕ POST /api/espacios/espacio - Creando:', { grupo_id, nombre, tipo, pertenece_a });
    
    if (!grupo_id || !nombre || !tipo) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id, nombre y tipo son requeridos'
      });
    }
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    const response = await apiClient.crearEspacio({
      grupo_id,
      nombre,
      tipo,
      pertenece_a
    });
    
    console.log('✅ Espacio creado:', response);
    
    res.status(201).json(response);
    
  } catch (error) {
    console.error('❌ Error creando espacio:', error);
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: 'Error creando espacio',
      details: error.message
    });
  }
});

// PUT /api/espacios/espacio/:id - Actualizar un espacio
router.put('/espacios/espacio/:id', requireAuthAPI, async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const { nombre, grupo_id } = req.body;
    
    console.log('✏️ PUT /api/espacios/espacio/:id - Actualizando:', { 
      id, 
      nombre, 
      grupo_id,
      rawParams: req.params.id 
    });
    
    if (!nombre || !grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'nombre y grupo_id son requeridos'
      });
    }
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    const response = await apiClient.actualizarEspacio(id, {
      nombre,
      grupo_id
    });
    
    console.log('✅ Espacio actualizado:', response);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error actualizando espacio:', error);
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: 'Error actualizando espacio',
      details: error.message
    });
  }
});

// DELETE /api/espacios/espacio/:id - Eliminar un espacio
router.delete('/espacios/espacio/:id', requireAuthAPI, async (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const { grupo_id } = req.query;
    
    console.log('🗑️ DELETE /api/espacios/espacio/:id - Eliminando:', { 
      id, 
      grupo_id,
      rawParams: req.params.id,
      query: req.query 
    });
    
    if (!grupo_id) {
      return res.status(400).json({
        ok: false,
        error: 'grupo_id es requerido'
      });
    }
    
    const ApiClientV2 = require('../apiClientV2');
    const apiClient = new ApiClientV2(req.session.user.idToken);
    
    const response = await apiClient.eliminarEspacio(id, grupo_id);
    
    console.log('✅ Espacio eliminado:', response);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error eliminando espacio:', error);
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: 'Error eliminando espacio',
      details: error.message
    });
  }
});

module.exports = router;