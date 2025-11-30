// public/js/notificaciones-importacion.js - Manejo de notificaciones de importación

/**
 * Ver detalles de importación
 */
function verDetallesImportacion() {
  const modal = new bootstrap.Modal(document.getElementById('modalDetalleImportacion'));
  modal.show();
}

// ========= Inicialización =========
document.addEventListener('DOMContentLoaded', () => {
  // ========= Event Listeners (refactorizado para CSP sin unsafe-inline) =========
  
  // Ver detalles de importación
  const btnVerDetalles = document.querySelector('[data-action="ver-detalles-importacion"]');
  if (btnVerDetalles) {
    btnVerDetalles.addEventListener('click', verDetallesImportacion);
  }
  
  // ========= Fin Event Listeners =========
});
