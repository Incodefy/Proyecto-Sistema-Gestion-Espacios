// ================================================
// SISTEMA DE SELECTOR DE COLORES
// ================================================

// Definición de paletas de colores
const COLOR_PALETTES = {
  popular: [
    { hex: '#1a3c7c', name: 'Azul' },
    { hex: '#d53232', name: 'Rojo' },
    { hex: '#059669', name: 'Verde' },
    { hex: '#7c3aed', name: 'Púrpura' },
    { hex: '#ea580c', name: 'Naranja' }
  ],
  vibrant: [
    { hex: '#dc2626', name: 'Rojo Vibrante' },
    { hex: '#ea580c', name: 'Naranja Intenso' },
    { hex: '#f59e0b', name: 'Ámbar' },
    { hex: '#84cc16', name: 'Lima' },
    { hex: '#10b981', name: 'Esmeralda' },
    { hex: '#06b6d4', name: 'Cian' },
    { hex: '#3b82f6', name: 'Azul Rey' },
    { hex: '#8b5cf6', name: 'Violeta' },
    { hex: '#ec4899', name: 'Rosa Fucsia' },
    { hex: '#f43f5e', name: 'Rosa Intenso' }
  ],
  pastel: [
    { hex: '#fca5a5', name: 'Rosa Pastel' },
    { hex: '#fdba74', name: 'Melocotón' },
    { hex: '#fde047', name: 'Amarillo Suave' },
    { hex: '#bef264', name: 'Lima Pastel' },
    { hex: '#86efac', name: 'Verde Menta' },
    { hex: '#67e8f9', name: 'Celeste' },
    { hex: '#93c5fd', name: 'Azul Cielo' },
    { hex: '#c4b5fd', name: 'Lavanda' },
    { hex: '#f9a8d4', name: 'Rosa Claro' },
    { hex: '#fda4af', name: 'Coral Suave' }
  ],
  dark: [
    { hex: '#1e293b', name: 'Pizarra' },
    { hex: '#1e3a8a', name: 'Azul Marino' },
    { hex: '#831843', name: 'Rosa Oscuro' },
    { hex: '#6b21a8', name: 'Púrpura Oscuro' },
    { hex: '#7c2d12', name: 'Marrón' },
    { hex: '#14532d', name: 'Verde Oscuro' },
    { hex: '#164e63', name: 'Verde Azulado' },
    { hex: '#1e40af', name: 'Azul Profundo' },
    { hex: '#4c1d95', name: 'Índigo Oscuro' },
    { hex: '#9f1239', name: 'Carmesí' }
  ]
};

class ColorPicker {
  constructor() {
    this.selectedColor = document.getElementById('selectedColor').value;
    this.modal = null;
    this.init();
  }

  init() {
    // Inicializar sin esperar Bootstrap (usamos modal manual)
    this.setupModal();
    this.renderColors();
    this.setupEventListeners();
    this.updatePreview(this.selectedColor);
  }

  setupModal() {
    // Configurar modal manualmente (sin Bootstrap JS)
    this.modal = document.getElementById('colorPickerModal');
  }
  
  // Mostrar modal manualmente
  showModal() {
    if (!this.modal) return;
    
    // Mostrar modal con display: block
    this.modal.classList.remove('d-none');
    this.modal.classList.add('d-block');
    
    // Esperar un frame para que el display:block se aplique antes de agregar 'show'
    requestAnimationFrame(() => {
      this.modal.classList.add('show');
      document.body.classList.add('modal-open');
    });
    
    // Agregar backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade';
    backdrop.id = 'colorPickerBackdrop';
    document.body.appendChild(backdrop);
    
    // Activar fade-in del backdrop
    requestAnimationFrame(() => {
      backdrop.classList.add('show');
    });
    
    // Actualizar preview del modal con el color actual
    const colorName = this.findColorName(this.selectedColor);
    this.updateModalPreview(this.selectedColor, colorName);
  }
  
  // Cerrar modal manualmente
  hideModal() {
    if (!this.modal) return;
    
    this.modal.classList.remove('show');
    
    // Esperar a que termine la animación antes de ocultar
    setTimeout(() => {
      this.modal.classList.remove('d-block');
      this.modal.classList.add('d-none');
      document.body.classList.remove('modal-open');
    }, 150); // Duración de la animación fade de Bootstrap
    
    const backdrop = document.getElementById('colorPickerBackdrop');
    if (backdrop) backdrop.remove();
  }

  renderColors() {
    // Renderizar colores populares
    this.renderColorGrid('popularColors', COLOR_PALETTES.popular);
    
    // Renderizar colores vibrantes
    this.renderColorGrid('vibrantColors', COLOR_PALETTES.vibrant);
    
    // Renderizar colores pasteles
    this.renderColorGrid('pastelColors', COLOR_PALETTES.pastel);
    
    // Renderizar colores oscuros
    this.renderColorGrid('darkColors', COLOR_PALETTES.dark);
  }

  renderColorGrid(containerId, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    
    colors.forEach(color => {
      const colorItem = document.createElement('div');
      colorItem.className = 'color-item';
      colorItem.setAttribute('data-color', color.hex);
      // Usar traducción si está disponible
      const translatedName = window.COLOR_TRANSLATIONS && window.COLOR_TRANSLATIONS[color.name] 
        ? window.COLOR_TRANSLATIONS[color.name] 
        : color.name;
      colorItem.setAttribute('data-name', translatedName);
      colorItem.setAttribute('data-item-color', color.hex);
      
      // Marcar como seleccionado si es el color actual
      if (color.hex.toLowerCase() === this.selectedColor.toLowerCase()) {
        colorItem.classList.add('selected');
      }

      colorItem.addEventListener('click', () => this.selectColor(color.hex, translatedName));
      
      container.appendChild(colorItem);
    });
  }

  selectColor(hex, name) {
    // Actualizar color seleccionado
    this.selectedColor = hex;
    
    // Actualizar visualización en el modal
    this.updateModalPreview(hex, name);
    
    // Actualizar clases de selección
    document.querySelectorAll('.color-item').forEach(item => {
      if (item.getAttribute('data-color').toLowerCase() === hex.toLowerCase()) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  updateModalPreview(hex, name) {
    const previewBox = document.getElementById('previewLargeBox');
    const previewName = document.getElementById('previewLargeName');
    const previewHex = document.getElementById('previewLargeHex');

    // Actualizar atributo para el selector CSS
    if (previewBox) previewBox.setAttribute('data-preview-color', hex);
    if (previewName) previewName.textContent = name || 'Color personalizado';
    if (previewHex) previewHex.textContent = hex.toUpperCase();
  }

  updatePreview(hex) {
    // Actualizar vista previa principal (fuera del modal)
    const previewBox = document.getElementById('previewBox');
    const previewHex = document.getElementById('previewHex');
    const previewName = document.getElementById('previewName');

    // Actualizar atributo para el selector CSS
    if (previewBox) previewBox.setAttribute('data-preview-color', hex);
    if (previewHex) previewHex.textContent = hex.toUpperCase();
    
    // Buscar el nombre del color
    const colorName = this.findColorName(hex);
    if (previewName) previewName.textContent = colorName;
  }

  findColorName(hex) {
    const allColors = [
      ...COLOR_PALETTES.popular,
      ...COLOR_PALETTES.vibrant,
      ...COLOR_PALETTES.pastel,
      ...COLOR_PALETTES.dark
    ];

    const found = allColors.find(c => c.hex.toLowerCase() === hex.toLowerCase());
    if (found) {
      // Usar traducción si está disponible
      return window.COLOR_TRANSLATIONS && window.COLOR_TRANSLATIONS[found.name] 
        ? window.COLOR_TRANSLATIONS[found.name] 
        : found.name;
    }
    return 'Color personalizado';
  }

  setupEventListeners() {
    // Botón para abrir el modal
    const openBtn = document.getElementById('openColorPicker');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.showModal();
      });
    }

    // Botón para confirmar la selección
    const confirmBtn = document.getElementById('confirmColorBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        this.applyColor();
      });
    }
    
    // Botones para cerrar el modal
    const modalElement = document.getElementById('colorPickerModal');
    if (modalElement) {
      modalElement.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
        btn.addEventListener('click', () => this.hideModal());
      });
      
      // Cerrar al hacer clic en el backdrop
      modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
          this.hideModal();
        }
      });
    }

    // Búsqueda de colores
    const searchInput = document.getElementById('colorSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterColors(e.target.value);
      });
    }
  }

  filterColors(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    document.querySelectorAll('.color-item').forEach(item => {
      const colorName = item.getAttribute('data-name').toLowerCase();
      const colorHex = item.getAttribute('data-color').toLowerCase();
      
      if (colorName.includes(term) || colorHex.includes(term)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });

    // Ocultar categorías vacías
    document.querySelectorAll('.color-category').forEach(category => {
      const visibleColors = category.querySelectorAll('.color-item:not(.hidden)');
      if (visibleColors.length === 0) {
        category.classList.add('hidden');
      } else {
        category.classList.remove('hidden');
      }
    });
  }

  applyColor() {
    // Actualizar el input oculto del formulario
    const hiddenInput = document.getElementById('selectedColor');
    if (hiddenInput) {
      hiddenInput.value = this.selectedColor;
    }

    // Actualizar la vista previa principal
    this.updatePreview(this.selectedColor);

    // Cerrar el modal
    this.hideModal();

    // Aplicar color inmediatamente y guardar en el servidor
    this.aplicarColorInmediato(this.selectedColor);
  }

  async aplicarColorInmediato(color) {
    try {
      // 1. Aplicar cambio visual inmediato
      const root = document.documentElement;
      
      // Generar variantes del color (light y dark)
      const colorVariants = this.generarVariantesColor(color);
      
      root.style.setProperty('--primary-color', color, 'important');
      root.style.setProperty('--primary-color-light', colorVariants.light, 'important');
      root.style.setProperty('--primary-color-dark', colorVariants.dark, 'important');
      
      console.log('🎨 Aplicando color:', {
        primary: color,
        light: colorVariants.light,
        dark: colorVariants.dark
      });
      
      // 2. Guardar en el servidor (en background)
      const response = await fetch('/api/personalization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          parameters: {
            'theme.primary_color': color
          }
        })
      });
      
      const result = await response.json();
      
      if (!result.ok && !result.success) {
        console.error('Error guardando color:', result);
        this.mostrarNotificacion('Error al guardar color', 'error');
      } else {
        console.log('✅ Color guardado correctamente');
        this.mostrarNotificacion('Color actualizado', 'success');
      }
    } catch (error) {
      console.error('Error aplicando color:', error);
      this.mostrarNotificacion('Error al guardar color', 'error');
    }
  }

  // Generar variantes de color (light y dark) - cliente
  generarVariantesColor(hex) {
    // Convertir hex a RGB
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    
    // Generar variante light (más brillante)
    const lightR = Math.min(255, Math.floor(r + (255 - r) * 0.4));
    const lightG = Math.min(255, Math.floor(g + (255 - g) * 0.4));
    const lightB = Math.min(255, Math.floor(b + (255 - b) * 0.4));
    
    // Generar variante dark (más oscura)
    const darkR = Math.floor(r * 0.6);
    const darkG = Math.floor(g * 0.6);
    const darkB = Math.floor(b * 0.6);
    
    return {
      light: `#${lightR.toString(16).padStart(2, '0')}${lightG.toString(16).padStart(2, '0')}${lightB.toString(16).padStart(2, '0')}`,
      dark: `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`
    };
  }

  mostrarNotificacion(mensaje, tipo = 'info') {
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
    
    // Auto-remover después de 2 segundos
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transform = 'translateY(20px)';
      setTimeout(() => notif.remove(), 300);
    }, 2000);
  }
}

// Inicializar el selector de colores cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ColorPicker();
  });
} else {
  new ColorPicker();
}