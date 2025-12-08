// Inicialización del NotificationManager
window.notificationManager = new NotificationManager();

// Variables globales (se inyectan desde el EJS vía window)
const CURRENT_LOCALE = window.CURRENT_LOCALE;
const GRUPO_ID = window.GRUPO_ID;
const WS_URL = window.WS_URL;
const PREFERENCIAS_INICIALES = window.PREFERENCIAS_INICIALES;

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Manejo de tabs con URL state
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  
  // Función para cambiar tab
  function changeTab(tabName, updateURL = true) {
    // Actualizar botones
    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.setAttribute('aria-selected', 'true');
    }
    
    // Actualizar paneles
    tabPanels.forEach(panel => {
      panel.classList.remove('active');
      panel.setAttribute('hidden', '');
    });
    const activePanel = document.getElementById(`tab-${tabName}`);
    if (activePanel) {
      activePanel.classList.add('active');
      activePanel.removeAttribute('hidden');
    }
    
    // Actualizar URL sin recargar la página
    if (updateURL) {
      const url = new URL(window.location);
      url.searchParams.set('tab', tabName);
      window.history.pushState({ tab: tabName }, '', url);
    }
  }
  
  // Event listeners para los botones
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      changeTab(btn.dataset.tab);
    });
  });
  
  // Manejar navegación del navegador (atrás/adelante)
  window.addEventListener('popstate', (event) => {
    if (event.state && event.state.tab) {
      changeTab(event.state.tab, false);
    }
  });
  
  // Cargar tab inicial desde URL o usar 'historial' por defecto
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'historial';
  changeTab(initialTab, false);
  
  // Establecer estado inicial en el historial
  window.history.replaceState({ tab: initialTab }, '', window.location.href);
}

// Inicializar tabs al cargar
initializeTabs();

// Iconos según tipo de notificación
const NOTIFICATION_ICONS = {
  'NOMENCLATURA_ACTUALIZADA': 'fas fa-tag',
  'ESPACIO_CREADO': 'fas fa-plus-circle',
  'ESPACIO_ELIMINADO': 'fas fa-trash-alt',
  'MIEMBRO_INVITADO': 'fas fa-user-plus',
  'INVITACION_ACEPTADA': 'fas fa-user-check',
  'MIEMBRO_REMOVIDO': 'fas fa-user-minus',
  'ROL_CAMBIADO': 'fas fa-user-shield'
};

function cargarHistorialNotificaciones() {
  const loadingSpinner = document.getElementById('loadingSpinner');
  const contenedor = document.getElementById('notificacionesLista');

  loadingSpinner.classList.remove('d-none');
  contenedor.classList.add('d-none');

  fetch('/notificaciones-usuario')
    .then(r => r.json())
    .then(data => {
      loadingSpinner.classList.add('d-none');
      contenedor.classList.remove('d-none');
      
      // Actualizar cache para WebSocket
      if (typeof actualizarCacheNotificaciones === 'function') {
        actualizarCacheNotificaciones(data.notificaciones || []);
      }
      
      mostrarNotificaciones(data.notificaciones || []);
    })
    .catch(err => {
      console.error('Error cargando notificaciones:', err);
      loadingSpinner.classList.add('d-none');
      contenedor.classList.remove('d-none');
      contenedor.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-circle empty-state-icon"></i>
          <p class="empty-state-title">Error al cargar notificaciones</p>
          <p class="empty-state-text">Intenta nuevamente más tarde</p>
        </div>
      `;
    });
}

function mostrarNotificaciones(notificaciones) {
  const contenedor = document.getElementById('notificacionesLista');
  
  if (!notificaciones || notificaciones.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-bell-slash empty-state-icon"></i>
        <p class="empty-state-title">No hay notificaciones</p>
        <p class="empty-state-text">Cuando ocurran eventos en el sistema, aparecerán aquí</p>
      </div>
    `;
    return;
  }

  // Agrupar por fecha
  const notificacionesPorFecha = notificaciones.reduce((acc, n) => {
    const fecha = new Date(n.fecha).toISOString().split('T')[0];
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(n);
    return acc;
  }, {});

  let html = '';
  for (const fecha in notificacionesPorFecha) {
    const fechaLabel = new Intl.DateTimeFormat(CURRENT_LOCALE, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).format(new Date(fecha + 'T12:00:00'));

    html += `<div class="fecha-grupo">
                <div class="fecha-etiqueta"><i class="far fa-calendar-alt me-2"></i>${fechaLabel}</div>`;
    
    notificacionesPorFecha[fecha].forEach(n => {
      const icon = NOTIFICATION_ICONS[n.tipo] || 'fas fa-bell';
      
      const horaLabel = new Intl.DateTimeFormat(CURRENT_LOCALE, { 
        hour: '2-digit', 
        minute: '2-digit' 
      }).format(new Date(n.fecha));

      html += `
        <div class="notificacion-item" 
             data-id="${n.id}"
             data-leida="${n.leida}"
             data-categoria="${n.categoria}"
             data-prioridad="${n.prioridad}"
             data-tipo="${n.tipo}">
          <div class="d-flex align-items-start gap-3">
            <div class="notificacion-icon">
              <i class="${icon}"></i>
            </div>
            <div class="flex-grow-1">
              <div class="d-flex justify-content-between align-items-start mb-1">
                <div>
                  <strong class="d-block">${escapeHTML(n.mensaje)}</strong>
                  <small class="text-muted">
                    <i class="far fa-clock me-1"></i><span class="hora">${horaLabel}</span>
                    <span class="badge" data-categoria="${n.categoria}">${n.categoria}</span>
                    ${n.prioridad === 'ALTA' ? `<span class="badge" data-prioridad="ALTA">Alta prioridad</span>` : ''}
                  </small>
                </div>
              </div>
              ${renderDetalles(n)}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }
  contenedor.innerHTML = html;
}

function renderDetalles(notificacion) {
  const detalles = notificacion.detalle;
  
  if (!detalles || Object.keys(detalles).length === 0) {
    return '';
  }

  let html = '<div class="mt-2 small text-muted">';

  // Nomenclatura actualizada
  if (notificacion.tipo === 'NOMENCLATURA_ACTUALIZADA' && detalles.cambios) {
    html += '<ul class="mb-0 ps-3">';
    detalles.cambios.forEach(cambio => {
      const camposTexto = {
        general: 'Espacio General',
        especifico: 'Espacio Específico',
        ocupante: 'Ocupante',
        especialidad: 'Especialidad',
        instrumento: 'Instrumento'
      };
      const nombreCampo = camposTexto[cambio.campo] || cambio.campo;
      html += `<li><strong>${nombreCampo}:</strong> "${escapeHTML(cambio.valor_anterior)}" → "${escapeHTML(cambio.valor_nuevo)}"</li>`;
    });
    html += '</ul>';
  }

  // Espacio modificado
  if (notificacion.tipo === 'ESPACIO_MODIFICADO' && detalles.cambios) {
    html += '<ul class="mb-0 ps-3">';
    const camposTexto = {
      nombre: 'Nombre',
      capacidad: 'Capacidad',
      descripcion: 'Descripción',
      estado: 'Estado'
    };
    
    Object.keys(detalles.cambios).forEach(campo => {
      const nombreCampo = camposTexto[campo] || campo;
      const cambio = detalles.cambios[campo];
      html += `<li><strong>${nombreCampo}:</strong> "${escapeHTML(cambio.old)}" → "${escapeHTML(cambio.new)}"</li>`;
    });
    html += '</ul>';
  }

  // Entidad afectada (espacios, miembros)
  if (notificacion.entidad_afectada) {
    const entidad = notificacion.entidad_afectada;
    html += `<div><i class="fas fa-info-circle me-1"></i> `;
    if (entidad.tipo === 'ESPACIO') {
      html += `Espacio: <strong>${escapeHTML(entidad.nombre)}</strong>`;
    } else if (entidad.tipo === 'MIEMBRO') {
      html += `Usuario: <strong>${escapeHTML(entidad.nombre)}</strong>`;
      if (entidad.email) html += ` (${escapeHTML(entidad.email)})`;
    }
    html += '</div>';
  }

  // Detalles de rol cambiado
  if (notificacion.tipo === 'ROL_CAMBIADO' && detalles.rol_anterior && detalles.rol_nuevo) {
    html += `<div><i class="fas fa-exchange-alt me-1"></i> ${escapeHTML(detalles.rol_anterior)} → ${escapeHTML(detalles.rol_nuevo)}</div>`;
  }

  html += '</div>';
  return html;
}

// ========== PREFERENCIAS DE NOTIFICACIONES ==========

function cargarPreferencias() {
  console.log('📋 Cargando preferencias:', PREFERENCIAS_INICIALES);
  
  // Si PREFERENCIAS_INICIALES no existe, usar valores por defecto (todas activas)
  const preferencias = PREFERENCIAS_INICIALES || {
    appointments: { INSERT: true, MODIFY: true, REMOVE: true },
    spaces: { SPACE_CREATED: true, SPACE_MODIFIED: true, SPACE_DELETED: true },
    occupants: { OCCUPANT_CREATED: true, OCCUPANT_MODIFIED: true, OCCUPANT_DELETED: true },
    members: { MEMBER_ADDED: true, MEMBER_MODIFIED: true, MEMBER_REMOVED: true, ROLE_CHANGED: true }
  };
  
  let aplicados = 0;
  // Aplicar preferencias a los checkboxes
  document.querySelectorAll('.form-check-input[data-category]').forEach(checkbox => {
    const category = checkbox.dataset.category;
    const type = checkbox.dataset.type;
    
    if (preferencias[category] && preferencias[category][type] !== undefined) {
      checkbox.checked = preferencias[category][type];
      aplicados++;
    }
  });
  
  console.log(`✅ ${aplicados} preferencias aplicadas a los checkboxes`);
}

function obtenerPreferenciasActuales() {
  const preferencias = {
    appointments: {},
    spaces: {},
    occupants: {},
    members: {}
  };

  let total = 0;
  const checkboxes = document.querySelectorAll('.form-check-input[data-category]');
  console.log(`🔍 Encontrados ${checkboxes.length} checkboxes con data-category`);
  
  checkboxes.forEach((checkbox, index) => {
    const category = checkbox.dataset.category;
    const type = checkbox.dataset.type;
    const checked = checkbox.checked;
    
    console.log(`  [${index}] ${category}.${type} = ${checked} (id: ${checkbox.id})`);
    
    preferencias[category][type] = checked;
    total++;
  });

  console.log(`📊 Recolectadas ${total} preferencias:`, preferencias);
  return preferencias;
}

function guardarPreferencias() {
  console.log('💾 Guardando preferencias...');
  const preferencias = obtenerPreferenciasActuales();
  const btnGuardar = document.getElementById('btnGuardarPreferencias');
  const alertGuardado = document.getElementById('alertGuardado');
  
  if (!btnGuardar) {
    console.error('❌ Botón btnGuardarPreferencias no encontrado');
    return;
  }
  
  btnGuardar.disabled = true;
  btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

  fetch('/preferencias-notificaciones', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferencias)
  })
  .then(r => r.json())
  .then(data => {
    console.log('📥 Respuesta del servidor:', data);
    if (data.ok) {
      if (alertGuardado) {
        alertGuardado.classList.remove('d-none');
        setTimeout(() => {
          alertGuardado.classList.add('d-none');
        }, 3000);
      }
      
      // Recargar preferencias en el NotificationManager
      if (window.notificationManager && typeof window.notificationManager.reloadPreferences === 'function') {
        window.notificationManager.reloadPreferences();
        console.log('✅ Preferencias recargadas en NotificationManager');
      }
      console.log('✅ Preferencias guardadas exitosamente');
    } else {
      console.error('❌ Error en respuesta:', data);
      alert('Error al guardar preferencias');
    }
  })
  .catch(err => {
    console.error('Error:', err);
    alert('Error al guardar preferencias');
  })
  .finally(() => {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<i class="fas fa-save me-2"></i>Guardar Preferencias';
  });
}

function restaurarDefecto() {
  if (!confirm('¿Deseas restaurar todas las preferencias a los valores predeterminados (todas activadas)?')) {
    return;
  }

  document.querySelectorAll('.form-check-input[data-category]').forEach(checkbox => {
    checkbox.checked = true;
  });

  guardarPreferencias();
}

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando historial-notificaciones.js');
  console.log('   CURRENT_LOCALE:', CURRENT_LOCALE);
  console.log('   GRUPO_ID:', GRUPO_ID);
  console.log('   WS_URL:', WS_URL);
  console.log('   PREFERENCIAS_INICIALES:', PREFERENCIAS_INICIALES);
  
  cargarHistorialNotificaciones();
  cargarPreferencias();
  
  // Verificar que los elementos existen
  const btnGuardar = document.getElementById('btnGuardarPreferencias');
  const btnRestaurar = document.getElementById('btnRestaurarDefecto');
  const checkboxes = document.querySelectorAll('.form-check-input[data-category]');
  
  console.log('📋 Elementos encontrados:');
  console.log('   btnGuardarPreferencias:', btnGuardar ? '✅' : '❌');
  console.log('   btnRestaurarDefecto:', btnRestaurar ? '✅' : '❌');
  console.log('   Checkboxes:', checkboxes.length);
  
  // Agregar listeners a checkboxes para debugging
  checkboxes.forEach((checkbox, index) => {
    checkbox.addEventListener('change', (e) => {
      console.log(`🔄 Checkbox cambiado [${index}]: ${e.target.dataset.category}.${e.target.dataset.type} = ${e.target.checked}`);
    });
  });
  
  // Conectar WebSocket para actualizaciones en tiempo real
  if (GRUPO_ID && typeof conectarWebSocketHistorial === 'function') {
    conectarWebSocketHistorial(GRUPO_ID, WS_URL);
  }
  
  // Eventos de preferencias
  if (btnGuardar) {
    btnGuardar.addEventListener('click', guardarPreferencias);
    console.log('✅ Event listener agregado a btnGuardarPreferencias');
  }
  
  if (btnRestaurar) {
    btnRestaurar.addEventListener('click', restaurarDefecto);
    console.log('✅ Event listener agregado a btnRestaurarDefecto');
  }
});
