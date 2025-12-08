// WebSocket para actualizaciones de personalización en tiempo real

let websocket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

/**
 * Conecta el WebSocket para recibir actualizaciones de personalización
 */
function conectarWebSocketPerfil() {
  const grupoActivo = window.grupoActivo;
  const grupoId = typeof grupoActivo === 'string' ? grupoActivo : grupoActivo?.grupo_id;
  
  // En perfil, el grupoId puede ser opcional
  const wsUrl = '<%= typeof wsEndpoint !== "undefined" ? wsEndpoint : "wss://byl64liyj8.execute-api.us-east-1.amazonaws.com/dev" %>';
  
  try {
    console.log('🔌 Conectando WebSocket a perfil...');
    const connectionUrl = grupoId ? `${wsUrl}?grupo_id=${grupoId}` : wsUrl;
    websocket = new WebSocket(connectionUrl);

    websocket.onopen = () => {
      console.log('✅ WebSocket conectado al perfil');
      reconnectAttempts = 0;
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 Mensaje WebSocket recibido en perfil:', message);
        
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('❌ Error procesando mensaje WebSocket:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('❌ Error en WebSocket del perfil:', error);
    };

    websocket.onclose = () => {
      console.log('🔌 WebSocket del perfil desconectado');
      websocket = null;
      
      // Intentar reconexión
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`🔄 Intentando reconectar (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(conectarWebSocketPerfil, RECONNECT_DELAY);
      }
    };
  } catch (error) {
    console.error('❌ Error al conectar WebSocket del perfil:', error);
  }
}

/**
 * Maneja los mensajes recibidos del WebSocket
 */
function handleWebSocketMessage(message) {
  const { type, data } = message;

  switch (type) {
    case 'PERSONALIZATION_UPDATED':
      handlePersonalizacionActualizada(data);
      break;
      
    case 'NOMENCLATURA_ACTUALIZADA':
      handleNomenclaturaActualizada(data);
      break;
      
    default:
      console.log('ℹ️ Tipo de mensaje no manejado en perfil:', type);
  }
}

/**
 * Maneja actualizaciones de personalización
 */
function handlePersonalizacionActualizada(data) {
  console.log('🎨 Personalización actualizada:', data);
  
  // Mostrar notificación
  if (window.notificationManager) {
    window.notificationManager.show({
      id: `personalization-updated-${Date.now()}`,
      title: 'Personalización actualizada',
      message: 'Tu configuración de personalización ha sido actualizada',
      type: 'info',
      duration: 5000
    });
  }
  
  // Recargar personalizaci\u00f3n si estamos en la p\u00e1gina de perfil
  if (typeof cargarPersonalizacion === 'function') {
    setTimeout(() => {
      cargarPersonalizacion();
    }, 1000);
  } else {
    // Si no hay funci\u00f3n espec\u00edfica, recargar la p\u00e1gina
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}

/**
 * Maneja actualizaciones de nomenclatura (puede afectar al perfil si muestra info del grupo)
 */
function handleNomenclaturaActualizada(data) {
  console.log('📝 Nomenclatura actualizada (vista desde perfil):', data);
  
  // Mostrar notificación
  if (window.notificationManager) {
    window.notificationManager.showNomenclaturaUpdated(data);
  }
}

// Conectar WebSocket al cargar la p\u00e1gina (con delay para no bloquear)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(conectarWebSocketPerfil, 1500);
  });
} else {
  setTimeout(conectarWebSocketPerfil, 1500);
}

// Cerrar conexi\u00f3n al salir
window.addEventListener('beforeunload', () => {
  if (websocket) {
    websocket.close();
  }
});
