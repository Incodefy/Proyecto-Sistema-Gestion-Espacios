/**
 * Session Guard - Protección contra acceso a páginas cacheadas después de logout
 * 
 * Este módulo verifica que la sesión del usuario siga siendo válida cuando:
 * - El usuario presiona el botón "Atrás" del navegador
 * - El usuario regresa a una pestaña que tenía abierta
 * - La página se carga desde el cache del navegador
 * 
 * Si la sesión no es válida, redirige automáticamente al login.
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  /**
   * Verifica si la sesión del usuario sigue siendo válida
   * Hace una petición ligera al servidor para comprobar autenticación
   */
  async function checkSession() {
    try {
      const response = await fetch('/profile', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-cache',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      // Si la respuesta es 401, la sesión expiró
      if (response.status === 401) {
        console.warn('⚠️ [Session Guard] Sesión inválida detectada');
        handleInvalidSession();
        return false;
      }

      // Si es redirect (302, 303), probablemente redirige a login
      if (response.redirected && response.url.includes('/login')) {
        console.warn('⚠️ [Session Guard] Redirigido a login');
        handleInvalidSession();
        return false;
      }

      // Sesión válida
      return true;

    } catch (error) {
      console.error('❌ [Session Guard] Error verificando sesión:', error);
      // En caso de error de red, no hacer nada (podría ser temporal)
      return true;
    }
  }

  /**
   * Maneja el caso de sesión inválida
   * Limpia el estado local y redirige al login
   */
  function handleInvalidSession() {
    console.log('🔒 [Session Guard] Limpiando estado y redirigiendo al login...');

    // Limpiar localStorage
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('No se pudo limpiar localStorage:', e);
    }

    // Limpiar sessionStorage
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('No se pudo limpiar sessionStorage:', e);
    }

    // Mostrar mensaje si hay notificationManager
    if (window.notificationManager && typeof window.notificationManager.show === 'function') {
      window.notificationManager.show({
        id: 'session-invalid',
        type: 'warning',
        title: 'Sesión Expirada',
        message: 'Tu sesión ha expirado. Redirigiendo al login...',
        duration: 2000
      });
    }

    // Redirigir después de un breve delay
    setTimeout(() => {
      const currentPath = window.location.pathname;
      window.location.replace('/login?redirect=' + encodeURIComponent(currentPath));
    }, 1000);
  }

  /**
   * Verifica la sesión cuando la página se vuelve visible
   * Esto captura el caso de volver a una pestaña que estaba en background
   */
  function setupVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        console.log('👁️ [Session Guard] Página visible, verificando sesión...');
        await checkSession();
      }
    });
  }

  /**
   * Verifica la sesión cuando el usuario navega con botones atrás/adelante
   * Esto captura el caso de usar el botón "Atrás" después de logout
   */
  function setupNavigationListener() {
    window.addEventListener('pageshow', async (event) => {
      // event.persisted = true si la página viene del cache bfcache del navegador
      if (event.persisted) {
        console.log('🔄 [Session Guard] Página cargada desde cache, verificando sesión...');
        const isValid = await checkSession();
        
        if (!isValid) {
          // Forzar recarga para obtener la versión fresca del servidor
          window.location.reload();
        }
      }
    });

    // También verificar en popstate (navegación con atrás/adelante)
    window.addEventListener('popstate', async () => {
      console.log('⬅️ [Session Guard] Navegación detectada, verificando sesión...');
      await checkSession();
    });
  }

  /**
   * Previene el uso de cache del navegador con meta tags dinámicos
   * Esto es una capa adicional de protección
   */
  function preventBrowserCache() {
    // Agregar meta tags anti-cache si no existen
    const metaTags = [
      { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate' },
      { httpEquiv: 'Pragma', content: 'no-cache' },
      { httpEquiv: 'Expires', content: '0' }
    ];

    metaTags.forEach(tag => {
      const existing = document.querySelector(`meta[http-equiv="${tag.httpEquiv}"]`);
      if (!existing) {
        const meta = document.createElement('meta');
        meta.httpEquiv = tag.httpEquiv;
        meta.content = tag.content;
        document.head.appendChild(meta);
      }
    });
  }

  /**
   * Marca la página como "necesita revalidación"
   * Si el usuario hace logout, esta marca se limpia
   * Al volver, detectamos que falta la marca y verificamos sesión
   */
  function setupSessionMarker() {
    const SESSION_MARKER = 'app_session_active';
    
    // Si no existe la marca, verificar sesión
    if (!sessionStorage.getItem(SESSION_MARKER)) {
      console.log('🔍 [Session Guard] Marca de sesión no encontrada, verificando...');
      checkSession().then(isValid => {
        if (isValid) {
          // Establecer marca de sesión activa
          sessionStorage.setItem(SESSION_MARKER, Date.now().toString());
        }
      });
    } else {
      // Actualizar timestamp de la marca
      sessionStorage.setItem(SESSION_MARKER, Date.now().toString());
    }

    // Limpiar marca al hacer logout (se detecta via beforeunload si va a /logout)
    window.addEventListener('beforeunload', () => {
      // Si vamos a logout, limpiar la marca
      if (window.location.pathname === '/logout') {
        sessionStorage.removeItem(SESSION_MARKER);
      }
    });
  }

  /**
   * Inicializa todas las protecciones
   */
  function init() {
    console.log('🛡️ [Session Guard] Inicializando protección de sesión...');

    // Verificación inicial
    checkSession();

    // Configurar listeners
    setupVisibilityListener();
    setupNavigationListener();
    setupSessionMarker();
    preventBrowserCache();

    console.log('✅ [Session Guard] Protección de sesión activa');
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exponer funciones útiles globalmente
  window.sessionGuard = {
    /**
     * Verifica manualmente la sesión
     * @returns {Promise<boolean>}
     */
    check: checkSession,

    /**
     * Invalida la sesión y redirige al login
     */
    invalidate: handleInvalidSession
  };

})();
