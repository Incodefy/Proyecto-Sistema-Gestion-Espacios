// WebSocket para actualizaciones en tiempo real del historial de notificaciones

let websocket = null;
let notificacionesCache = []; // Cache local de notificaciones

/**
 * Conecta el WebSocket para recibir actualizaciones en tiempo real
 */
function conectarWebSocketHistorial(grupoId, wsUrl) {
  if (!grupoId) {
    console.warn('⚠️ No hay grupo activo, WebSocket no se conectará');
    return;
  }

  try {
    console.log('🔌 Conectando WebSocket al historial de notificaciones...');
    websocket = new WebSocket(`${wsUrl}?grupo_id=${grupoId}`);

    websocket.onopen = () => {
      console.log('✅ WebSocket conectado al historial de notificaciones');
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 Mensaje WebSocket recibido en historial:', message);
        
        // Procesar el mensaje y agregarlo al historial
        procesarMensajeWebSocket(message);
        
        // Mostrar toast si el NotificationManager está disponible
        if (window.notificationManager) {
          mostrarToastDesdeWebSocket(message);
        }
      } catch (error) {
        console.error('❌ Error procesando mensaje WebSocket:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('❌ Error en WebSocket del historial:', error);
    };

    websocket.onclose = () => {
      console.log('🔌 WebSocket del historial desconectado, reconectando en 5s...');
      setTimeout(() => conectarWebSocketHistorial(grupoId, wsUrl), 5000);
    };
  } catch (error) {
    console.error('❌ Error al conectar WebSocket del historial:', error);
  }
}

/**
 * Procesa mensaje de WebSocket y lo agrega al historial
 */
function procesarMensajeWebSocket(message) {
  // Mapear el mensaje de WebSocket a formato de notificación del historial
  const notificacion = mapearMensajeANotificacion(message);
  
  if (!notificacion) {
    console.warn('⚠️ No se pudo mapear el mensaje a notificación:', message);
    return;
  }

  // Agregar a la cache local
  notificacionesCache.unshift(notificacion);

  // Si estamos en la tab de historial, actualizar la vista
  const tabHistorial = document.getElementById('tab-historial');
  if (tabHistorial && tabHistorial.classList.contains('active')) {
    if (typeof mostrarNotificaciones === 'function') {
      mostrarNotificaciones(notificacionesCache);
    }
  }
}

/**
 * Mapea mensaje de WebSocket a formato de notificación del historial
 */
function mapearMensajeANotificacion(message) {
  const ahora = new Date().toISOString();
  
  // Mapeo de tipos de mensaje a categorías y detalles
  const mappings = {
    // Appointments
    'INSERT': {
      tipo: 'CITA_CREADA',
      categoria: 'CITAS',
      mensaje: 'Nueva cita agendada',
      prioridad: 'NORMAL',
      detalle: message.data || {}
    },
    'MODIFY': {
      tipo: 'CITA_MODIFICADA',
      categoria: 'CITAS',
      mensaje: 'Cita modificada',
      prioridad: 'NORMAL',
      detalle: message.data || {}
    },
    'REMOVE': {
      tipo: 'CITA_CANCELADA',
      categoria: 'CITAS',
      mensaje: 'Cita cancelada',
      prioridad: 'NORMAL',
      detalle: message.data || {}
    },
    
    // Spaces
    'SPACE_CREATED': {
      tipo: 'ESPACIO_CREADO',
      categoria: 'ESPACIOS',
      mensaje: `Espacio creado: ${message.data?.nombre || 'Nuevo espacio'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'ESPACIO',
        nombre: message.data?.nombre || 'Espacio'
      }
    },
    'SPACE_MODIFIED': {
      tipo: 'ESPACIO_MODIFICADO',
      categoria: 'ESPACIOS',
      mensaje: `Espacio modificado: ${message.data?.nombre || 'Espacio'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'ESPACIO',
        nombre: message.data?.nombre || 'Espacio'
      }
    },
    'SPACE_DELETED': {
      tipo: 'ESPACIO_ELIMINADO',
      categoria: 'ESPACIOS',
      mensaje: `Espacio eliminado: ${message.data?.nombre || 'Espacio'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'ESPACIO',
        nombre: message.data?.nombre || 'Espacio'
      }
    },
    
    // Occupants
    'OCCUPANT_CREATED': {
      tipo: 'OCUPANTE_CREADO',
      categoria: 'OCUPANTES',
      mensaje: `Ocupante agregado: ${message.data?.nombre || 'Nuevo ocupante'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'OCUPANTE',
        nombre: message.data?.nombre || 'Ocupante'
      }
    },
    'OCCUPANT_MODIFIED': {
      tipo: 'OCUPANTE_MODIFICADO',
      categoria: 'OCUPANTES',
      mensaje: `Ocupante modificado: ${message.data?.nombre || 'Ocupante'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'OCUPANTE',
        nombre: message.data?.nombre || 'Ocupante'
      }
    },
    'OCCUPANT_DELETED': {
      tipo: 'OCUPANTE_ELIMINADO',
      categoria: 'OCUPANTES',
      mensaje: `Ocupante eliminado: ${message.data?.nombre || 'Ocupante'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'OCUPANTE',
        nombre: message.data?.nombre || 'Ocupante'
      }
    },
    
    // Group Members
    'MEMBER_ADDED': {
      tipo: 'MIEMBRO_AGREGADO',
      categoria: 'GRUPO',
      mensaje: `Miembro agregado: ${message.data?.nombre || message.data?.email || 'Nuevo miembro'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'MIEMBRO',
        nombre: message.data?.nombre || message.data?.email || 'Miembro',
        email: message.data?.email
      }
    },
    'MEMBER_MODIFIED': {
      tipo: 'MIEMBRO_MODIFICADO',
      categoria: 'GRUPO',
      mensaje: `Miembro modificado: ${message.data?.nombre || message.data?.email || 'Miembro'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'MIEMBRO',
        nombre: message.data?.nombre || message.data?.email || 'Miembro',
        email: message.data?.email
      }
    },
    'ROLE_CHANGED': {
      tipo: 'ROL_CAMBIADO',
      categoria: 'PERMISOS',
      mensaje: `Rol actualizado: ${message.data?.nombre || message.data?.email || 'Miembro'}`,
      prioridad: 'ALTA',
      detalle: {
        rol_anterior: message.data?.oldRole || message.data?.rol_anterior,
        rol_nuevo: message.data?.newRole || message.data?.rol_nuevo,
        ...message.data
      },
      entidad_afectada: {
        tipo: 'MIEMBRO',
        nombre: message.data?.nombre || message.data?.email || 'Miembro',
        email: message.data?.email
      }
    },
    'MEMBER_REMOVED': {
      tipo: 'MIEMBRO_REMOVIDO',
      categoria: 'GRUPO',
      mensaje: `Miembro removido: ${message.data?.nombre || message.data?.email || 'Miembro'}`,
      prioridad: 'NORMAL',
      detalle: message.data || {},
      entidad_afectada: {
        tipo: 'MIEMBRO',
        nombre: message.data?.nombre || message.data?.email || 'Miembro',
        email: message.data?.email
      }
    }
  };

  const mapping = mappings[message.type];
  if (!mapping) return null;

  return {
    id: `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fecha: ahora,
    leida: false,
    ...mapping
  };
}

/**
 * Muestra toast usando NotificationManager
 */
function mostrarToastDesdeWebSocket(message) {
  // Usar el NotificationManager para mostrar el toast
  const typeMap = {
    'INSERT': () => window.notificationManager.showAppointmentCreated(message.data),
    'MODIFY': () => window.notificationManager.showAppointmentModified(message.data),
    'REMOVE': () => window.notificationManager.showAppointmentCancelled(message.data),
    'SPACE_CREATED': () => window.notificationManager.showSpaceCreated(message.data),
    'SPACE_MODIFIED': () => window.notificationManager.showSpaceModified(message.data),
    'SPACE_DELETED': () => window.notificationManager.showSpaceDeleted(message.data),
    'OCCUPANT_CREATED': () => window.notificationManager.showOccupantCreated(message.data),
    'OCCUPANT_MODIFIED': () => window.notificationManager.showOccupantModified(message.data),
    'OCCUPANT_DELETED': () => window.notificationManager.showOccupantDeleted(message.data),
    'MEMBER_ADDED': () => window.notificationManager.showMemberAdded(message.data),
    'MEMBER_MODIFIED': () => window.notificationManager.showMemberModified(message.data),
    'ROLE_CHANGED': () => window.notificationManager.showRoleChanged(message.data),
    'MEMBER_REMOVED': () => window.notificationManager.showMemberRemoved(message.data)
  };

  const handler = typeMap[message.type];
  if (handler) {
    handler();
  }
}

// Guardar notificaciones en cache
function actualizarCacheNotificaciones(notificaciones) {
  notificacionesCache = notificaciones || [];
}
