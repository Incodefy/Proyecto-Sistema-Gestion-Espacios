// public/js/agenda.js - Funcionalidad de la agenda (refactorizado sin inline scripts)

/**
 * Mostrar toast de desarrollo
 */
function showDevToast(event) {
  event.preventDefault();
  
  const toastElement = document.getElementById('devToast');
  const toast = new bootstrap.Toast(toastElement, {
    autohide: true,
    delay: 4000
  });
  
  toast.show();
}

// ========= Inicialización =========
document.addEventListener('DOMContentLoaded', () => {
  // ========= Event Listeners (refactorizado para CSP sin unsafe-inline) =========
  
  // Show dev toast para opciones en desarrollo
  document.querySelectorAll('[data-action="show-dev-toast"]').forEach(btn => {
    btn.addEventListener('click', showDevToast);
  });
  
  // ========= Fin Event Listeners =========
});
