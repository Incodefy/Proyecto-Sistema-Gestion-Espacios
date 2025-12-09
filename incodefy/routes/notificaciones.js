// routes/notificaciones.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const attachApiClient = require('../middleware/apiClient');
const checkPermission = require("../middleware/checkPermission");

router.use(requireAuth);
router.use(attachApiClient);

router.get('/historial-notificaciones', checkPermission('notificacion.read'), async (req, res) => {
  try {
    // Obtener preferencias de notificaciones del usuario
    const preferencias = await obtenerPreferenciasNotificaciones(req.session.user.sub);
    
    res.render('historial_notificaciones', {
      currentPath: req.path,
      personalization: res.locals.personalization || {},
      user: req.session.user,
      grupoActivo: req.session.grupoActivo,
      preferenciasNotificaciones: preferencias,
      wsEndpoint: process.env.WS_ENDPOINT || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev'
    });
  } catch (error) {
    console.error('Error al cargar preferencias:', error);
    res.render('historial_notificaciones', {
      currentPath: req.path,
      personalization: res.locals.personalization || {},
      user: req.session.user,
      grupoActivo: req.session.grupoActivo,
      preferenciasNotificaciones: getDefaultPreferencias(),
      wsEndpoint: process.env.WS_ENDPOINT || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev'
    });
  }
});

router.get('/notificaciones-usuario', async (req, res) => {
  try {
    // Prevenir cache
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    });

    console.log('📡 Obteniendo notificaciones del usuario:', req.session.user.email);

    // Obtener notificaciones usando el nuevo endpoint
    const grupoActivoId = req.session.grupoActivo?.grupo_id || req.session.grupoActivo;
    
    const filtros = {
      limit: parseInt(req.query.limit) || 50,
      grupo_id: req.query.grupo_id || grupoActivoId,
      solo_no_leidas: req.query.solo_no_leidas === 'true'
    };

    console.log('🔍 Filtros aplicados:', JSON.stringify(filtros, null, 2));

    const result = await req.apiClient.obtenerNotificaciones(filtros);
    
    console.log('🔍 Respuesta completa del API:', JSON.stringify(result, null, 2));
    
    if (!result.ok) {
      console.error('❌ Error en respuesta:', result.error);
      return res.status(500).json({ 
        error: 'Error al cargar notificaciones',
        message: result.error
      });
    }

    const notificaciones = result.notifications || [];
    console.log(`✅ ${notificaciones.length} notificaciones obtenidas`);
    console.log('📋 IDs de notificaciones:', notificaciones.map(n => n.id).join(', '));

    // Mapear a formato esperado por el frontend
    const data = notificaciones.map(n => ({
      id: n.id,
      fecha: n.created_at ? new Date(n.created_at).toISOString().slice(0, 19).replace('T', ' ') : '',
      mensaje: n.mensaje,
      descripcion: n.mensaje,
      detalle: n.detalles || {},
      tipo: n.tipo,
      categoria: n.categoria,
      leida: n.leida,
      prioridad: n.prioridad,
      accion_requerida: n.accion_requerida,
      entidad_afectada: n.entidad_afectada
    }));

    console.log(`✅ ${data.length} notificaciones procesadas correctamente`);

    res.json({ 
      notificaciones: data,
      count: data.length,
      has_more: result.has_more || false
    });
  } catch (err) {
    console.error('❌ Error al cargar notificaciones:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).json({ 
      error: 'Error al cargar notificaciones',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * PUT /notificaciones/:id/leida
 * Marca una notificación como leída
 */
router.put('/notificaciones/:id/leida', async (req, res) => {
  try {
    const notificationId = req.params.id;
    console.log('📖 Marcando notificación como leída:', notificationId);

    const result = await req.apiClient.marcarNotificacionLeida(notificationId);
    
    console.log('🔍 Respuesta completa del Lambda:', JSON.stringify(result, null, 2));
    
    if (!result.ok) {
      console.error('❌ Error en respuesta:', result.error);
      return res.status(result.statusCode || 500).json({ 
        error: 'Error al marcar notificación como leída',
        message: result.error,
        trace_id: result.trace_id
      });
    }

    console.log('✅ Notificación marcada como leída');
    res.json({ ok: true, message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('❌ Error al marcar notificación:', err);
    res.status(500).json({ 
      error: 'Error al marcar notificación como leída',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * PUT /notificaciones/marcar-todas-leidas
 * Marca todas las notificaciones como leídas
 */
router.put('/notificaciones/marcar-todas-leidas', async (req, res) => {
  try {
    console.log('📚 Marcando todas las notificaciones como leídas');

    const result = await req.apiClient.marcarTodasLeidas();
    
    if (!result.ok) {
      console.error('❌ Error en respuesta:', result.error);
      return res.status(500).json({ 
        error: 'Error al marcar notificaciones',
        message: result.error
      });
    }

    console.log(`✅ ${result.count || 0} notificaciones marcadas como leídas`);
    res.json({ 
      ok: true, 
      message: `${result.count || 0} notificaciones marcadas como leídas`,
      count: result.count || 0
    });
  } catch (err) {
    console.error('❌ Error al marcar notificaciones:', err);
    res.status(500).json({ 
      error: 'Error al marcar notificaciones como leídas',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * GET /preferencias-notificaciones
 * Obtiene las preferencias de notificaciones del usuario
 * OPTIMIZADO: Con cache HTTP para reducir llamadas
 */
router.get('/preferencias-notificaciones', async (req, res) => {
  try {
    // Cache HTTP de 5 minutos (preferencias no cambian frecuentemente)
    res.set({
      'Cache-Control': 'private, max-age=300', // 5 minutos
      'ETag': `"prefs-${req.session.user.sub}"` // ETag basado en userSub
    });

    const userSub = req.session.user.sub;
    const preferencias = await obtenerPreferenciasNotificaciones(userSub);
    res.json({ ok: true, preferencias });
  } catch (error) {
    console.error('Error al obtener preferencias:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al obtener preferencias',
      preferencias: getDefaultPreferencias()
    });
  }
});

/**
 * PUT /preferencias-notificaciones
 * Actualiza las preferencias de notificaciones del usuario
 */
router.put('/preferencias-notificaciones', async (req, res) => {
  try {
    const userSub = req.session.user.sub;
    const preferencias = req.body;
    
    await guardarPreferenciasNotificaciones(userSub, preferencias);
    
    console.log('✅ Preferencias de notificaciones actualizadas para:', req.session.user.email);
    res.json({ ok: true, message: 'Preferencias actualizadas correctamente' });
  } catch (error) {
    console.error('Error al guardar preferencias:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Error al guardar preferencias' 
    });
  }
});

// ============= FUNCIONES AUXILIARES =============

function getDefaultPreferencias() {
  return {
    appointments: {
      INSERT: true,
      MODIFY: true,
      REMOVE: true
    },
    spaces: {
      SPACE_CREATED: true,
      SPACE_MODIFIED: true,
      SPACE_DELETED: true
    },
    occupants: {
      OCCUPANT_CREATED: true,
      OCCUPANT_MODIFIED: true,
      OCCUPANT_DELETED: true
    },
    members: {
      MEMBER_ADDED: true,
      MEMBER_MODIFIED: true,
      MEMBER_REMOVED: true,
      ROLE_CHANGED: true
    }
  };
}

async function obtenerPreferenciasNotificaciones(userSub) {
  const fs = require('fs').promises;
  const path = require('path');
  
  const prefsDir = path.join(__dirname, '..', 'data', 'notification-preferences');
  const prefsFile = path.join(prefsDir, `${userSub}.json`);
  
  try {
    const data = await fs.readFile(prefsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Si no existe el archivo, retornar preferencias por defecto
    return getDefaultPreferencias();
  }
}

async function guardarPreferenciasNotificaciones(userSub, preferencias) {
  const fs = require('fs').promises;
  const path = require('path');
  
  const prefsDir = path.join(__dirname, '..', 'data', 'notification-preferences');
  const prefsFile = path.join(prefsDir, `${userSub}.json`);
  
  // Crear directorio si no existe
  try {
    await fs.mkdir(prefsDir, { recursive: true });
  } catch (error) {
    // Ignorar si ya existe
  }
  
  // Guardar preferencias
  await fs.writeFile(prefsFile, JSON.stringify(preferencias, null, 2), 'utf8');
}

module.exports = router;