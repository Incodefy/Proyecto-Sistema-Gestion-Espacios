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
      colorItem.setAttribute('data-name', color.name);
      colorItem.setAttribute('data-item-color', color.hex);
      
      // Marcar como seleccionado si es el color actual
      if (color.hex.toLowerCase() === this.selectedColor.toLowerCase()) {
        colorItem.classList.add('selected');
      }

      colorItem.addEventListener('click', () => this.selectColor(color.hex, color.name));
      
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
    return found ? found.name : 'Color personalizado';
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

    // Mostrar mensaje de confirmación
    this.showTemporaryMessage('Color seleccionado correctamente. Recuerda guardar los cambios.', 'info');
  }

  showTemporaryMessage(text, type = 'info') {
    // Crear mensaje temporal
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type} d-flex`;
    messageDiv.textContent = text;

    // Insertar después del botón de abrir selector
    const openBtn = document.getElementById('openColorPicker');
    if (openBtn && openBtn.parentNode) {
      openBtn.parentNode.insertBefore(messageDiv, openBtn.nextSibling);

      // Eliminar después de 3 segundos
      setTimeout(() => {
        messageDiv.classList.add('opacity-0');
        setTimeout(() => messageDiv.remove(), 300);
      }, 3000);
    }
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