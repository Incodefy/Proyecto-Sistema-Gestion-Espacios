/**
 * Auth Interceptor - Manejo automático de tokens expirados
 * 
 * Este módulo intercepta todas las peticiones fetch y maneja automáticamente
 * los errores 401 (Unauthorized) renovando el token y reintentando la petición.
 * 
 * Características:
 * - Detección automática de tokens expirados (401)
 * - Renovación automática usando refreshToken
 * - Reintentos transparentes de peticiones fallidas
 * - Prevención de múltiples renovaciones simultáneas
 * - Redirección al login si el refreshToken también expiró
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // Guardar referencia al fetch original
  const originalFetch = window.fetch;

  // Estado del sistema de renovación
  let isRefreshing = false;
  let refreshPromise = null;
  let failedQueue = [];

  /**
   * Procesa las peticiones en cola después de renovar el token
   * @param {Error|null} error - Error si la renovación falló
   */
  function processQueue(error) {
    failedQueue.forEach(promise => {
      if (error) {
        promise.reject(error);
      } else {
        promise.resolve();
      }
    });
    failedQueue = [];
  }

  /**
   * Renueva el token usando el endpoint /refresh-token
   * Implementa singleton pattern para evitar múltiples renovaciones simultáneas
   * @returns {Promise<void>}
   */
  async function refreshAuthToken() {
    // Si ya hay una renovación en progreso, esperar a que termine
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    console.log('🔄 [Auth Interceptor] Iniciando renovación de token...');

    // Obtener token CSRF si está disponible
    const csrfToken = window.csrfHelper ? window.csrfHelper.getToken() : null;
    const headers = { 
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    };
    
    // Agregar token CSRF si existe
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    refreshPromise = originalFetch('/refresh-token', {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin' // Incluir cookies de sesión
    })
    .then(async response => {
      const data = await response.json();
      
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Token refresh failed');
      }

      console.log('✅ [Auth Interceptor] Token renovado exitosamente');
      processQueue(null);
      return data;
    })
    .catch(error => {
      console.error('❌ [Auth Interceptor] Error renovando token:', error.message);
      processQueue(error);
      
      // Si el refresh falló, redirigir al login
      const currentPath = window.location.pathname;
      const redirectUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
      
      // Mostrar notificación si está disponible
      if (window.notificationManager) {
        window.notificationManager.show({
          id: 'session-expired',
          type: 'warning',
          title: 'Sesión Expirada',
          message: 'Tu sesión ha expirado. Redirigiendo al login...',
          duration: 3000
        });
      }

      // Redirigir después de un breve delay
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 2000);

      throw error;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

    return refreshPromise;
  }

  /**
   * Determina si una petición debe ser interceptada
   * @param {string} url - URL de la petición
   * @returns {boolean}
   */
  function shouldInterceptRequest(url) {
    // No interceptar el endpoint de refresh para evitar bucles infinitos
    if (url.includes('/refresh-token')) {
      return false;
    }

    // No interceptar peticiones de login/logout
    if (url.includes('/login') || url.includes('/logout')) {
      return false;
    }

    // No interceptar recursos estáticos
    if (url.match(/\.(css|js|jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot)$/i)) {
      return false;
    }

    return true;
  }

  /**
   * Interceptor global de fetch
   * Sobrescribe window.fetch para manejar automáticamente errores 401
   */
  window.fetch = async function(...args) {
    const [url, options = {}] = args;
    const urlString = typeof url === 'string' ? url : url.toString();

    // Realizar la petición original
    let response = await originalFetch(...args);

    // Si no es 401 o no debe interceptarse, devolver respuesta original
    if (response.status !== 401 || !shouldInterceptRequest(urlString)) {
      return response;
    }

    console.warn('⚠️ [Auth Interceptor] Detectado 401 en:', urlString);

    // Si ya hay una renovación en progreso, esperar
    if (isRefreshing) {
      console.log('⏳ [Auth Interceptor] Esperando renovación en progreso...');
      
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: async () => {
            try {
              // Reintentar la petición original después de renovar
              const retryResponse = await originalFetch(...args);
              resolve(retryResponse);
            } catch (error) {
              reject(error);
            }
          },
          reject
        });
      });
    }

    // Intentar renovar el token
    try {
      await refreshAuthToken();
      
      console.log('🔁 [Auth Interceptor] Reintentando petición original...');
      
      // Reintentar la petición original con el token renovado
      response = await originalFetch(...args);
      
      // Si sigue siendo 401, algo está mal (no debería pasar)
      if (response.status === 401) {
        console.error('❌ [Auth Interceptor] Petición sigue fallando después de renovar token');
        throw new Error('Authentication failed after token refresh');
      }

      console.log('✅ [Auth Interceptor] Petición exitosa después de renovar token');
      return response;

    } catch (error) {
      console.error('❌ [Auth Interceptor] Error en proceso de renovación:', error);
      
      // Devolver la respuesta 401 original para que el código cliente la maneje
      return response;
    }
  };

  // Exponer funciones útiles globalmente
  window.authInterceptor = {
    /**
     * Fuerza una renovación manual del token
     * @returns {Promise<void>}
     */
    forceRefresh: async function() {
      console.log('🔄 [Auth Interceptor] Renovación manual solicitada');
      return refreshAuthToken();
    },

    /**
     * Verifica si hay una renovación en progreso
     * @returns {boolean}
     */
    isRefreshing: function() {
      return isRefreshing;
    }
  };

  console.log('✅ [Auth Interceptor] Interceptor de autenticación inicializado');

})();
