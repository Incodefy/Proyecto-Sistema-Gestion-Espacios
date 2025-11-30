// public/js/agenda_dashboard.js - Funcionalidad del dashboard de agenda (refactorizado sin inline scripts)

// ========= Inicialización =========
document.addEventListener('DOMContentLoaded', () => {
  // ========= Event Listeners (refactorizado para CSP sin unsafe-inline) =========
  
  // Prevenir default en cards "coming soon"
  document.querySelectorAll('[data-action="prevent-default"]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
    });
  });
  
  // ========= Fin Event Listeners =========
});
