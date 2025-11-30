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
  
  // Formatear fechas en batch
  const gruposHTML = gruposData.grupos.map(grupo => {
    const esActivo = grupo.grupo_id === grupoActivoId;
    const nombreGrupo = grupo.nombre || 'Grupo sin nombre';
    const fechaCreacion = grupo.created_at ? 
      new Date(grupo.created_at).toLocaleDateString('es-CL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : 
      null;
    
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
          '<span class="active-badge"><i class="fas fa-check-circle"></i> Activo</span>' : 
          '<span class="select-badge">Seleccionar</span>'
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

  // Manejo del formulario de personalización (con prevención de doble-submit)
  const form = document.getElementById('personalizationForm');
  if (form) {
    let isSubmitting = false;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Prevenir doble-submit
      if (isSubmitting) return;
      isSubmitting = true;
      
      const loader = document.getElementById('loader');
      const message = document.getElementById('message');
      const submitBtn = form.querySelector('button[type="submit"]');
      
      // Deshabilitar botón de envío
      if (submitBtn) submitBtn.disabled = true;
      
      // Mostrar loader
      loader.classList.remove('d-none');
      message.textContent = '';
      message.className = 'message';
      
      try {
        const formData = new FormData(form);
        const parameters = Object.fromEntries(formData.entries());
        
        const response = await fetch('/api/personalization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ parameters })
        });
        
        const result = await response.json();
        
        loader.classList.add('d-none');
        
        // Verificar tanto result.ok como result.success
        if (result.ok || result.success) {
          message.textContent = '✓ Preferencias guardadas exitosamente';
          message.classList.add('success');
          
          // Recargar la página después de 800ms para aplicar cambios
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          throw new Error(result.message || result.error || 'Error al guardar preferencias');
        }
      } catch (error) {
        console.error('Error guardando preferencias:', error);
        loader.classList.add('d-none');
        message.textContent = '✗ Error al guardar preferencias: ' + error.message;
        message.classList.add('error');
        
        // Rehabilitar botón en caso de error
        isSubmitting = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
});