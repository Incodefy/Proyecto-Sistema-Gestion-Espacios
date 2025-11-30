// public/js/navbar.js - Funcionalidad del navbar (refactorizado sin inline scripts)

/**
 * Actualizar reloj en tiempo real
 */
function actualizarReloj() {
  const relojElement = document.getElementById('reloj');
  if (!relojElement) return;
  
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  relojElement.textContent = `${hh} : ${mm} : ${ss}`;
}

/**
 * Toggle del navbar móvil
 */
function toggleNavbar() {
  const navbar = document.querySelector('.navbar-menu');
  const overlay = document.querySelector('.navbar-overlay');
  
  if (navbar && overlay) {
    navbar.classList.toggle('show');
    overlay.classList.toggle('show');
  }
}

/**
 * Cerrar navbar móvil
 */
function closeNavbar() {
  const navbar = document.querySelector('.navbar-menu');
  const overlay = document.querySelector('.navbar-overlay');
  
  if (navbar && overlay) {
    navbar.classList.remove('show');
    overlay.classList.remove('show');
  }
}

// ========= Inicialización =========
document.addEventListener('DOMContentLoaded', () => {
  // Event listeners para toggle y close navbar
  const toggleBtn = document.querySelector('[data-action="toggle-navbar"]');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleNavbar);
  }
  
  const overlay = document.querySelector('[data-action="close-navbar"]');
  if (overlay) {
    overlay.addEventListener('click', closeNavbar);
  }
  
  // Cerrar navbar con tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNavbar();
    }
  });
  
  // Iniciar reloj
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
});
