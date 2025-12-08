// perfil.js - Gestión de perfil de usuario y personalización

// Variables globales y cache
let changeGroupModal = null;
let grupoActivoCache = null;
let gruposUsuarioCache = null;
let cacheTTL = 60000; // 1 minuto

// Los colores se aplican mediante CSS custom property --preview-color definida en el HTML
// No se necesita JavaScript para aplicar colores (CSP-safe)

// Aplicar tamaños dinámicos mediante clases CSS (CSP-safe)
function aplicarTamanosFuentes() {
  requestAnimationFrame(() => {
    const icons = document.querySelectorAll('.scale-preview[data-scale]');
    
    icons.forEach(icon => {
      const scale = icon.getAttribute('data-scale');
      // Remover clases previas
      icon.classList.remove('font-scale-pequeno', 'font-scale-mediano', 'font-scale-grande');
      // Agregar clase correspondiente
      icon.classList.add('font-scale-' + scale);
    });
  });
}

// Aplicar estilos de cursor mediante clases CSS (CSP-safe)
function aplicarCursorGrupos() {
  requestAnimationFrame(() => {
    const items = document.querySelectorAll('.group-modal-item[data-cursor]');
    items.forEach(item => {
      const cursorType = item.getAttribute('data-cursor');
      // Remover clases previas
      item.classList.remove('cursor-default', 'cursor-pointer');
      // Agregar clase correspondiente
      item.classList.add('cursor-' + cursorType);
    });
  });
}

// Función para cargar el grupo activo actual (con cache)
async function loadActiveGroup(forceRefresh = false) {
  const container = document.getElementById('currentGroupInfo');
  
  // Usar cache si está disponible y no es forzado
  if (!forceRefresh && grupoActivoCache && Date.now() - grupoActivoCache.timestamp < cacheTTL) {
    renderGrupoActivo(container, grupoActivoCache.data);
    return;
  }
  
  try {
    const response = await fetch('/api/espacios/grupo-activo');
    const data = await response.json();
    
    // Guardar en cache
    grupoActivoCache = {
      data,
      timestamp: Date.now()
    };
    
    renderGrupoActivo(container, data);
  } catch (error) {
    console.error('❌ Error cargando grupo activo:', error);
    container.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Error al cargar el grupo activo</p>
      </div>
    `;
  }
}

// Renderizar grupo activo (función separada para reutilización)
function renderGrupoActivo(container, data) {
  // Soportar ambas estructuras: data.success o data.ok
  const grupo = data.grupo || data.grupo_activo;
  const hasGrupo = (data.success && data.grupo) || (data.ok && data.grupo_activo);
  
  if (hasGrupo && grupo) {
    // Formatear la fecha si existe (usar created_at, no fecha_creacion)
    const fechaCreacion = grupo.created_at ? 
      new Date(grupo.created_at).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 
      null;
    
    container.innerHTML = `
      <div class="active-group-badge">
        <i class="fas fa-users"></i>
        <strong>${grupo.nombre || 'Grupo sin nombre'}</strong>
        ${fechaCreacion ? `<small>Activo desde ${fechaCreacion}</small>` : ''}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="no-group-message">
        <i class="fas fa-info-circle"></i>
        <p>No tienes un grupo activo. Selecciona uno de tu lista de grupos.</p>
      </div>
    `;
  }
}

// Función para cargar todos los grupos del usuario (optimizada con cache y batch rendering)
async function loadUserGroups(forceRefresh = false) {
  const container = document.getElementById('groupsList');
  const loadingDiv = container.querySelector('.loading');
  const errorDiv = container.querySelector('.error');
  const listContainer = container.querySelector('.groups-list');
  
  // Usar cache si está disponible y no es forzado
  if (!forceRefresh && gruposUsuarioCache && Date.now() - gruposUsuarioCache.timestamp < cacheTTL) {
    renderGruposList(listContainer, gruposUsuarioCache.data);
    loadingDiv.classList.add('d-none');
    return;
  }
  
  // Mostrar loader
  loadingDiv.classList.remove('d-none');
  errorDiv.classList.add('d-none');
  listContainer.innerHTML = '';
  
  try {
    // Cargar en paralelo para optimizar tiempo
    const [gruposResponse, activoResponse] = await Promise.all([
      fetch('/api/espacios/grupos-usuario'),
      fetch('/api/espacios/grupo-activo')
    ]);
    
    const [gruposData, activoData] = await Promise.all([
      gruposResponse.json(),
      activoResponse.json()
    ]);
    
    loadingDiv.classList.add('d-none');
    
    // Guardar en cache
    gruposUsuarioCache = {
      data: { gruposData, activoData },
      timestamp: Date.now()
    };
    
    renderGruposList(listContainer, { gruposData, activoData });
    
  } catch (error) {
    console.error('❌ Error cargando grupos:', error);
    loadingDiv.classList.add('d-none');
    errorDiv.textContent = 'Error al cargar los grupos. Por favor, intenta de nuevo.';
    errorDiv.classList.remove('d-none');
  }
}

// Renderizar lista de grupos (función separada para reutilización y optimización)
function renderGruposList(container, { gruposData, activoData }) {
  // Soportar ambas estructuras: data.ok o data.success
  const hasGrupos = (gruposData.ok || gruposData.success) && gruposData.grupos && gruposData.grupos.length > 0;
  
  if (!hasGrupos) {
    container.innerHTML = `
      <div class="no-groups-message">
        <i class="fas fa-users-slash"></i>
        <p>No perteneces a ningún grupo aún</p>
      </div>
    `;
    return;
  }
  
  // Obtener grupo activo
  const grupoActivo = activoData.grupo_activo || activoData.grupo;
  const grupoActivoId = grupoActivo?.grupo_id || grupoActivo?.group_id;
  
  // Usar DocumentFragment para optimizar inserción del DOM
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  
  // Formatear fechas en batch (formato universal en inglés)
  const gruposHTML = gruposData.grupos.map(grupo => {
    const esActivo = grupo.grupo_id === grupoActivoId;
    const nombreGrupo = grupo.nombre || 'Grupo sin nombre';
    const fechaCreacion = grupo.created_at ? 
      new Date(grupo.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 
      null;
    
    // Obtener traducciones desde window.WORKSPACE_TRANSLATIONS si existen
    const activeBadge = window.WORKSPACE_TRANSLATIONS?.active_badge || 'Activo';
    const selectBadge = window.WORKSPACE_TRANSLATIONS?.select_badge || 'Seleccionar';
    
    return `
      <div class="group-modal-item ${esActivo ? 'active' : ''}" 
          data-grupo-id="${grupo.grupo_id}"
          data-cursor="${esActivo ? 'default' : 'pointer'}">
        <div class="group-modal-info">
          <h6>${nombreGrupo}</h6>
          ${fechaCreacion ? `<small>
            <i class="fas fa-calendar"></i>
            ${fechaCreacion}
          </small>` : ''}
        </div>
        ${esActivo ? 
          `<span class="active-badge"><i class="fas fa-check-circle"></i> ${activeBadge}</span>` : 
          `<span class="select-badge">${selectBadge}</span>`
        }
      </div>
    `;
  }).join('');
  
  // Insertar todo de una vez para minimizar reflows
  requestAnimationFrame(() => {
    container.innerHTML = gruposHTML;
    aplicarCursorGrupos();
  });
}

// Función para cambiar grupo activo (optimizada con invalidación de cache)
async function changeActiveGroup(grupoId) {
  const messageDiv = document.getElementById('groupChangeMessage');
  
  try {
    const response = await fetch('/api/espacios/asignar-grupo', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grupo_id: grupoId })
    });
    
    const data = await response.json();
    
    // Soportar ambas estructuras de respuesta
    if (data.success || data.ok) {
      // Invalidar cache para forzar recarga
      grupoActivoCache = null;
      gruposUsuarioCache = null;
      
      // Recargar en paralelo para optimizar
      await Promise.all([
        loadActiveGroup(true),
        loadUserGroups(true)
      ]);
      
      // Mostrar mensaje de éxito
      messageDiv.textContent = '✓ Grupo cambiado exitosamente';
      messageDiv.classList.remove('d-none', 'error');
      messageDiv.classList.add('success');
      
      setTimeout(() => {
        messageDiv.classList.add('d-none');
      }, 3000);
    } else {
      throw new Error(data.message || 'Error al cambiar grupo');
    }
  } catch (error) {
    console.error('Error cambiando grupo activo:', error);
    
    messageDiv.textContent = '✗ Error al cambiar grupo: ' + error.message;
    messageDiv.classList.remove('d-none', 'success');
    messageDiv.classList.add('error');
  }
}

// Event delegation para clicks en grupos
document.addEventListener('click', async (e) => {
  const grupoItem = e.target.closest('.group-modal-item:not(.active)');
  if (grupoItem) {
    e.stopPropagation();
    const grupoId = grupoItem.getAttribute('data-grupo-id');
    await changeActiveGroup(grupoId);
  }
});

// ================================================
// INTEGRACIÓN CON SISTEMA DE SELECTOR DE COLORES
// ================================================

// ================================================
// APLICACIÓN INMEDIATA DE CAMBIOS (SIN RECARGAR)
// ================================================

// Función para aplicar el modo de tema inmediatamente
async function aplicarModoTemaInmediato(mode) {
  try {
    // 1. Aplicar cambio visual inmediato
    document.body.setAttribute('data-theme', mode);
    
    // 2. Actualizar variables CSS para modo oscuro
    const root = document.documentElement;
    if (mode === 'dark') {
      root.style.setProperty('--background-color', '#181818', 'important');
      root.style.setProperty('--text-color', 'rgba(241, 241, 241, 0.98)', 'important');
      root.style.setProperty('--secondary-text-color', '#aab1bb', 'important');
      root.style.setProperty('--card-background', '#222222', 'important');
      root.style.setProperty('--border-color', '#2b2b2b', 'important');
      
      // Aplicar filtro a imágenes del menú
      document.querySelectorAll('.menu-link img').forEach(img => {
        img.style.filter = 'brightness(0) invert(1)';
      });
    } else {
      root.style.setProperty('--background-color', '#f8fafc', 'important');
      root.style.setProperty('--text-color', '#2c2c2c', 'important');
      root.style.setProperty('--secondary-text-color', '#64748b', 'important');
      root.style.setProperty('--card-background', '#ffffff', 'important');
      root.style.setProperty('--border-color', '#e2e8f0', 'important');
      
      // Remover filtro de imágenes del menú
      document.querySelectorAll('.menu-link img').forEach(img => {
        img.style.filter = '';
      });
    }
    
    // 3. Guardar en el servidor (en background)
    const response = await fetch('/api/personalization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        parameters: {
          'theme.mode': mode
        }
      })
    });
    
    const result = await response.json();
    
    if (!result.ok && !result.success) {
      console.error('Error guardando preferencia de tema:', result);
      // Mostrar notificación de error opcional
      mostrarNotificacion('Error al guardar preferencia', 'error');
    } else {
      console.log('✅ Modo de tema guardado correctamente');
      // Mostrar notificación de éxito discreta
      mostrarNotificacion('Tema actualizado', 'success');
    }
  } catch (error) {
    console.error('Error aplicando modo de tema:', error);
    mostrarNotificacion('Error al guardar preferencia', 'error');
  }
}

// Función para mostrar notificaciones discretas
function mostrarNotificacion(mensaje, tipo = 'info') {
  // Remover notificación anterior si existe
  const notifExistente = document.querySelector('.theme-notification');
  if (notifExistente) {
    notifExistente.remove();
  }
  
  // Crear notificación
  const notif = document.createElement('div');
  notif.className = `theme-notification theme-notification-${tipo}`;
  
  // Definir colores según tipo
  const colores = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6'
  };
  
  // Definir iconos según tipo
  const iconos = {
    success: 'check-circle',
    error: 'exclamation-circle',
    info: 'info-circle'
  };
  
  notif.innerHTML = `
    <i class="fas fa-${iconos[tipo] || 'info-circle'}"></i>
    <span>${mensaje}</span>
  `;
  
  // Agregar estilos inline para CSP-safe
  notif.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    background: ${colores[tipo] || colores.info};
    color: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    z-index: 10000;
    animation: slideInUp 0.3s ease-out;
    opacity: 0;
    transform: translateY(20px);
  `;
  
  document.body.appendChild(notif);
  
  // Animar entrada
  requestAnimationFrame(() => {
    notif.style.opacity = '1';
    notif.style.transform = 'translateY(0)';
  });
  
  // Auto-remover después de 2 segundos (3 para info)
  const duracion = tipo === 'info' ? 3000 : 2000;
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateY(20px)';
    setTimeout(() => notif.remove(), 300);
  }, duracion);
}

// Función para aplicar el tamaño de fuente inmediatamente
async function aplicarTamanoFuenteInmediato(scale) {
  try {
    // 1. Aplicar cambio visual inmediato
    const root = document.documentElement;
    
    // Definir tamaños según la escala
    const fontSizes = {
      pequeno: {
        base: '13px',
        h1: '1.8rem',
        h2: '1.4rem',
        h3: '1.1rem',
        small: '0.8rem',
        btn: '0.85rem',
        lineHeight: '1.5'
      },
      mediano: {
        base: '16px',
        h1: '2.25rem',
        h2: '1.75rem',
        h3: '1.25rem',
        small: '0.875rem',
        btn: '1rem',
        lineHeight: '1.6'
      },
      grande: {
        base: '19px',
        h1: '2.8rem',
        h2: '2.2rem',
        h3: '1.5rem',
        small: '1rem',
        btn: '1.15rem',
        lineHeight: '1.7'
      }
    };
    
    const sizes = fontSizes[scale] || fontSizes.mediano;
    
    root.style.setProperty('--font-size-base', sizes.base, 'important');
    root.style.setProperty('--font-size-h1', sizes.h1, 'important');
    root.style.setProperty('--font-size-h2', sizes.h2, 'important');
    root.style.setProperty('--font-size-h3', sizes.h3, 'important');
    root.style.setProperty('--font-size-small', sizes.small, 'important');
    root.style.setProperty('--font-size-btn', sizes.btn, 'important');
    root.style.setProperty('--line-height-base', sizes.lineHeight, 'important');
    
    // Aplicar al elemento HTML también
    document.documentElement.style.fontSize = sizes.base;
    
    console.log('📐 Aplicando tamaño de fuente:', scale, sizes);
    
    // 2. Guardar en el servidor (en background)
    const response = await fetch('/api/personalization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        parameters: {
          'font.scale': scale
        }
      })
    });
    
    const result = await response.json();
    
    if (!result.ok && !result.success) {
      console.error('Error guardando tamaño de fuente:', result);
      mostrarNotificacion('Error al guardar tamaño de fuente', 'error');
    } else {
      console.log('✅ Tamaño de fuente guardado correctamente');
      mostrarNotificacion('Tamaño de fuente actualizado', 'success');
    }
  } catch (error) {
    console.error('Error aplicando tamaño de fuente:', error);
    mostrarNotificacion('Error al guardar tamaño de fuente', 'error');
  }
}

// Función para cambiar el idioma inmediatamente (con recarga)
async function cambiarIdiomaInmediato(language) {
  try {
    // Mostrar indicador de carga
    mostrarNotificacion('Cambiando idioma...', 'info');
    
    // Guardar en el servidor
    const response = await fetch('/api/personalization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        parameters: {
          'locale.language': language
        }
      })
    });
    
    const result = await response.json();
    
    if (!result.ok && !result.success) {
      console.error('Error guardando idioma:', result);
      mostrarNotificacion('Error al cambiar idioma', 'error');
    } else {
      console.log('✅ Idioma guardado correctamente');
      // Recargar la página para aplicar las traducciones
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  } catch (error) {
    console.error('Error cambiando idioma:', error);
    mostrarNotificacion('Error al cambiar idioma', 'error');
  }
}

// ================================================
// INICIALIZACIÓN PRINCIPAL
// ================================================

// Manejo del formulario de personalización
document.addEventListener('DOMContentLoaded', async () => {
  // Aplicar estilos dinámicos (solo fuentes, los colores usan CSS custom properties)
  aplicarTamanosFuentes();
  
  // Cargar información del grupo activo
  loadActiveGroup();

  // El selector de colores se carga mediante <script> en el HTML
  // No necesitamos cargarlo dinámicamente

  // ================================================
  // EVENT LISTENERS PARA CAMBIOS INMEDIATOS
  // ================================================
  
  // Listener para cambio de modo de tema (claro/oscuro)
  const themeRadios = document.querySelectorAll('input[name="theme.mode"]');
  themeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        aplicarModoTemaInmediato(e.target.value);
      }
    });
  });

  // Listener para cambio de tamaño de fuente
  const fontRadios = document.querySelectorAll('input[name="font.scale"]');
  fontRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        aplicarTamanoFuenteInmediato(e.target.value);
      }
    });
  });

  // Listener para cambio de idioma
  const languageSelect = document.getElementById('locale-language');
  if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
      cambiarIdiomaInmediato(e.target.value);
    });
  }

  // ================================================
  // MODAL DE CAMBIO DE GRUPO
  // ================================================

  // Inicializar modal de cambio de grupo (sin Bootstrap JS)
  const modalElement = document.getElementById('changeGroupModal');
  const changeGroupBtn = document.getElementById('changeGroupBtn');
  
  if (modalElement && changeGroupBtn) {
    // Abrir modal
    changeGroupBtn.addEventListener('click', () => {
      modalElement.classList.add('show');
      modalElement.classList.remove('d-none');
      document.body.classList.add('modal-open');
      
      // Agregar backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop fade show';
      document.body.appendChild(backdrop);
      
      // Cargar grupos
      loadUserGroups();
    });
    
    // Cerrar modal
    const closeModal = () => {
      modalElement.classList.remove('show');
      modalElement.classList.add('d-none');
      document.body.classList.remove('modal-open');
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) backdrop.remove();
    };
    
    // Event listeners para cerrar
    modalElement.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });
    
    // Cerrar al hacer click fuera del modal
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) closeModal();
    });
  }
});