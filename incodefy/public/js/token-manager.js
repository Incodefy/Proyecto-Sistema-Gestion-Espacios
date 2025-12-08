/**
 * Token Manager - Renovación Proactiva de Tokens JWT
 * 
 * Este módulo maneja la renovación automática de tokens ANTES de que expiren,
 * proporcionando una experiencia de usuario sin interrupciones.
 * 
 * Características:
 * - Renovación automática cada 25 minutos (5 min antes de expirar)
 * - Detección de actividad del usuario
 * - Pausa de renovación cuando el usuario está inactivo
 * - Renovación inmediata cuando el usuario vuelve a estar activo
 * - Notificaciones visuales del estado del token
 * - Manejo de visibilidad de la página (Page Visibility API)
 * 
 * @version 1.0.0
 */

class TokenManager {
  constructor(config = {}) {
    // Configuración (en milisegundos)
    this.TOKEN_LIFETIME = config.tokenLifetime || 30 * 60 * 1000; // 30 minutos
    this.REFRESH_BEFORE = config.refreshBefore || 5 * 60 * 1000;  // Renovar 5 min antes
    this.INACTIVITY_THRESHOLD = config.inactivityThreshold || 10 * 60 * 1000; // 10 min inactivo
    
    // Estado interno
    this.lastActivity = Date.now();
    this.lastRefresh = Date.now();
    this.refreshTimer = null;
    this.activityTimer = null;
    this.isActive = true;
    this.isPaused = false;

    // Eventos a monitorear para detectar actividad
    this.activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Inicializar
    this.init();
  }

  /**
   * Inicializa el sistema de renovación automática
   */
  init() {
    console.log('🔐 [Token Manager] Inicializando sistema de renovación proactiva');
    console.log(`   - Token válido por: ${this.TOKEN_LIFETIME / 60000} minutos`);
    console.log(`   - Renovación cada: ${(this.TOKEN_LIFETIME - this.REFRESH_BEFORE) / 60000} minutos`);
    console.log(`   - Umbral de inactividad: ${this.INACTIVITY_THRESHOLD / 60000} minutos`);

    // Configurar listeners de actividad
    this.setupActivityListeners();

    // Configurar listener de visibilidad de página
    this.setupVisibilityListener();

    // Iniciar ciclo de renovación automática
    this.startAutoRefresh();

    // Iniciar monitoreo de inactividad
    this.startInactivityMonitor();
  }

  /**
   * Configura listeners para detectar actividad del usuario
   */
  setupActivityListeners() {
    this.activityEvents.forEach(event => {
      document.addEventListener(event, () => this.updateActivity(), { passive: true });
    });
  }

  /**
   * Configura listener para detectar cuando la página está visible/oculta
   */
  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('👁️ [Token Manager] Página oculta, pausando renovación');
        this.pauseAutoRefresh();
      } else {
        console.log('👁️ [Token Manager] Página visible, reanudando renovación');
        this.resumeAutoRefresh();
        
        // Si ha pasado mucho tiempo desde la última renovación, renovar inmediatamente
        const timeSinceRefresh = Date.now() - this.lastRefresh;
        if (timeSinceRefresh > this.REFRESH_BEFORE) {
          console.log('⚡ [Token Manager] Renovación inmediata por tiempo transcurrido');
          this.refreshToken();
        }
      }
    });
  }

  /**
   * Actualiza el timestamp de última actividad
   */
  updateActivity() {
    const now = Date.now();
    const wasInactive = !this.isActive;
    
    this.lastActivity = now;
    this.isActive = true;

    // Si el usuario estaba inactivo y ahora está activo, renovar si es necesario
    if (wasInactive) {
      console.log('👤 [Token Manager] Usuario activo nuevamente');
      
      const timeSinceRefresh = now - this.lastRefresh;
      if (timeSinceRefresh > this.REFRESH_BEFORE) {
        console.log('⚡ [Token Manager] Renovación inmediata por reactivación');
        this.refreshToken();
      }
    }
  }

  /**
   * Inicia el monitoreo de inactividad del usuario
   */
  startInactivityMonitor() {
    this.activityTimer = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivity;
      
      if (timeSinceActivity > this.INACTIVITY_THRESHOLD && this.isActive) {
        console.log('😴 [Token Manager] Usuario inactivo detectado');
        this.isActive = false;
      }
    }, 60000); // Verificar cada minuto
  }

  /**
   * Inicia el ciclo de renovación automática
   */
  startAutoRefresh() {
    // Calcular intervalo: renovar 5 minutos antes de que expire
    const refreshInterval = this.TOKEN_LIFETIME - this.REFRESH_BEFORE;

    console.log(`⏰ [Token Manager] Renovación automática configurada cada ${refreshInterval / 60000} minutos`);

    this.refreshTimer = setInterval(() => {
      // Solo renovar si el usuario está activo o la página es visible
      if (this.isActive || !document.hidden) {
        this.refreshToken();
      } else {
        console.log('⏸️ [Token Manager] Renovación omitida - usuario inactivo');
      }
    }, refreshInterval);
  }

  /**
   * Pausa la renovación automática
   */
  pauseAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      this.isPaused = true;
      console.log('⏸️ [Token Manager] Renovación automática pausada');
    }
  }

  /**
   * Reanuda la renovación automática
   */
  resumeAutoRefresh() {
    if (this.isPaused) {
      this.startAutoRefresh();
      this.isPaused = false;
      console.log('▶️ [Token Manager] Renovación automática reanudada');
    }
  }

  /**
   * Realiza la renovación del token
   * @returns {Promise<boolean>} - true si la renovación fue exitosa
   */
  async refreshToken() {
    try {
      console.log('🔄 [Token Manager] Renovando token proactivamente...');

      const response = await fetch('/refresh-token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Token refresh failed');
      }

      this.lastRefresh = Date.now();
      console.log('✅ [Token Manager] Token renovado exitosamente');

      // Emitir evento personalizado para que otros componentes sepan que el token se renovó
      const event = new CustomEvent('tokenRefreshed', { 
        detail: { 
          timestamp: this.lastRefresh,
          authTime: data.authTime 
        } 
      });
      window.dispatchEvent(event);

      return true;

    } catch (error) {
      console.error('❌ [Token Manager] Error al renovar token:', error.message);

      // Mostrar notificación de error
      if (window.notificationManager && typeof window.notificationManager.show === 'function') {
        window.notificationManager.show({
          id: 'token-refresh-error',
          type: 'error',
          title: 'Error de Sesión',
          message: 'No se pudo renovar tu sesión. Por favor, guarda tu trabajo.',
          duration: 5000
        });
      }

      return false;
    }
  }

  /**
   * Fuerza una renovación manual del token
   * @returns {Promise<boolean>}
   */
  async forceRefresh() {
    console.log('🔄 [Token Manager] Renovación manual forzada');
    return this.refreshToken();
  }

  /**
   * Obtiene información sobre el estado del token manager
   * @returns {Object}
   */
  getStatus() {
    const now = Date.now();
    const timeSinceRefresh = now - this.lastRefresh;
    const timeSinceActivity = now - this.lastActivity;
    const nextRefreshIn = (this.TOKEN_LIFETIME - this.REFRESH_BEFORE) - timeSinceRefresh;

    return {
      isActive: this.isActive,
      isPaused: this.isPaused,
      lastRefresh: new Date(this.lastRefresh).toISOString(),
      lastActivity: new Date(this.lastActivity).toISOString(),
      timeSinceRefreshMinutes: Math.floor(timeSinceRefresh / 60000),
      timeSinceActivityMinutes: Math.floor(timeSinceActivity / 60000),
      nextRefreshInMinutes: Math.floor(nextRefreshIn / 60000),
      nextRefreshInSeconds: Math.floor(nextRefreshIn / 1000)
    };
  }

  /**
   * Detiene el token manager completamente
   */
  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.activityTimer) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }

    this.activityEvents.forEach(event => {
      document.removeEventListener(event, () => this.updateActivity());
    });

    console.log('🛑 [Token Manager] Token manager detenido');
  }
}

// Inicializar automáticamente cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.tokenManager = new TokenManager();
    console.log('✅ [Token Manager] Token manager inicializado automáticamente');
  });
} else {
  // DOM ya está listo
  window.tokenManager = new TokenManager();
  console.log('✅ [Token Manager] Token manager inicializado automáticamente');
}

// Exponer la clase globalmente por si se necesita crear instancias personalizadas
window.TokenManager = TokenManager;
