(function() {
  'use strict';

  function getCsrfToken() {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
      return metaTag.getAttribute('content');
    }

    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === '_csrf') {
        return decodeURIComponent(value);
      }
    }

    const hiddenInput = document.querySelector('input[name="_csrf"]');
    if (hiddenInput) {
      return hiddenInput.value;
    }

    return null;
  }

  function needsCsrfToken(method) {
    const upperMethod = method.toUpperCase();
    return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(upperMethod);
  }

  function isExemptUrl(url) {
    const exemptPaths = [
      '/api/webhooks',
      '/api/health',
    ];

    try {
      const urlObj = new URL(url, window.location.origin);
      return exemptPaths.some(path => urlObj.pathname.startsWith(path));
    } catch (e) {
      return false;
    }
  }

  const originalFetch = window.fetch;
  
  window.fetch = function(url, options = {}) {
    const method = options.method || 'GET';

    if (needsCsrfToken(method) && !isExemptUrl(url)) {
      const csrfToken = getCsrfToken();
      
      if (csrfToken) {
        options.headers = options.headers || {};
        
        if (options.headers instanceof Headers) {
          options.headers.set('X-CSRF-Token', csrfToken);
        } else {
          options.headers['X-CSRF-Token'] = csrfToken;
        }

        console.log('🔒 [CSRF] Token añadido a petición:', method, url);
      } else {
        console.warn('⚠️ [CSRF] No se encontró token CSRF para petición:', method, url);
      }
    }

    return originalFetch(url, options)
      .then(response => {
        if (response.status === 403) {
          return response.json().then(data => {
            if (data.code === 'INVALID_CSRF_TOKEN') {
              console.error('🚨 [CSRF] Token inválido detectado');
              
              if (window.notificationManager) {
                window.notificationManager.show({
                  id: 'csrf-error',
                  type: 'error',
                  title: 'Error de Seguridad',
                  message: data.message || 'Token de seguridad inválido. Recargando página...',
                  duration: 3000
                });
              }

              setTimeout(() => {
                window.location.reload();
              }, 2000);

              throw new Error('CSRF token validation failed');
            }

            return Promise.reject(data);
          }).catch(e => {
            return response;
          });
        }

        return response;
      });
  };

  function injectCsrfIntoForms() {
    const forms = document.querySelectorAll('form[method="post"], form[method="put"], form[method="delete"]');
    
    // Si no hay formularios, no hacer nada (sin warning)
    if (forms.length === 0) {
      return;
    }
    
    const csrfToken = getCsrfToken();
    
    if (!csrfToken) {
      console.warn('⚠️ [CSRF] No se encontró token CSRF para inyectar en formularios');
      return;
    }
    
    forms.forEach(form => {
      const existingToken = form.querySelector('input[name="_csrf"]');
      
      if (!existingToken) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_csrf';
        input.value = csrfToken;
        form.appendChild(input);
        
        console.log('🔒 [CSRF] Token inyectado en formulario:', form.action);
      }
    });
  }

  function updateCsrfToken(newToken) {
    let metaTag = document.querySelector('meta[name="csrf-token"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'csrf-token';
      document.head.appendChild(metaTag);
    }
    metaTag.content = newToken;

    document.querySelectorAll('input[name="_csrf"]').forEach(input => {
      input.value = newToken;
    });

    console.log('🔄 [CSRF] Token actualizado');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCsrfIntoForms);
  } else {
    injectCsrfIntoForms();
  }

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          injectCsrfIntoForms();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  window.csrfHelper = {
    getToken: getCsrfToken,
    updateToken: updateCsrfToken,
    injectIntoForms: injectCsrfIntoForms
  };

  console.log('✅ [CSRF] Helper de protección CSRF inicializado');

})();
