// ==================== CLASE PRINCIPAL ==================== //
class OnboardingEspacios {
  constructor() {
    this.step = 'loading';
    this.generalSpaceName = '';
    this.specificSpaceName = '';
    this.occupantName = 'Ocupante';
    this.especialidadName = 'Especialidad';
    this.instrumentName = 'Instrumento';
    this.spaces = [];
    this.tiposInstrumentos = [];
    this.instrumentos = [];
    this.especialidades = [];
    this.ocupantes = [];
    this.editingId = null;
    this.editingValue = '';
    this.root = document.getElementById('onboarding-root');
    this.isLoading = false;
    this.gruposDisponibles = [];
    this.grupoSeleccionado = null;
    this.groupName = '';
    
    this.init();
  }

  // ==================== HELPER: PLURALIZACIÓN ==================== //
  pluralize(word) {
    if (!word || word.trim() === '') return word;
    
    const lastChar = word.slice(-1).toLowerCase();
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    
    // Si termina en vocal, agregar 's'
    if (vowels.includes(lastChar)) {
      return word + 's';
    }
    
    // Si termina en consonante, agregar 'es'
    return word + 'es';
  }

  // ==================== INICIALIZACIÓN ==================== //
  async init() {
    this.step = 'loading';
    this.render();
    
    await this.cargarGruposUsuario();
    
    if (this.gruposDisponibles.length === 0) {
      this.step = 'crear-grupo';
    } else {
      this.step = 'seleccion-grupo';
    }
    this.render();
  }

  async cargarGruposUsuario() {
    try {
      const response = await fetch('/onboarding-espacios/api/espacios/grupos-usuario', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        this.gruposDisponibles = data.grupos || [];
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
      this.gruposDisponibles = [];
    }
  }

  // ==================== RENDER PRINCIPAL ==================== //
  render() {
    const renders = {
      'loading': () => this.renderLoading(),
      'crear-grupo': () => this.renderCrearGrupo(),
      'seleccion-grupo': () => this.renderSeleccionGrupo(),
      'creacion-nomenclatura': () => this.renderCreacionNomenclatura(),
      'creacion-espacios': () => this.renderCreacionEspacios(),
      'creacion-tipos-instrumentos': () => this.renderCreacionTiposInstrumentos(),
      'creacion-instrumentos': () => this.renderCreacionInstrumentos(),
      'creacion-especialidades': () => this.renderCreacionEspecialidades(),
      'creacion-ocupantes': () => this.renderCreacionOcupantes()
    };

    if (renders[this.step]) {
      renders[this.step]();
    }
  }

  // ==================== PASO 0: LOADING ==================== //
  renderLoading() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando tu configuración...</p>
        </div>
      </div>
    `;
  }

  // ==================== PASO 0: CREAR GRUPO ==================== //
  renderCrearGrupo() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-header">
          <h1><i class="fas fa-layer-group"></i> Crear Nuevo Grupo</h1>
          <p>Este será el nombre que identificará tu organización o equipo</p>
        </div>

        <div class="form-container">
          <div class="form-group">
            <label class="form-label">Nombre del grupo</label>
            <input 
              type="text" 
              id="inputGroupName"
              class="form-input"
              placeholder="Ej: Clínica Santa María, Centro Médico XYZ..."
              value="${this.groupName}"
              autofocus
            >
            <p class="form-hint"><i class="fas fa-info-circle"></i> Usa un nombre único y representativo</p>
          </div>

          <div class="action-buttons">
            <button class="btn btn-secondary" id="btnCancelar">
              <i class="fas fa-arrow-left"></i> Volver
            </button>
            <button class="btn btn-primary" id="btnCrearGrupo" ${!this.groupName.trim() ? 'disabled' : ''}>
              Crear grupo <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEvent('inputGroupName', 'input', (e) => {
      this.groupName = e.target.value;
      document.getElementById('btnCrearGrupo').disabled = !this.groupName.trim();
    });

    this.attachEvent('btnCancelar', 'click', () => {
      this.step = 'seleccion-grupo';
      this.render();
    });

    this.attachEvent('btnCrearGrupo', 'click', () => this.crearGrupo());
  }

  async crearGrupo() {
    try {
      // Deshabilitar botón antes de hacer fetch
      const btn = document.getElementById('btnCrearGrupo');
      if (btn) btn.disabled = true;
      
      this.isLoading = true;
      this.render();

      const response = await fetch('/onboarding-espacios/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: this.groupName })
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error creando grupo');
      }

      this.grupoSeleccionado = data.group_id;
      
      // Cambiar estado ANTES de render para evitar doble render
      this.isLoading = false;
      this.step = 'creacion-nomenclatura';
      this.render();

    } catch (err) {
      console.error('Error:', err);
      this.showNotification(err.message, 'error');
      this.isLoading = false;
      this.render();
    }
  }

  // ==================== PASO 0: SELECCIONAR GRUPO ==================== //
  renderSeleccionGrupo() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-header">
          <h1><i class="fas fa-layer-group"></i> Selecciona tu Grupo</h1>
          <p>Elige el grupo con el que deseas trabajar</p>
        </div>

        <div class="items-list">
          ${this.gruposDisponibles.map(grupo => `
            <div class="item-card" data-grupo-id="${grupo.grupo_id}">
              <div class="item-info">
                <div class="item-name">${grupo.nombre}</div>
                <div class="item-subtitle">
                  <i class="fas fa-calendar-alt"></i>
                  Creado: ${new Date(grupo.created_at).toLocaleDateString('es-CL')}
                </div>
              </div>
              <button class="btn btn-primary" data-action="seleccionar-grupo" data-grupo-id="${grupo.grupo_id}">
                Seleccionar <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          `).join('')}
        </div>

        <button class="btn-add-large" data-action="crear-grupo">
          <i class="fas fa-plus-circle"></i> Crear Nuevo Grupo
        </button>
      </div>
    `;
  }

  irACrearGrupo() {
    this.step = 'crear-grupo';
    this.groupName = '';
    this.render();
  }

  async seleccionarGrupo(grupoId) {
    this.isLoading = true;
    this.render();

    try {
      const response = await fetch(`/onboarding-espacios/api/grupos/${grupoId}?asignar_activo=true`);
      const data = await response.json();

      if (!data.ok || !data.group) {
        throw new Error('No se pudo obtener la información del grupo');
      }

      const grupo = data.group;
      this.grupoSeleccionado = grupoId;

      if (grupo.configured === true) {
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 500);
        return;
      }

      if (!grupo.nomenclatura) {
        this.isLoading = false;
        this.step = 'creacion-nomenclatura';
        return this.render();
      }

      this.generalSpaceName = grupo.nomenclatura.general;
      this.specificSpaceName = grupo.nomenclatura.especifico;
      this.occupantName = grupo.nomenclatura.ocupante || 'Ocupante';
      this.especialidadName = grupo.nomenclatura.especialidad || 'Especialidad';
      this.instrumentName = grupo.nomenclatura.instrumento || 'Instrumento';

      this.isLoading = false;
      this.step = 'creacion-espacios';
      return this.render();

    } catch (err) {
      console.error('Error:', err);
      this.showNotification(err.message, 'error');
      this.isLoading = false;
      this.step = 'seleccion-grupo';
      this.render();
    }
  }

  // ==================== PASO 1: NOMENCLATURA ==================== //
  renderCreacionNomenclatura() {
    const tieneGrupos = this.gruposDisponibles.length > 0;

    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="progress-indicator">
          <div class="progress-step active">
            <span>1</span>
            <span>Nomenclatura</span>
          </div>
          <div class="progress-step">
            <span>2</span>
            <span>Espacios</span>
          </div>
          <div class="progress-step">
            <span>3</span>
            <span>${this.pluralize(this.especialidadName)}</span>
          </div>
          <div class="progress-step">
            <span>4</span>
            <span>${this.pluralize(this.occupantName)}</span>
          </div>
        </div>

        <div class="onboarding-header">
          <h1><i class="fas fa-text-height"></i> Define tu Nomenclatura</h1>
          <p>Personaliza cómo se llamarán los elementos en tu sistema</p>
        </div>

        <div class="form-container">
          <div class="form-group">
            <label class="form-label">Espacio General (Ej: Piso, Área, Sector)</label>
            <input 
              type="text" 
              class="form-input" 
              id="generalSpaceName"
              placeholder="Ej: Pasillo, Piso, Área..."
              value="${this.generalSpaceName}"
            >
            <p class="form-hint"><i class="fas fa-info-circle"></i> Será el agrupador principal</p>
          </div>

          <div class="form-group">
            <label class="form-label">Espacio Específico (Ej: Box, Consultorio, Oficina)</label>
            <input 
              type="text" 
              class="form-input" 
              id="specificSpaceName"
              placeholder="Ej: Box, Consultorio, Oficina..."
              value="${this.specificSpaceName}"
            >
            <p class="form-hint"><i class="fas fa-info-circle"></i> Unidades individuales dentro de cada grupo</p>
          </div>

          <div class="form-group">
            <label class="form-label">Ocupante del Espacio</label>
            <input 
              type="text" 
              class="form-input" 
              id="occupantName"
              placeholder="Ej: Médico, Profesor, Terapeuta..."
              value="${this.occupantName}"
            >
            <p class="form-hint"><i class="fas fa-info-circle"></i> Quien ocupa los espacios</p>
          </div>

          <div class="form-group">
            <label class="form-label">${this.especialidadName}</label>
            <input 
              type="text" 
              class="form-input" 
              id="especialidadName"
              placeholder="Ej: Especialidad, Área, Materia..."
              value="${this.especialidadName}"
            >
            <p class="form-hint"><i class="fas fa-info-circle"></i> Categorías o clasificaciones</p>
          </div>

          <div class="form-group">
            <label class="form-label">${this.instrumentName}</label>
            <input 
              type="text" 
              class="form-input" 
              id="instrumentName"
              placeholder="Ej: Instrumento, Equipo, Herramienta..."
              value="${this.instrumentName}"
            >
            <p class="form-hint"><i class="fas fa-info-circle"></i> Recursos o herramientas disponibles</p>
          </div>

          <div class="action-buttons">
            ${tieneGrupos ? `
              <button class="btn btn-secondary" data-action="volver-seleccion">
                <i class="fas fa-arrow-left"></i> Volver
              </button>
            ` : ''}
            <button class="btn btn-primary" id="btnContinue" ${!this.generalSpaceName.trim() || !this.specificSpaceName.trim() ? 'disabled' : ''}>
              Continuar <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    const inputs = {
      'generalSpaceName': 'generalSpaceName',
      'specificSpaceName': 'specificSpaceName',
      'occupantName': 'occupantName',
      'especialidadName': 'especialidadName',
      'instrumentName': 'instrumentName'
    };

    Object.entries(inputs).forEach(([id, prop]) => {
      this.attachEvent(id, 'input', (e) => {
        this[prop] = e.target.value || (prop === 'occupantName' ? 'Ocupante' : 
                                        prop === 'especialidadName' ? 'Especialidad' : 
                                        prop === 'instrumentName' ? 'Instrumento' : '');
        const btn = document.getElementById('btnContinue');
        if (btn) btn.disabled = !this.generalSpaceName.trim() || !this.specificSpaceName.trim();
      });
    });

    this.attachEvent('btnContinue', 'click', () => this.guardarNomenclatura());
  }

  volverASeleccion() {
    this.step = 'seleccion-grupo';
    this.render();
  }

  async guardarNomenclatura() {
    try {
      // Deshabilitar botón antes de hacer fetch
      const btn = document.getElementById('btnContinue');
      if (btn) btn.disabled = true;
      
      this.isLoading = true;
      this.render();

      const response = await fetch(`/onboarding-espacios/api/grupos/${this.grupoSeleccionado}/nomenclatura`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomenclatura: {
            general: this.generalSpaceName,
            especifico: this.specificSpaceName,
            ocupante: this.occupantName || 'Ocupante',
            especialidad: this.especialidadName || 'Especialidad',
            instrumento: this.instrumentName || 'Instrumento'
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        // Cambiar estado ANTES de render para evitar doble render
        this.isLoading = false;
        this.step = 'creacion-espacios';
        this.render();
      } else {
        throw new Error(data.error || 'Error al guardar');
      }

    } catch (error) {
      console.error('Error:', error);
      this.showNotification(error.message, 'error');
      this.isLoading = false;
      this.render();
    }
  }

  // ==================== PASO 2: ESPACIOS ==================== //
  renderCreacionEspacios() {
    const canSave = this.spaces.length > 0 && this.spaces.every(space => 
      space.name.trim() !== '' && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name.trim() !== '')
    );

    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="progress-indicator">
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Nomenclatura</span>
          </div>
          <div class="progress-step active">
            <span>2</span>
            <span>Espacios</span>
          </div>
          <div class="progress-step">
            <span>3</span>
            <span>${this.pluralize(this.especialidadName)}</span>
          </div>
          <div class="progress-step">
            <span>4</span>
            <span>${this.pluralize(this.occupantName)}</span>
          </div>
        </div>

        <div class="onboarding-header">
          <h1><i class="fas fa-door-open"></i> Crea tus Espacios</h1>
          <p>Define tus ${this.generalSpaceName.toLowerCase()}s y sus ${this.specificSpaceName.toLowerCase()}s correspondientes</p>
        </div>

        ${this.isLoading ? `
          <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Guardando configuración...</p>
          </div>
        ` : ''}

        <div id="spacesList">
          ${this.renderSpaces()}
        </div>

        <button class="btn-add-large" id="btnAddGeneral" ${this.isLoading ? 'disabled' : ''}>
          <i class="fas fa-plus"></i> Agregar ${this.generalSpaceName.toLowerCase()}
        </button>

        <div class="action-buttons">
          <button class="btn btn-secondary" id="btnBack" ${this.isLoading ? 'disabled' : ''}>
            <i class="fas fa-arrow-left"></i> Volver
          </button>
          <button class="btn btn-primary" id="btnSave" ${!canSave || this.isLoading ? 'disabled' : ''}>
            Continuar <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;

    this.attachStep2Listeners();
  }

  renderSpaces() {
    if (this.spaces.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>No hay espacios creados aún. ¡Comienza agregando uno!</p>
        </div>
      `;
    }

    return this.spaces.map(space => `
      <div class="space-item" data-space-id="${space.id}">
        <div class="space-general">
          ${this.renderGeneralSpace(space)}
        </div>
        <div class="space-specific-container">
          ${this.renderSpecificSpaces(space)}
          ${space.name && !space.isEditing ? `
            <button class="btn-add" data-action="add-specific" data-space-id="${space.id}">
              <i class="fas fa-plus"></i> Agregar ${this.specificSpaceName.toLowerCase()}
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  renderGeneralSpace(space) {
    if (space.isEditing) {
      return `
        <input 
          type="text" 
          class="space-general-input" 
          data-space-id="${space.id}"
          placeholder="Nombre del ${this.generalSpaceName.toLowerCase()}"
          value="${space.name}"
          autofocus
        >
        <button class="btn-icon success" data-action="confirm-general" data-space-id="${space.id}" ${!space.name.trim() ? 'disabled' : ''}>
          <i class="fas fa-check"></i>
        </button>
        <button class="btn-icon danger" data-action="delete-general" data-space-id="${space.id}">
          <i class="fas fa-times"></i>
        </button>
      `;
    } else if (this.editingId === space.id) {
      return `
        <input 
          type="text" 
          class="space-general-input" 
          placeholder="Nombre del ${this.generalSpaceName.toLowerCase()}"
          value="${this.editingValue}"
          autofocus
        >
        <button class="btn-icon success" data-action="save-edit-general" data-space-id="${space.id}" ${!this.editingValue.trim() ? 'disabled' : ''}>
          <i class="fas fa-check"></i>
        </button>
        <button class="btn-icon danger" data-action="cancel-edit">
          <i class="fas fa-times"></i>
        </button>
      `;
    } else {
      return `
        <div class="space-general-box">${space.name}</div>
        <button class="btn-icon" data-action="edit-general" data-space-id="${space.id}">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn-icon danger" data-action="delete-general" data-space-id="${space.id}">
          <i class="fas fa-trash"></i>
        </button>
      `;
    }
  }

  renderSpecificSpaces(space) {
    return space.specificSpaces.map(spec => `
      <div class="space-specific-group">
        ${this.renderSpecificSpace(space.id, spec)}
      </div>
    `).join('');
  }

  renderSpecificSpace(spaceId, spec) {
    if (spec.isEditing) {
      return `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <input 
            type="text" 
            class="space-specific-input" 
            data-space-id="${spaceId}"
            data-spec-id="${spec.id}"
            placeholder="Nombre del ${this.specificSpaceName.toLowerCase()}"
            value="${spec.name}"
            autofocus
            style="flex: 1; margin: 0;"
          >
          <button class="btn-icon success" data-action="confirm-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}" ${!spec.name.trim() ? 'disabled' : ''}>
            <i class="fas fa-check"></i>
          </button>
          <button class="btn-icon danger" data-action="delete-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    } else if (this.editingId === spec.id) {
      return `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <input 
            type="text" 
            class="space-specific-input" 
            data-space-id="${spaceId}"
            data-spec-id="${spec.id}"
            placeholder="Nombre del ${this.specificSpaceName.toLowerCase()}"
            value="${this.editingValue}"
            autofocus
            style="flex: 1; margin: 0;"
          >
          <button class="btn-icon success" data-action="save-edit-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}" ${!this.editingValue.trim() ? 'disabled' : ''}>
            <i class="fas fa-check"></i>
          </button>
          <button class="btn-icon danger" data-action="cancel-edit">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    } else {
      return `
        <div class="space-specific-box">
          ${spec.name}
          <div class="space-specific-actions">
            <button class="btn-icon" data-action="edit-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-icon danger" data-action="delete-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }
  }

  attachStep2Listeners() {
    const spacesList = document.getElementById('spacesList');
    if (!spacesList) return;

    spacesList.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      const spaceId = parseInt(button.dataset.spaceId);
      const specId = parseInt(button.dataset.specId);

      const actions = {
        'edit-general': () => this.startEditingGeneral(spaceId, button.parentElement.querySelector('.space-general-box')?.textContent || ''),
        'save-edit-general': () => this.saveEditGeneral(spaceId),
        'confirm-general': () => this.confirmGeneral(spaceId),
        'delete-general': () => this.deleteGeneralSpace(spaceId),
        'edit-specific': () => this.startEditingSpecific(specId, button.parentElement.parentElement.querySelector('.space-specific-box')?.textContent || ''),
        'save-edit-specific': () => this.saveEditSpecific(spaceId, specId),
        'confirm-specific': () => this.confirmSpecific(spaceId, specId),
        'delete-specific': () => this.deleteSpecificSpace(spaceId, specId),
        'add-specific': () => this.addSpecificSpace(spaceId),
        'cancel-edit': () => this.cancelEditing()
      };

      if (actions[action]) actions[action]();
    });

    spacesList.addEventListener('input', (e) => {
      if (e.target.classList.contains('space-general-input')) {
        const spaceId = parseInt(e.target.dataset.spaceId);
        this.updateGeneralInputValue(spaceId, e.target.value);
      } else if (e.target.classList.contains('space-specific-input')) {
        const value = e.target.value;
        const button = e.target.nextElementSibling;
        if (button) {
          button.disabled = !value.trim();
        }
        
        // Actualizar el valor en el array de espacios
        const spaceId = parseInt(e.target.dataset.spaceId);
        const specId = parseInt(e.target.dataset.specId);
        
        if (spaceId && specId) {
          this.spaces = this.spaces.map(s => {
            if (s.id === spaceId) {
              return {
                ...s,
                specificSpaces: s.specificSpaces.map(sp => 
                  sp.id === specId ? { ...sp, name: value } : sp
                )
              };
            }
            return s;
          });
        }
        
        // Si está en modo edición normal, actualizar editingValue
        if (this.editingId === specId) {
          this.editingValue = value;
        }
      }
    });

    spacesList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target;
        if (input.classList.contains('space-general-input')) {
          const spaceId = parseInt(input.dataset.spaceId);
          if (input.value.trim()) {
            this.confirmGeneral(spaceId);
          }
        } else if (input.classList.contains('space-specific-input')) {
          if (!input.value.trim()) return;
          
          // Buscar el botón de confirmar asociado
          const confirmButton = input.nextElementSibling;
          if (confirmButton && confirmButton.dataset.action === 'confirm-specific') {
            const spaceId = parseInt(confirmButton.dataset.spaceId);
            const specId = parseInt(confirmButton.dataset.specId);
            this.confirmSpecific(spaceId, specId);
          } else if (confirmButton && confirmButton.dataset.action === 'save-edit-specific') {
            const spaceId = parseInt(confirmButton.dataset.spaceId);
            const specId = parseInt(confirmButton.dataset.specId);
            this.saveEditSpecific(spaceId, specId);
          }
        }
      } else if (e.key === 'Escape') {
        this.cancelEditing();
      }
    });

    this.attachEvent('btnAddGeneral', 'click', () => this.addGeneralSpace());
    this.attachEvent('btnBack', 'click', () => {
      this.step = 'creacion-nomenclatura';
      this.render();
    });
    this.attachEvent('btnSave', 'click', () => this.continuarATiposInstrumentos());
  }

  updateGeneralInputValue(spaceId, value) {
    const space = this.spaces.find(s => s.id === spaceId);
    if (space) {
      space.name = value;
      
      // Actualizar el estado del botón de confirmar
      const confirmButton = document.querySelector(`button[data-action="confirm-general"][data-space-id="${spaceId}"]`);
      if (confirmButton) {
        confirmButton.disabled = !value.trim();
      }
      
      // Si está en modo edición, actualizar editingValue también
      if (this.editingId === spaceId) {
        this.editingValue = value;
        const saveButton = document.querySelector(`button[data-action="save-edit-general"][data-space-id="${spaceId}"]`);
        if (saveButton) {
          saveButton.disabled = !value.trim();
        }
      }
    }
  }

  addGeneralSpace() {
    this.spaces.push({
      id: Date.now(),
      name: '',
      isEditing: true,
      specificSpaces: []
    });
    this.updateSpacesList();
  }

  confirmGeneral(spaceId) {
    const space = this.spaces.find(s => s.id === spaceId);
    if (!space || !space.name.trim()) {
      this.showNotification(`El nombre del ${this.generalSpaceName.toLowerCase()} no puede estar vacío`, 'error');
      return;
    }
    this.spaces = this.spaces.map(s => s.id === spaceId ? { ...s, isEditing: false } : s);
    this.updateSpacesList();
    this.updateSaveButton();
  }

  startEditingGeneral(spaceId, currentName) {
    // Limpiar el texto del nombre (puede contener espacios en blanco por el HTML)
    const cleanName = currentName.trim();
    this.editingId = spaceId;
    this.editingValue = cleanName;
    this.updateSpacesList();
  }

  saveEditGeneral(spaceId) {
    this.spaces = this.spaces.map(s => s.id === spaceId ? { ...s, name: this.editingValue } : s);
    this.cancelEditing();
  }

  deleteGeneralSpace(spaceId) {
    if (confirm(`¿Eliminar este ${this.generalSpaceName.toLowerCase()} y todos sus ${this.specificSpaceName.toLowerCase()}s?`)) {
      this.spaces = this.spaces.filter(s => s.id !== spaceId);
      this.updateSpacesList();
      this.updateSaveButton();
    }
  }

  addSpecificSpace(spaceId) {
    this.spaces = this.spaces.map(s => {
      if (s.id === spaceId) {
        return {
          ...s,
          specificSpaces: [...s.specificSpaces, { id: Date.now(), name: '', isEditing: true }]
        };
      }
      return s;
    });
    this.updateSpacesList();
  }

  confirmSpecific(spaceId, specId) {
    // Validar que el espacio específico tenga nombre
    const space = this.spaces.find(s => s.id === spaceId);
    if (space) {
      const spec = space.specificSpaces.find(sp => sp.id === specId);
      if (!spec || !spec.name.trim()) {
        this.showNotification(`El nombre del ${this.specificSpaceName.toLowerCase()} no puede estar vacío`, 'error');
        return;
      }
    }
    
    this.spaces = this.spaces.map(s => {
      if (s.id === spaceId) {
        return {
          ...s,
          specificSpaces: s.specificSpaces.map(sp => sp.id === specId ? { ...sp, isEditing: false } : sp)
        };
      }
      return s;
    });
    this.updateSpacesList();
    this.updateSaveButton();
  }

  startEditingSpecific(specId, currentName) {
    // Limpiar el texto del nombre (puede contener espacios en blanco por el HTML)
    const cleanName = currentName.trim();
    this.editingId = specId;
    this.editingValue = cleanName;
    this.render();
  }

  saveEditSpecific(spaceId, specId) {
    this.spaces = this.spaces.map(s => {
      if (s.id === spaceId) {
        return {
          ...s,
          specificSpaces: s.specificSpaces.map(sp => sp.id === specId ? { ...sp, name: this.editingValue } : sp)
        };
      }
      return s;
    });
    this.cancelEditing();
  }

  deleteSpecificSpace(spaceId, specId) {
    if (confirm(`¿Eliminar este ${this.specificSpaceName.toLowerCase()}?`)) {
      this.spaces = this.spaces.map(s => {
        if (s.id === spaceId) {
          return {
            ...s,
            specificSpaces: s.specificSpaces.filter(sp => sp.id !== specId)
          };
        }
        return s;
      });
      this.updateSpacesList();
      this.updateSaveButton();
    }
  }

  cancelEditing() {
    this.editingId = null;
    this.editingValue = '';
    this.updateSpacesList();
  }

  updateSpacesList() {
    const spacesList = document.getElementById('spacesList');
    if (spacesList) {
      // Clonar y reemplazar el elemento para eliminar todos los listeners antiguos
      const newSpacesList = spacesList.cloneNode(false);
      newSpacesList.innerHTML = this.renderSpaces();
      spacesList.parentNode.replaceChild(newSpacesList, spacesList);
      this.attachStep2Listeners();
    }
  }

  updateSaveButton() {
    const canSave = this.spaces.length > 0 && this.spaces.every(space => 
      space.name.trim() !== '' && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name.trim() !== '')
    );
    const saveButton = document.getElementById('btnSave');
    if (saveButton) {
      saveButton.disabled = !canSave;
    }
  }

  updateTiposList() {
    const tiposList = document.getElementById('tiposInstrumentosList');
    if (tiposList) {
      tiposList.innerHTML = this.tiposInstrumentos.length === 0 ? `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>No hay tipos de ${this.instrumentName.toLowerCase()}s creados aún</p>
        </div>
      ` : this.tiposInstrumentos.map((tipo, idx) => `
        <div class="item-card">
          <div class="item-info">
            <div class="item-name">${tipo.nombre}</div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" data-action="edit-tipo-instrumento" data-index="${idx}">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-icon danger" data-action="delete-tipo-instrumento" data-index="${idx}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  updateInstrumentosList() {
    const container = document.getElementById('instrumentosContainer');
    if (container) {
      container.innerHTML = this.tiposInstrumentos.map((tipo, tipoIndex) => `
        <div style="border: 1px solid var(--gray-300); border-radius: 0.5rem; padding: 1.5rem; background: var(--gray-100);">
          <h3 style="margin-bottom: 1rem; color: var(--text-dark);">${tipo.nombre}</h3>
          
          <div class="items-list" style="margin-bottom: 1rem;">
            ${this.instrumentos.filter(inst => inst.tipo_id === tipo.id).length === 0 ? `
              <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No hay ${this.instrumentName.toLowerCase()}s para este tipo</p>
              </div>
            ` : `
              ${this.instrumentos.filter(inst => inst.tipo_id === tipo.id).map((inst) => {
                const globalIndex = this.instrumentos.findIndex(i => i.id === inst.id);
                return `
                  <div class="item-card">
                    <div class="item-info">
                      <div class="item-name">${inst.nombre}</div>
                    </div>
                    <div class="item-actions">
                      <button class="btn-icon" data-action="edit-instrumento" data-index="${globalIndex}">
                        <i class="fas fa-pen"></i>
                      </button>
                      <button class="btn-icon danger" data-action="delete-instrumento" data-index="${globalIndex}">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            `}
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <input 
              type="text" 
              id="nombreInstrumento_${tipoIndex}" 
              class="form-input" 
              placeholder="Nombre del ${this.instrumentName.toLowerCase()}"
              style="flex: 1; margin: 0;"
            >
            <button 
              class="btn btn-primary" 
              data-action="add-instrumento" data-tipo-id="${tipo.id}" data-tipo-index="${tipoIndex}"
              style="flex: 0 0 auto;"
            >
              <i class="fas fa-plus"></i> Agregar
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  updateEspecialidadesList() {
    const especialidadesList = document.getElementById('especialidadesList');
    if (especialidadesList) {
      especialidadesList.innerHTML = this.especialidades.length === 0 ? `
        <div class="empty-state">
          <i class="fas fa-star"></i>
          <p>Aún no hay ${this.especialidadName.toLowerCase()}es. ¡Agrega una para comenzar!</p>
        </div>
      ` : this.especialidades.map((esp, idx) => `
        <div class="item-card">
          <div class="item-info">
            <div class="item-name">${esp.nombre}</div>
          </div>
          <div class="item-actions">
            <button class="btn-icon" data-action="edit-especialidad" data-index="${idx}">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-icon danger" data-action="delete-especialidad" data-index="${idx}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('');
    }
    
    // Actualizar estado del botón continuar
    const continuarBtn = document.querySelector('.action-buttons .btn-primary[onclick*="continuarAOcupantes"]');
    if (continuarBtn) {
      continuarBtn.disabled = this.especialidades.length === 0;
    }
  }

  updateOcupantesList() {
    const ocupantesList = document.getElementById('ocupantesList');
    if (ocupantesList) {
      ocupantesList.innerHTML = this.ocupantes.length === 0 ? `
        <div class="empty-state">
          <i class="fas fa-user-plus"></i>
          <p>No hay ${this.occupantName.toLowerCase()}s agregados aún</p>
        </div>
      ` : this.ocupantes.map((ocu, idx) => `
        <div class="item-card">
          ${ocu.isEditing ? `
            <div style="display: flex; gap: 0.75rem; width: 100%; align-items: flex-start;">
              <div style="flex: 1; display: flex; flex-direction: column; gap: 0.75rem;">
                <input 
                  type="text" 
                  class="form-input" 
                  data-ocupante-index="${idx}"
                  data-field="nombre"
                  value="${ocu.nombre}"
                  placeholder="Nombre del ${this.occupantName.toLowerCase()}"
                  style="margin: 0;"
                >
                <select 
                  class="form-select" 
                  data-ocupante-index="${idx}"
                  data-field="especialidad_id"
                  style="margin: 0;"
                >
                  <option value="">Seleccionar ${this.especialidadName.toLowerCase()}...</option>
                  ${this.especialidades.map(esp => `
                    <option value="${esp.id}" ${ocu.especialidad_id === esp.id ? 'selected' : ''}>
                      ${esp.nombre}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="item-actions">
                <button class="btn-icon success" data-action="confirm-ocupante" data-ocupante-index="${idx}" ${!ocu.nombre.trim() || !ocu.especialidad_id ? 'disabled' : ''}>
                  <i class="fas fa-check"></i>
                </button>
                <button class="btn-icon danger" data-action="cancel-ocupante" data-ocupante-index="${idx}">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            </div>
          ` : `
            <div class="item-info">
              <div class="item-name">${ocu.nombre}</div>
              <div class="item-subtitle">${ocu.especialidad || this.especialidades.find(e => e.id === ocu.especialidad_id)?.nombre || 'Sin especialidad'}</div>
            </div>
            <div class="item-actions">
              <button class="btn-icon" data-action="edit-ocupante" data-ocupante-index="${idx}">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn-icon danger" data-action="delete-ocupante" data-ocupante-index="${idx}">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `}
        </div>
      `).join('');
      
      // Re-attach listeners después de actualizar el HTML
      this.attachOcupantesListeners();
    }
  }

  continuarATiposInstrumentos() {
    if (this.spaces.length === 0) {
      this.showNotification(`Debes crear al menos un ${this.generalSpaceName.toLowerCase()}`, 'error');
      return;
    }
    this.step = 'creacion-tipos-instrumentos';
    this.render();
  }

  // ==================== PASO 2.5: TIPOS DE INSTRUMENTOS ==================== //
  renderCreacionTiposInstrumentos() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="progress-indicator">
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Nomenclatura</span>
          </div>
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Espacios</span>
          </div>
          <div class="progress-step active">
            <span>2.5</span>
            <span>Tipos ${this.pluralize(this.instrumentName)}</span>
          </div>
          <div class="progress-step">
            <span>3</span>
            <span>${this.pluralize(this.especialidadName)}</span>
          </div>
        </div>

        <div class="onboarding-header">
          <h1><i class="fas fa-cubes"></i> Crear Tipos de ${this.pluralize(this.instrumentName)}</h1>
          <p>Define los tipos de ${this.pluralize(this.instrumentName.toLowerCase())} que se usarán en tu organización (opcional)</p>
        </div>

        <div class="items-list" id="tiposInstrumentosList">
          ${this.tiposInstrumentos.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-inbox"></i>
              <p>No hay tipos de ${this.pluralize(this.instrumentName.toLowerCase())} creados aún</p>
            </div>
          ` : this.tiposInstrumentos.map((tipo, idx) => `
            <div class="item-card">
              <div class="item-info">
                <div class="item-name">${tipo.nombre}</div>
              </div>
              <div class="item-actions">
                <button class="btn-icon" data-action="edit-tipo-instrumento" data-index="${idx}">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn-icon danger" data-action="delete-tipo-instrumento" data-index="${idx}">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem;">
          <input 
            type="text" 
            id="nombreTipoInstrumento" 
            class="form-input" 
            placeholder="Nombre del tipo de ${this.instrumentName.toLowerCase()}"
            style="flex: 1; margin: 0;"
          >
          <button class="btn btn-primary btn-flex-auto" data-action="add-tipo-instrumento">
            <i class="fas fa-plus"></i> Agregar
          </button>
        </div>

        <div class="action-buttons">
          <button class="btn btn-secondary" data-action="volver-tipos-desde-espacios">
            <i class="fas fa-arrow-left"></i> Volver
          </button>
          <button class="btn btn-primary" data-action="continuar-instrumentos">
            Continuar <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;

    document.getElementById('nombreTipoInstrumento').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addTipoInstrumento();
    });
  }

  addTipoInstrumento() {
    const input = document.getElementById('nombreTipoInstrumento');
    const nombre = input.value.trim();

    if (!nombre) {
      this.showNotification(`El nombre no puede estar vacío`, 'error');
      return;
    }

    if (this.tiposInstrumentos.some(t => t.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.showNotification('Este tipo ya existe', 'error');
      return;
    }

    this.tiposInstrumentos.push({ 
      id: Date.now().toString(), 
      nombre 
    });
    input.value = '';
    this.showNotification('Tipo agregado', 'success');
    this.updateTiposList();
  }

  editTipoInstrumento(index) {
    const nuevoNombre = prompt(`Editar tipo de ${this.instrumentName.toLowerCase()}:`, this.tiposInstrumentos[index].nombre);
    if (!nuevoNombre) return;

    const nombre = nuevoNombre.trim();
    if (!nombre) {
      this.showNotification('El nombre no puede estar vacío', 'error');
      return;
    }

    if (this.tiposInstrumentos.some((t, i) => i !== index && t.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.showNotification('Este tipo ya existe', 'error');
      return;
    }

    this.tiposInstrumentos[index].nombre = nombre;
    this.showNotification('Tipo actualizado', 'success');
    this.updateTiposList();
  }

  deleteTipoInstrumento(index) {
    if (confirm(`¿Eliminar este tipo de ${this.instrumentName.toLowerCase()}?`)) {
      this.tiposInstrumentos.splice(index, 1);
      this.showNotification('Tipo eliminado', 'success');
      this.updateTiposList();
    }
  }

  omitirTiposInstrumentos() {
    this.tiposInstrumentos = [];
    this.instrumentos = [];
    this.step = 'creacion-especialidades';
    this.render();
  }

  volverATiposDesdeEspacios() {
    this.step = 'creacion-espacios';
    this.render();
  }

  continuarAInstrumentos() {
    if (this.tiposInstrumentos.length === 0) {
      this.step = 'creacion-especialidades';
    } else {
      this.step = 'creacion-instrumentos';
    }
    this.render();
  }

  // ==================== PASO 2.7: INSTRUMENTOS ==================== //
  renderCreacionInstrumentos() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="progress-indicator">
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Nomenclatura</span>
          </div>
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Espacios</span>
          </div>
          <div class="progress-step active">
            <span>2.7</span>
            <span>${this.pluralize(this.instrumentName)}</span>
          </div>
          <div class="progress-step">
            <span>3</span>
            <span>${this.pluralize(this.especialidadName)}</span>
          </div>
        </div>

        <div class="onboarding-header">
          <h1><i class="fas fa-wrench"></i> Crear ${this.pluralize(this.instrumentName)}</h1>
          <p>Asigna ${this.pluralize(this.instrumentName.toLowerCase())} a cada tipo creado</p>
        </div>

        <div id="instrumentosContainer" style="display: flex; flex-direction: column; gap: 1.5rem;">
          ${this.tiposInstrumentos.map((tipo, tipoIndex) => `
            <div style="border: 1px solid var(--gray-300); border-radius: 0.5rem; padding: 1.5rem; background: var(--gray-100);">
              <h3 style="margin-bottom: 1rem; color: var(--text-dark);">${tipo.nombre}</h3>
              
              <div class="items-list" style="margin-bottom: 1rem;">
                ${this.instrumentos.filter(inst => inst.tipo_id === tipo.id).length === 0 ? `
                  <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No hay ${this.pluralize(this.instrumentName.toLowerCase())} para este tipo</p>
                  </div>
                ` : `
                  ${this.instrumentos.filter(inst => inst.tipo_id === tipo.id).map((inst) => {
                    const globalIndex = this.instrumentos.findIndex(i => i.id === inst.id);
                    return `
                      <div class="item-card">
                        <div class="item-info">
                          <div class="item-name">${inst.nombre}</div>
                        </div>
                        <div class="item-actions">
                          <button class="btn-icon" data-action="edit-instrumento" data-index="${globalIndex}">
                            <i class="fas fa-pen"></i>
                          </button>
                          <button class="btn-icon danger" data-action="delete-instrumento" data-index="${globalIndex}">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                `}
              </div>

              <div style="display: flex; gap: 0.75rem;">
                <input 
                  type="text" 
                  id="nombreInstrumento_${tipoIndex}" 
                  class="form-input" 
                  placeholder="Nombre del ${this.instrumentName.toLowerCase()}"
                  style="flex: 1; margin: 0;"
                >
                <button 
                  class="btn btn-primary" 
                  data-action="add-instrumento" data-tipo-id="${tipo.id}" data-tipo-index="${tipoIndex}"
                  style="flex: 0 0 auto;"
                >
                  <i class="fas fa-plus"></i> Agregar
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="action-buttons" style="margin-top: 2rem;">
          <button class="btn btn-secondary" data-action="volver-tipos-instrumentos">
            <i class="fas fa-arrow-left"></i> Volver
          </button>
          <button class="btn btn-primary" data-action="continuar-desde-instrumentos">
            Continuar <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;
  }

  addInstrumento(tipoId, tipoIndex) {
    const nombreInput = document.getElementById(`nombreInstrumento_${tipoIndex}`);
    const nombre = nombreInput.value.trim();

    if (!nombre) {
      this.showNotification(`El nombre no puede estar vacío`, 'error');
      return;
    }

    const existe = this.instrumentos.some(inst => 
      inst.tipo_id === tipoId && inst.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      this.showNotification(`Este ${this.instrumentName.toLowerCase()} ya existe para este tipo`, 'error');
      return;
    }

    this.instrumentos.push({ 
      id: Date.now().toString(), 
      nombre,
      tipo_id: tipoId
    });
    nombreInput.value = '';
    this.showNotification(`${this.instrumentName} agregado`, 'success');
    this.updateInstrumentosList();
  }

  editInstrumento(index) {
    const nuevoNombre = prompt(`Editar ${this.instrumentName.toLowerCase()}:`, this.instrumentos[index].nombre);
    if (!nuevoNombre) return;

    const nombre = nuevoNombre.trim();
    if (!nombre) {
      this.showNotification('El nombre no puede estar vacío', 'error');
      return;
    }

    const instrumento = this.instrumentos[index];
    const existe = this.instrumentos.some((inst, idx) => 
      idx !== index && 
      inst.tipo_id === instrumento.tipo_id && 
      inst.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      this.showNotification(`Este ${this.instrumentName.toLowerCase()} ya existe para este tipo`, 'error');
      return;
    }

    this.instrumentos[index].nombre = nombre;
    this.showNotification(`${this.instrumentName} actualizado`, 'success');
    this.updateInstrumentosList();
  }

  deleteInstrumento(index) {
    if (confirm(`¿Eliminar este ${this.instrumentName.toLowerCase()}?`)) {
      this.instrumentos.splice(index, 1);
      this.showNotification(`${this.instrumentName} eliminado`, 'success');
      this.updateInstrumentosList();
    }
  }

  omitirInstrumentos() {
    this.instrumentos = [];
    this.step = 'creacion-especialidades';
    this.render();
  }

  volverATiposInstrumentos() {
    this.step = 'creacion-tipos-instrumentos';
    this.render();
  }

  continuarDesdeInstrumentos() {
    this.step = 'creacion-especialidades';
    this.render();
  }

  // ==================== PASO 3: ESPECIALIDADES ==================== //
  renderCreacionEspecialidades() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="progress-indicator">
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Nomenclatura</span>
          </div>
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Espacios</span>
          </div>
          <div class="progress-step active">
            <span>3</span>
            <span>${this.pluralize(this.especialidadName)}</span>
          </div>
          <div class="progress-step">
            <span>4</span>
            <span>${this.pluralize(this.occupantName)}</span>
          </div>
        </div>

        <div class="onboarding-header">
          <h1><i class="fas fa-certificate"></i> Crea ${this.pluralize(this.especialidadName)}</h1>
          <p>Define ${this.pluralize(this.especialidadName.toLowerCase())} disponibles para tus ${this.pluralize(this.occupantName.toLowerCase())}</p>
        </div>

        <div class="items-list" id="especialidadesList">
          ${this.especialidades.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-star"></i>
              <p>Aún no hay ${this.pluralize(this.especialidadName.toLowerCase())}. ¡Agrega una para comenzar!</p>
            </div>
          ` : this.especialidades.map((esp, idx) => `
            <div class="item-card">
              <div class="item-info">
                <div class="item-name">${esp.nombre}</div>
              </div>
              <div class="item-actions">
                <button class="btn-icon" data-action="edit-especialidad" data-index="${idx}">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn-icon danger" data-action="delete-especialidad" data-index="${idx}">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}        </div>

        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem;">
          <input 
            type="text" 
            id="nuevaEspecialidad" 
            class="form-input" 
            placeholder="Nombre de la ${this.especialidadName.toLowerCase()}"
            style="flex: 1; margin: 0;"
          >
          <button class="btn btn-primary btn-flex-auto" data-action="add-especialidad">
            <i class="fas fa-plus"></i> Agregar
          </button>
        </div>

        <div class="action-buttons">
          <button class="btn btn-secondary" data-action="volver-espacios">
            <i class="fas fa-arrow-left"></i> Volver
          </button>
          <button class="btn btn-primary" data-action="continuar-ocupantes" ${this.especialidades.length === 0 ? 'disabled' : ''}>
            Continuar <i class="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    `;

    document.getElementById('nuevaEspecialidad').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addEspecialidad();
    });
  }

  addEspecialidad() {
    const input = document.getElementById('nuevaEspecialidad');
    const nombre = input.value.trim();

    if (!nombre) {
      this.showNotification(`El nombre no puede estar vacío`, 'error');
      return;
    }

    if (this.especialidades.some(e => e.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.showNotification('Esta especialidad ya existe', 'error');
      return;
    }

    // Generar ID único para la especialidad
    const especialidadId = `ESP#${this.especialidades.length + 1}`;
    this.especialidades.push({ id: especialidadId, nombre });
    input.value = '';
    this.showNotification('Especialidad agregada', 'success');
    this.updateEspecialidadesList();
  }

  editEspecialidad(index) {
    const nuevoNombre = prompt(`Editar ${this.especialidadName}:`, this.especialidades[index].nombre);
    if (!nuevoNombre) return;

    const nombre = nuevoNombre.trim();
    if (!nombre) {
      this.showNotification('El nombre no puede estar vacío', 'error');
      return;
    }

    if (this.especialidades.some((e, i) => i !== index && e.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.showNotification('Esta especialidad ya existe', 'error');
      return;
    }

    this.especialidades[index].nombre = nombre;
    this.showNotification('Especialidad actualizada', 'success');
    this.updateEspecialidadesList();
  }

  deleteEspecialidad(index) {
    if (confirm(`¿Eliminar la ${this.especialidadName.toLowerCase()} "${this.especialidades[index].nombre}"?`)) {
      this.especialidades.splice(index, 1);
      this.showNotification('Especialidad eliminada', 'success');
      this.updateEspecialidadesList();
    }
  }

  volverAEspacios() {
    // Si hay tipos de instrumentos, volver a instrumentos
    if (this.tiposInstrumentos.length > 0) {
      this.step = 'creacion-instrumentos';
    } else {
      // Si no hay tipos, volver a tipos-instrumentos
      this.step = 'creacion-tipos-instrumentos';
    }
    this.render();
  }

  continuarAOcupantes() {
    if (this.especialidades.length === 0) {
      this.showNotification(`Debes crear al menos una ${this.especialidadName.toLowerCase()}`, 'error');
      return;
    }
    this.step = 'creacion-ocupantes';
    this.render();
  }

  // ==================== PASO 4: OCUPANTES ==================== //
  renderCreacionOcupantes() {
    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="progress-indicator">
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Nomenclatura</span>
          </div>
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>Espacios</span>
          </div>
          <div class="progress-step completed">
            <i class="fas fa-check"></i>
            <span>${this.pluralize(this.especialidadName)}</span>
          </div>
          <div class="progress-step active">
            <span>4</span>
            <span>${this.pluralize(this.occupantName)}</span>
          </div>
        </div>

        <div class="onboarding-header">
          <h1><i class="fas fa-users"></i> Agregar ${this.pluralize(this.occupantName)}</h1>
          <p>Agrega ${this.pluralize(this.occupantName.toLowerCase())} a tu sistema (puedes hacerlo después si lo prefieres)</p>
        </div>

        <div class="items-list" id="ocupantesList">
          ${this.ocupantes.length === 0 ? `
            <div class="empty-state">
              <i class="fas fa-user-plus"></i>
              <p>No hay ${this.pluralize(this.occupantName.toLowerCase())} agregados aún</p>
            </div>
          ` : this.ocupantes.map((ocu, idx) => `
            <div class="item-card">
              ${ocu.isEditing ? `
                <div style="display: flex; gap: 0.75rem; width: 100%; align-items: flex-start;">
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 0.75rem;">
                    <input 
                      type="text" 
                      class="form-input" 
                      data-ocupante-index="${idx}"
                      data-field="nombre"
                      value="${ocu.nombre}"
                      placeholder="Nombre del ${this.occupantName.toLowerCase()}"
                      style="margin: 0;"
                    >
                    <select 
                      class="form-select" 
                      data-ocupante-index="${idx}"
                      data-field="especialidad_id"
                      style="margin: 0;"
                    >
                      <option value="">Seleccionar ${this.especialidadName.toLowerCase()}...</option>
                      ${this.especialidades.map(esp => `
                        <option value="${esp.id}" ${ocu.especialidad_id === esp.id ? 'selected' : ''}>
                          ${esp.nombre}
                        </option>
                      `).join('')}
                    </select>
                  </div>
                  <div class="item-actions">
                    <button class="btn-icon success" data-action="confirm-ocupante" data-ocupante-index="${idx}" ${!ocu.nombre.trim() || !ocu.especialidad_id ? 'disabled' : ''}>
                      <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-icon danger" data-action="cancel-ocupante" data-ocupante-index="${idx}">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                </div>
              ` : `
                <div class="item-info">
                  <div class="item-name">${ocu.nombre}</div>
                  <div class="item-subtitle">${ocu.especialidad || this.especialidades.find(e => e.id === ocu.especialidad_id)?.nombre || 'Sin especialidad'}</div>
                </div>
                <div class="item-actions">
                  <button class="btn-icon" data-action="edit-ocupante" data-ocupante-index="${idx}">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="btn-icon danger" data-action="delete-ocupante" data-ocupante-index="${idx}">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              `}
            </div>
          `).join('')}
        </div>

        <button class="btn-add-large" data-action="add-ocupante">
          <i class="fas fa-plus"></i> Agregar ${this.occupantName.toLowerCase()}
        </button>

        <div class="action-buttons">
          <button class="btn btn-secondary" data-action="volver-especialidades">
            <i class="fas fa-arrow-left"></i> Volver
          </button>
          <button class="btn btn-primary" data-action="finalizar-configuracion">
            Finalizar Configuración <i class="fas fa-check-circle"></i>
          </button>
        </div>
      </div>
    `;

    this.attachOcupantesListeners();
  }

  attachOcupantesListeners() {
    const ocupantesList = document.getElementById('ocupantesList');

    ocupantesList.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      const idx = parseInt(button.dataset.ocupanteIndex);

      switch (action) {
        case 'confirm-ocupante':
          this.confirmOcupante(idx);
          break;
        case 'cancel-ocupante':
          this.cancelOcupante(idx);
          break;
        case 'edit-ocupante':
          this.editOcupante(idx);
          break;
        case 'delete-ocupante':
          this.deleteOcupante(idx);
          break;
      }
    });

    ocupantesList.addEventListener('input', (e) => {
      if (e.target.dataset.ocupanteIndex !== undefined) {
        const idx = parseInt(e.target.dataset.ocupanteIndex);
        const field = e.target.dataset.field;
        this.ocupantes[idx][field] = e.target.value;
        
        // Actualizar estado del botón de confirmar
        const ocupante = this.ocupantes[idx];
        const confirmButton = document.querySelector(`button[data-action="confirm-ocupante"][data-ocupante-index="${idx}"]`);
        if (confirmButton) {
          confirmButton.disabled = !ocupante.nombre.trim() || !ocupante.especialidad_id;
        }
      }
    });

    ocupantesList.addEventListener('change', (e) => {
      if (e.target.dataset.ocupanteIndex !== undefined) {
        const idx = parseInt(e.target.dataset.ocupanteIndex);
        const field = e.target.dataset.field;
        this.ocupantes[idx][field] = e.target.value;
        
        // Si cambió la especialidad, también guardar el nombre
        if (field === 'especialidad_id') {
          const especialidad = this.especialidades.find(esp => esp.id === e.target.value);
          if (especialidad) {
            this.ocupantes[idx].especialidad = especialidad.nombre;
          }
        }
        
        // Actualizar estado del botón de confirmar
        const ocupante = this.ocupantes[idx];
        const confirmButton = document.querySelector(`button[data-action="confirm-ocupante"][data-ocupante-index="${idx}"]`);
        if (confirmButton) {
          confirmButton.disabled = !ocupante.nombre.trim() || !ocupante.especialidad_id;
        }
      }
    });
  }

  addOcupante() {
    this.ocupantes.push({
      nombre: '',
      especialidad_id: '',
      especialidad: '',
      isEditing: true
    });
    this.updateOcupantesList();
  }

  confirmOcupante(idx) {
    const ocupante = this.ocupantes[idx];
    if (!ocupante.nombre.trim() || !ocupante.especialidad_id) {
      this.showNotification('Debes completar todos los campos', 'error');
      return;
    }
    
    // Asegurar que también se guarde el nombre de la especialidad
    const especialidad = this.especialidades.find(e => e.id === ocupante.especialidad_id);
    if (especialidad) {
      ocupante.especialidad = especialidad.nombre;
    }
    
    console.log('✅ Ocupante confirmado:', {
      nombre: ocupante.nombre,
      especialidad_id: ocupante.especialidad_id,
      especialidad: ocupante.especialidad
    });
    
    ocupante.isEditing = false;
    this.updateOcupantesList();
  }

  cancelOcupante(idx) {
    if (!this.ocupantes[idx].nombre) {
      this.ocupantes.splice(idx, 1);
    } else {
      this.ocupantes[idx].isEditing = false;
    }
    this.updateOcupantesList();
  }

  editOcupante(idx) {
    this.ocupantes[idx].isEditing = true;
    this.updateOcupantesList();
  }

  deleteOcupante(idx) {
    this.ocupantes.splice(idx, 1);
    this.updateOcupantesList();
  }

  volverAEspecialidades() {
    this.step = 'creacion-especialidades';
    this.render();
  }

  // ==================== FINALIZAR CONFIGURACIÓN ==================== //
  async finalizarConfiguracion() {
    try {
      this.isLoading = true;
      this.render();

      const ocupantesConfirmados = this.ocupantes.filter(o => !o.isEditing && o.nombre.trim() && o.especialidad_id);

      const payload = {
        grupo_id: this.grupoSeleccionado,
        espacios: this.spaces.map(space => ({
          name: space.name,
          specificSpaces: space.specificSpaces.map(spec => ({
            name: spec.name
          }))
        })),
        especialidades: this.especialidades.map(esp => ({
          nombre: esp.nombre
        })),
        ocupantes: ocupantesConfirmados.map(o => ({
          nombre: o.nombre,
          especialidad_id: o.especialidad_id,
          especialidad: o.especialidad,
          tipo: this.occupantName
        })),
        tipos_instrumentos: this.tiposInstrumentos.map(tipo => ({
          id: tipo.id,
          nombre: tipo.nombre
        })),
        instrumentos: this.instrumentos.map(inst => ({
          nombre: inst.nombre,
          tipo_id: inst.tipo_id
        }))
      };

      console.log('📤 Enviando payload:', JSON.stringify(payload, null, 2));
      console.log('📊 Resumen:', {
        grupo_id: payload.grupo_id,
        total_espacios: payload.espacios.length,
        total_especialidades: payload.especialidades.length,
        total_ocupantes: payload.ocupantes.length,
        total_tipos_instrumentos: payload.tipos_instrumentos.length,
        total_instrumentos: payload.instrumentos.length
      });

      const response = await fetch('/onboarding-espacios/api/espacios/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      console.log('📦 Respuesta del servidor:', data);

      if (response.ok && data.ok) {
        this.showSuccessMessage(data);
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 2000);
      } else {
        const errorMsg = data.error || data.details || 'Error al guardar la configuración';
        console.error('❌ Error del servidor:', errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error) {
      console.error('❌ Error completo:', error);
      console.error('❌ Stack:', error.stack);
      
      let errorMsg = 'Error al guardar la configuración';
      if (error.message && !error.message.includes('Failed to fetch')) {
        errorMsg = error.message;
      } else if (error.message.includes('Failed to fetch')) {
        errorMsg = 'No se pudo conectar con el servidor';
      }
      
      this.showNotification(errorMsg, 'error');
      this.isLoading = false;
      this.render();
    }
  }

  // ==================== MENSAJES Y NOTIFICACIONES ==================== //
  showSuccessMessage(data) {
    const totalGenerales = data.total_generales;
    const totalEspecificos = data.total_especificos;
    const totalOcupantes = data.total_ocupantes || 0;

    this.root.innerHTML = `
      <div class="onboarding-card">
        <div class="success-message">
          <i class="fas fa-check-circle"></i>
          <h3>¡Configuración completada!</h3>
          <p>Se han creado ${totalGenerales} ${this.generalSpaceName.toLowerCase()}(s) con ${totalEspecificos} ${this.specificSpaceName.toLowerCase()}(s)
          ${totalOcupantes > 0 ? ` y ${totalOcupantes} ${this.occupantName.toLowerCase()}(s)` : ''}</p>
          <p class="redirect-info"></i> Redirigiendo al dashboard...</p>
        </div>
      </div>
    `;
  }

  showNotification(message, type = 'success') {
    const notif = document.createElement('div');
    notif.className = `notification-toast ${type}`;
    notif.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
      <span>${message}</span>
      <button class="close-notification">&times;</button>
    `;

    document.body.appendChild(notif);
    notif.querySelector('.close-notification').addEventListener('click', () => notif.remove());
    setTimeout(() => notif.remove(), 4000);
  }

  // ==================== UTILIDADES ==================== //
  attachEvent(id, event, callback) {
    const element = document.getElementById(id);
    if (element) element.addEventListener(event, callback);
  }
}

// ==================== INICIALIZAR APP ==================== //
document.addEventListener('DOMContentLoaded', () => {
  window.onboardingApp = new OnboardingEspacios();
  
  // Event delegation para todos los botones con data-action
  document.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    
    const action = button.getAttribute('data-action');
    const app = window.onboardingApp;
    
    // Prevenir múltiples clicks
    e.stopPropagation();
    
    switch (action) {
      // Grupos
      case 'seleccionar-grupo':
        app.seleccionarGrupo(button.getAttribute('data-grupo-id'));
        break;
      case 'crear-grupo':
        app.irACrearGrupo();
        break;
      case 'volver-seleccion':
        app.volverASeleccion();
        break;
        
      // Tipos Instrumentos
      case 'edit-tipo-instrumento':
        app.editTipoInstrumento(parseInt(button.getAttribute('data-index')));
        break;
      case 'delete-tipo-instrumento':
        app.deleteTipoInstrumento(parseInt(button.getAttribute('data-index')));
        break;
      case 'add-tipo-instrumento':
        app.addTipoInstrumento();
        break;
      case 'volver-tipos-desde-espacios':
        app.volverATiposDesdeEspacios();
        break;
      case 'continuar-instrumentos':
        app.continuarAInstrumentos();
        break;
        
      // Instrumentos
      case 'edit-instrumento':
        app.editInstrumento(parseInt(button.getAttribute('data-index')));
        break;
      case 'delete-instrumento':
        app.deleteInstrumento(parseInt(button.getAttribute('data-index')));
        break;
      case 'add-instrumento':
        app.addInstrumento(
          button.getAttribute('data-tipo-id'),
          parseInt(button.getAttribute('data-tipo-index'))
        );
        break;
      case 'volver-tipos-instrumentos':
        app.volverATiposInstrumentos();
        break;
      case 'continuar-desde-instrumentos':
        app.continuarDesdeInstrumentos();
        break;
        
      // Especialidades
      case 'edit-especialidad':
        app.editEspecialidad(parseInt(button.getAttribute('data-index')));
        break;
      case 'delete-especialidad':
        app.deleteEspecialidad(parseInt(button.getAttribute('data-index')));
        break;
      case 'add-especialidad':
        app.addEspecialidad();
        break;
      case 'volver-espacios':
        app.volverAEspacios();
        break;
      case 'continuar-ocupantes':
        app.continuarAOcupantes();
        break;
        
      // Ocupantes
      case 'add-ocupante':
        app.addOcupante();
        break;
      case 'volver-especialidades':
        app.volverAEspecialidades();
        break;
      case 'finalizar-configuracion':
        app.finalizarConfiguracion();
        break;
    }
  });
});