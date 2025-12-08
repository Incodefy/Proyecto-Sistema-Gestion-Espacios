// WebSocket para actualizaciones en tiempo real en Gestión de Grupo

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

/**
 * Conecta el WebSocket para recibir actualizaciones en tiempo real
 */
function conectarWebSocketGestionGrupo() {
  const grupoActivo = window.grupoActivo;
  const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
  const wsUrl = window.wsEndpoint || 'wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev';
  
  if (!grupoId) {
    console.warn('⚠️ No hay grupo activo, WebSocket no se conectará');
    return;
  }

  try {
    console.log('🔌 Conectando WebSocket a gestión de grupo...');
    websocket = new WebSocket(`${wsUrl}?grupo_id=${grupoId}`);

    websocket.onopen = () => {
      console.log('✅ WebSocket conectado a gestión de grupo');
      reconnectAttempts = 0;
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 Mensaje WebSocket recibido:', message);
        
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('❌ Error procesando mensaje WebSocket:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('❌ Error en WebSocket:', error);
    };

    websocket.onclose = () => {
      console.log('🔌 WebSocket desconectado');
      websocket = null;
      
      // Intentar reconexión
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 Intentando reconectar (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(conectarWebSocketGestionGrupo, RECONNECT_DELAY);
      }
    };
  } catch (error) {
    console.error('❌ Error al conectar WebSocket:', error);
  }
}

/**
 * Maneja los mensajes recibidos del WebSocket
 */
function handleWebSocketMessage(message) {
  const { type, data } = message;

  switch (type) {
    case 'NOMENCLATURA_ACTUALIZADA':
      handleNomenclaturaActualizada(data);
      break;
      
    case 'SPACE_CREATED':
    case 'SPACE_MODIFIED':
    case 'SPACE_DELETED':
      handleEspacioCambiado(type, data);
      break;
      
    case 'OCCUPANT_CREATED':
    case 'OCCUPANT_MODIFIED':
    case 'OCCUPANT_DELETED':
      handleRecursoCambiado(type, data);
      break;
      
    case 'MEMBER_ADDED':
    case 'ROLE_CHANGED':
    case 'MEMBER_REMOVED':
      handleMiembroCambiado(type, data);
      break;
      
    default:
      console.log('ℹ️ Tipo de mensaje no manejado:', type);
  }
}

/**
 * Maneja actualizaciones de nomenclatura
 */
function handleNomenclaturaActualizada(data) {
  console.log('📝 Nomenclatura actualizada:', data);
  
  // Mostrar notificación
  if (window.notificationManager) {
    window.notificationManager.showNomenclaturaUpdated(data);
  }
  
  // Recargar nomenclatura si estamos en la página de gestión
  if (typeof cargarNomenclatura === 'function') {
    // Recargar en segundo plano sin bloquear UI
    setTimeout(() => {
      cargarNomenclatura();
    }, 1000);
  }
}

/**
 * Maneja cambios en espacios (creado, modificado, eliminado)
 */
function handleEspacioCambiado(type, data) {
  console.log(`🏢 Espacio ${type}:`, data);
  
  // Mostrar notificación según el tipo
  if (window.notificationManager) {
    switch (type) {
      case 'SPACE_CREATED':
        window.notificationManager.showSpaceCreated(data);
        break;
      case 'SPACE_MODIFIED':
        window.notificationManager.showSpaceModified(data);
        break;
      case 'SPACE_DELETED':
        window.notificationManager.showSpaceDeleted(data);
        break;
    }
  }
  
  // Actualizar contador de espacios si existe
  const espaciosCount = document.querySelector('[data-stat="espacios"]');
  if (espaciosCount && typeof actualizarEstadisticas === 'function') {
    actualizarEstadisticas();
  }
}

/**
 * Maneja cambios en recursos (ocupantes, especialidades, instrumentos)
 */
function handleRecursoCambiado(type, data) {
  console.log(`👤 Recurso ${type}:`, data);
  
  // Mostrar notificación
  if (window.notificationManager) {
    switch (type) {
      case 'OCCUPANT_CREATED':
        window.notificationManager.showOccupantCreated(data);
        break;
      case 'OCCUPANT_MODIFIED':
        window.notificationManager.showOccupantModified(data);
        break;
      case 'OCCUPANT_DELETED':
        window.notificationManager.showOccupantDeleted(data);
        break;
    }
  }
}

/**
 * Maneja cambios en miembros del grupo
 */
function handleMiembroCambiado(type, data) {
  console.log(`👥 Miembro ${type}:`, data);
  
  // Mostrar notificación
  if (window.notificationManager) {
    switch (type) {
      case 'MEMBER_ADDED':
        window.notificationManager.showMemberAdded(data);
        break;
      case 'ROLE_CHANGED':
        window.notificationManager.showRoleChanged(data);
        break;
      case 'MEMBER_REMOVED':
        window.notificationManager.showMemberRemoved(data);
        break;
    }
  }
  
  // Actualizar contador de miembros si existe
  const miembrosCount = document.querySelector('[data-stat="miembros"]');
  if (miembrosCount && typeof actualizarEstadisticas === 'function') {
    actualizarEstadisticas();
  }
}

// Conectar WebSocket al cargar la página (con delay para no bloquear)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(conectarWebSocketGestionGrupo, 1500);
  });
} else {
  setTimeout(conectarWebSocketGestionGrupo, 1500);
}

// Cerrar conexión al salir
window.addEventListener('beforeunload', () => {
  if (websocket) {
    websocket.close();
  }
});
