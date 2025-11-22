// public/js/onboarding-espacios.js

class OnboardingEspacios {
  constructor() {
    this.step = 'loading'; // loading, seleccion-grupo, creacion-nomenclatura, creacion-espacios, creacion-tipos-instrumentos, creacion-instrumentos, creacion-especialidades, creacion-ocupantes
    this.generalSpaceName = '';
    this.specificSpaceName = '';
    this.occupantName = 'Ocupante'; // Valor por defecto
    this.especialidadName = 'Especialidad'; // Valor por defecto
    this.instrumentName = 'Instrumento'; // Valor por defecto
    this.spaces = [];
    this.tiposInstrumentos = []; // Array de tipos de instrumentos
    this.instrumentos = []; // Array de instrumentos
    this.especialidades = []; // Array de especialidades
    this.ocupantes = []; // Array de ocupantes
    this.editingId = null;
    this.editingValue = '';
    this.root = document.getElementById('onboarding-root');
    this.isLoading = false;
    this.gruposDisponibles = [];
    this.grupoSeleccionado = null;
    this.groupName = '';
    
    this.init();
  }

  async init() {
      this.step = "loading";
      this.render();

      await this.cargarGruposUsuario();

      if (this.gruposDisponibles.length === 0) {
        // No hay grupos → crear uno
        this.step = "crear-grupo";
        return this.render();
      }

      this.step = "seleccion-grupo";
      this.render();
    }

  async cargarGruposUsuario() {
    try {
      const response = await fetch('/onboarding-espacios/api/espacios/grupos-usuario', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.gruposDisponibles = data.grupos || [];
        console.log('📋 Grupos disponibles:', this.gruposDisponibles);
      } else {
        console.warn('⚠️ Error HTTP al cargar grupos:', response.status);
        this.gruposDisponibles = [];
      }
    } catch (error) {
      console.error('❌ Error cargando grupos:', error);
      this.gruposDisponibles = [];
    }
  }

  render() {
    switch (this.step) {
      case 'crear-grupo':
        this.renderCrearGrupo();
        break;
      case 'loading':
        this.renderLoading();
        break;
      case 'seleccion-grupo':
        this.renderSeleccionGrupo();
        break;
      case 'creacion-nomenclatura':
        this.renderCreacionNomenclatura();
        break;
      case 'creacion-espacios':
        this.renderCreacionEspacios();
        break;
      case 'creacion-tipos-instrumentos':
        this.renderCreacionTiposInstrumentos();
        break;
      case 'creacion-instrumentos':
        this.renderCreacionInstrumentos();
        break;
      case 'creacion-especialidades':
        this.renderCreacionEspecialidades();
        break;
      case 'creacion-ocupantes':
        this.renderCreacionOcupantes();
        break;
    }
  }

  renderCrearGrupo() {
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">

          <h1 class="welcome-title">Crear un nuevo Grupo</h1>
          <p class="welcome-subtitle">Este será el nombre que identificarà tu organización o equipo</p>

          <div class="form-group">
            <label class="form-label">Nombre del grupo</label>
            <input 
              type="text" 
              id="inputGroupName"
              class="form-input"
              placeholder="Ej: Clínica Santa María, Centro Médico XYZ..."
              value="${this.groupName}"
            >
          </div>

          <div class="action-buttons">
            <button class="btn-secondary" id="btnCancelar">
              <i class="fas fa-arrow-left"></i> Volver
            </button>

            <button class="btn-primary" id="btnCrearGrupo" ${!this.groupName.trim() ? 'disabled' : ''}>
              Crear grupo <i class="fas fa-check"></i>
            </button>
          </div>

        </div>
      </div>
    `;

    document.getElementById('inputGroupName').addEventListener('input', e => {
      this.groupName = e.target.value;
      document.getElementById('btnCrearGrupo').disabled = !this.groupName.trim();
    });

    document.getElementById('btnCancelar').addEventListener('click', () => {
      this.step = 'seleccion-grupo';
      this.render();
    });

    document.getElementById('btnCrearGrupo').addEventListener('click', () => {
      this.crearGrupo();
    });
  }

  async crearGrupo() {
    try {
      this.isLoading = true;
      this.renderLoading();

      console.log("🔄 Creando grupo...");

      const response = await fetch('/onboarding-espacios/api/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: this.groupName }) // Cambiado de 'name' a 'nombre'
      });

      console.log("📡 Respuesta recibida:", response.status);

      const data = await response.json();
      console.log("📦 Data:", data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Error creando grupo');
      }

      console.log("✅ Grupo creado exitosamente:", data.group_id);

      // Guardar el nuevo grupo como seleccionado
      this.grupoSeleccionado = data.group_id;

      // Pasar a crear nomenclatura
      this.step = 'creacion-nomenclatura';
      this.render();

    } catch (err) {
      console.error("❌ Error en crearGrupo:", err);
      this.showErrorMessage(err.message);
      this.isLoading = false;
      this.step = 'crear-grupo';
      this.render();
    }
  }

  renderLoading() {
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Cargando...</p>
          </div>
        </div>
      </div>
    `;
  }

  renderSeleccionGrupo() {
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="welcome-header">
            <h1 class="welcome-title">Selecciona tu Grupo de Trabajo</h1>
            <p class="welcome-subtitle">Elige el grupo con el que deseas trabajar</p>
          </div>

          <div class="grupos-lista">
            ${this.gruposDisponibles.map(grupo => `
              <div class="grupo-card" data-grupo-id="${grupo.grupo_id}">
                <div class="grupo-info">
                  <h3 class="grupo-nombre">${grupo.nombre}</h3>
                  <div class="grupo-detalles">
                    <span class="grupo-fecha">
                      <i class="fas fa-calendar"></i>
                      Creado: ${new Date(grupo.created_at).toLocaleDateString('es-CL')}
                    </span>
                  </div>
                </div>
                <button class="btn-select-grupo" data-grupo-id="${grupo.grupo_id}">
                  Seleccionar
                  <i class="fas fa-arrow-right"></i>
                </button>
              </div>
            `).join('')}
          </div>

          <div class="action-buttons-center">
            <button class="btn-create-new" id="btnCrearNuevoGrupo">
              <i class="fas fa-plus-circle"></i>
              Crear Nuevo Grupo
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    document.querySelectorAll('.btn-select-grupo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const grupoId = e.currentTarget.dataset.grupoId;
        this.seleccionarGrupo(grupoId);
      });
    });

    document.getElementById('btnCrearNuevoGrupo').addEventListener('click', () => {
      this.step = 'crear-grupo';
      this.render();
    });
  }

  async seleccionarGrupo(grupoId) {
    this.isLoading = true;
    this.render();

    try {
      // 🔥 Obtener información real del grupo y asignarlo como activo si está configurado
      const response = await fetch(`/onboarding-espacios/api/grupos/${grupoId}?asignar_activo=true`);
      const data = await response.json();

      if (!data.ok || !data.group) {
        throw new Error("No se pudo obtener la información del grupo");
      }

      const grupo = data.group;
      this.grupoSeleccionado = grupoId;

      // 📌 Lógica de flujo
      if (grupo.configured === true) {
        console.log('✅ Grupo configurado, redirigiendo al dashboard...');
        // Usar replace para evitar que el usuario vuelva atrás al onboarding
        setTimeout(() => {
          window.location.replace("/dashboard");
        }, 100);
        return;
      }

      if (!grupo.nomenclatura) {
        this.step = "creacion-nomenclatura";
        return this.render();
      }

      this.generalSpaceName = grupo.nomenclatura.general;
      this.specificSpaceName = grupo.nomenclatura.especifico;
      this.occupantName = grupo.nomenclatura.ocupante || 'Ocupante';
      this.especialidadName = grupo.nomenclatura.especialidad || 'Especialidad';

      this.step = "creacion-espacios";
      return this.render();

    } catch (err) {
      console.error(err);
      this.showErrorMessage(err.message);
      this.isLoading = false;
      this.step = "seleccion-grupo";
      this.render();
    }
  }

  renderCreacionNomenclatura() {
    const tieneGrupos = this.gruposDisponibles.length > 0;
    
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="welcome-header">
            <h1 class="welcome-title">
              ${tieneGrupos ? 'Crear Nuevo Grupo de Espacios' : 'Bienvenido a tu Sistema de Gestión'}
            </h1>
            <p class="welcome-subtitle">
              ${tieneGrupos 
                ? 'Define la nomenclatura para tu nuevo grupo de espacios' 
                : 'Comencemos definiendo cómo llamarás a tus espacios'}
            </p>
          </div>

          <div class="form-container">
            <div class="form-group">
              <label class="form-label">¿Cómo llamarás al espacio general?</label>
              <input 
                type="text" 
                class="form-input" 
                id="generalSpaceName"
                placeholder="Ej: Pasillo, Piso, Área, Sector..."
                value="${this.generalSpaceName}"
              >
              <p class="form-hint">Este será el nombre para agrupar tus espacios</p>
            </div>

            <div class="form-group">
              <label class="form-label">¿Cómo llamarás al espacio específico?</label>
              <input 
                type="text" 
                class="form-input" 
                id="specificSpaceName"
                placeholder="Ej: Box, Consultorio, Oficina, Sala..."
                value="${this.specificSpaceName}"
              >
              <p class="form-hint">Este será el nombre de los espacios dentro de cada grupo</p>
            </div>

            <div class="form-group">
              <label class="form-label">¿Cómo llamarás al ocupante del espacio?</label>
              <input 
                type="text" 
                class="form-input" 
                id="occupantName"
                placeholder="Ej: Médico, Profesor, Terapeuta..."
                value="${this.occupantName}"
              >
              <p class="form-hint">Este será el nombre para quien ocupa el espacio</p>
            </div>

            <div class="form-group">
              <label class="form-label">¿Cómo llamarás a la especialidad?</label>
              <input 
                type="text" 
                class="form-input" 
                id="especialidadName"
                placeholder="Ej: Especialidad, Área, Materia..."
                value="${this.especialidadName}"
              >
              <p class="form-hint">Este será el nombre para las especialidades de los ocupantes</p>
            </div>

            <div class="form-group">
              <label class="form-label">¿Cómo llamarás a los instrumentos?</label>
              <input 
                type="text" 
                class="form-input" 
                id="instrumentName"
                placeholder="Ej: Instrumento, Equipo, Herramienta..."
                value="${this.instrumentName}"
              >
              <p class="form-hint">Este será el nombre para los instrumentos que usarás en tus espacios</p>
            </div>

            <div class="action-buttons">
              ${tieneGrupos ? `
                <button class="btn-secondary" id="btnVolver">
                  <i class="fas fa-arrow-left"></i>
                  Volver
                </button>
              ` : ''}
              <button class="btn-primary" id="btnContinue" ${!this.generalSpaceName.trim() || !this.specificSpaceName.trim() ? 'disabled' : ''}>
                Continuar
                <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const generalInput = document.getElementById('generalSpaceName');
    const specificInput = document.getElementById('specificSpaceName');
    const occupantInput = document.getElementById('occupantName');
    const especialidadInput = document.getElementById('especialidadName');
    const instrumentInput = document.getElementById('instrumentName');
    const btnContinue = document.getElementById('btnContinue');
    const btnVolver = document.getElementById('btnVolver');

    generalInput.addEventListener('input', (e) => {
      this.generalSpaceName = e.target.value;
      btnContinue.disabled = !this.generalSpaceName.trim() || !this.specificSpaceName.trim();
    });

    specificInput.addEventListener('input', (e) => {
      this.specificSpaceName = e.target.value;
      btnContinue.disabled = !this.generalSpaceName.trim() || !this.specificSpaceName.trim();
    });

    occupantInput.addEventListener('input', (e) => {
      this.occupantName = e.target.value || 'Ocupante';
    });

    especialidadInput.addEventListener('input', (e) => {
      this.especialidadName = e.target.value || 'Especialidad';
    });

    instrumentInput.addEventListener('input', (e) => {
      this.instrumentName = e.target.value || 'Instrumento';
    });

    btnContinue.addEventListener('click', async () => {
      if (this.generalSpaceName.trim() && this.specificSpaceName.trim()) {
        console.log('✅ Nombres definidos:', {
          general: this.generalSpaceName,
          especifico: this.specificSpaceName,
          ocupante: this.occupantName
        });
        
        // Guardar nomenclatura en el backend antes de continuar
        await this.guardarNomenclatura();
      }
    });

    if (btnVolver) {
      btnVolver.addEventListener('click', () => {
        this.step = 'seleccion-grupo';
        this.render();
      });
    }
  }

  renderCreacionEspacios() {
    const canSave = this.spaces.length > 0 && this.spaces.every(space => 
      space.name.trim() !== '' && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name.trim() !== '')
    );

    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="spaces-header">
            <h2 class="spaces-title">Crea tus Espacios</h2>
            <p class="spaces-subtitle">Define tus ${this.generalSpaceName.toLowerCase()}s y sus ${this.specificSpaceName.toLowerCase()}s correspondientes</p>
          </div>

          ${this.isLoading ? `
            <div class="loading-overlay">
              <div class="spinner"></div>
              <p>Guardando configuración...</p>
            </div>
          ` : ''}

          <div class="spaces-list" id="spacesList">
            ${this.renderSpaces()}
          </div>

          <button class="btn-add btn-add-general" id="btnAddGeneral" ${this.isLoading ? 'disabled' : ''}>
            <i class="fas fa-plus"></i>
            Agregar ${this.generalSpaceName.toLowerCase()}
          </button>

          <div class="action-buttons">
            <button class="btn-secondary" id="btnBack" ${this.isLoading ? 'disabled' : ''}>
              <i class="fas fa-arrow-left"></i>
              Volver
            </button>
            <button class="btn-save" id="btnSave" ${!canSave || this.isLoading ? 'disabled' : ''}>
              ${this.isLoading ? 'Procesando...' : 'Continuar'}
              ${!this.isLoading ? '<i class="fas fa-arrow-right"></i>' : ''}
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachStep2Listeners();
  }

  renderSpaces() {
    if (this.spaces.length === 0) {
      return '<div class="empty-state">No hay espacios creados. Haz clic en "Agregar" para comenzar.</div>';
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
              <i class="fas fa-plus"></i>
              Agregar ${this.specificSpaceName.toLowerCase()}
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
          data-action="edit-general-input"
          placeholder="Nombre del ${this.generalSpaceName.toLowerCase()}"
          value="${space.name}"
          autofocus
        >
        <button class="icon-btn success" data-action="confirm-general" data-space-id="${space.id}" ${!space.name.trim() ? 'disabled' : ''}>
          <i class="fas fa-check"></i>
        </button>
        <button class="icon-btn danger" data-action="delete-general" data-space-id="${space.id}">
          <i class="fas fa-times"></i>
        </button>
      `;
    } else if (this.editingId === space.id) {
      return `
        <input 
          type="text" 
          class="space-general-input" 
          data-space-id="${space.id}"
          data-action="editing-general-input"
          placeholder="Nombre del ${this.generalSpaceName.toLowerCase()}"
          value="${this.editingValue}"
          autofocus
        >
        <button class="icon-btn success" data-action="save-edit-general" data-space-id="${space.id}" ${!this.editingValue.trim() ? 'disabled' : ''}>
          <i class="fas fa-check"></i>
        </button>
        <button class="icon-btn danger" data-action="cancel-edit">
          <i class="fas fa-times"></i>
        </button>
      `;
    } else {
      return `
        <div class="space-general-box">${space.name}</div>
        <button class="icon-btn" data-action="edit-general" data-space-id="${space.id}" data-name="${space.name}">
          <i class="fas fa-edit"></i>
        </button>
        <button class="icon-btn danger" data-action="delete-general" data-space-id="${space.id}">
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
        <div class="space-specific-input-group">
          <input 
            type="text" 
            class="space-specific-input" 
            data-space-id="${spaceId}"
            data-spec-id="${spec.id}"
            data-action="edit-specific-input"
            placeholder="Nombre del ${this.specificSpaceName.toLowerCase()}"
            value="${spec.name}"
            autofocus
          >
          <button class="icon-btn success" data-action="confirm-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}" ${!spec.name.trim() ? 'disabled' : ''}>
            <i class="fas fa-check"></i>
          </button>
          <button class="icon-btn danger" data-action="delete-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    } else if (this.editingId === spec.id) {
      return `
        <div class="space-specific-input-group">
          <input 
            type="text" 
            class="space-specific-input" 
            data-space-id="${spaceId}"
            data-spec-id="${spec.id}"
            data-action="editing-specific-input"
            placeholder="Nombre del ${this.specificSpaceName.toLowerCase()}"
            value="${this.editingValue}"
            autofocus
          >
          <button class="icon-btn success" data-action="save-edit-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}" ${!this.editingValue.trim() ? 'disabled' : ''}>
            <i class="fas fa-check"></i>
          </button>
          <button class="icon-btn danger" data-action="cancel-edit">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    } else {
      return `
        <div class="space-specific-box">
          ${spec.name}
          <div class="space-specific-actions">
            <button class="icon-btn" data-action="edit-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}" data-name="${spec.name}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="icon-btn danger" data-action="delete-specific" data-space-id="${spaceId}" data-spec-id="${spec.id}">
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

    // Delegación de eventos para clicks
    spacesList.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      const spaceId = parseInt(button.dataset.spaceId);
      const specId = parseInt(button.dataset.specId);

      switch (action) {
        case 'edit-general':
          this.startEditingGeneral(spaceId, button.dataset.name);
          break;
        case 'save-edit-general':
          this.saveEditGeneral(spaceId);
          break;
        case 'confirm-general':
          this.confirmGeneral(spaceId);
          break;
        case 'delete-general':
          this.deleteGeneralSpace(spaceId);
          break;
        case 'edit-specific':
          this.startEditingSpecific(specId, button.dataset.name);
          break;
        case 'save-edit-specific':
          this.saveEditSpecific(spaceId, specId);
          break;
        case 'confirm-specific':
          this.confirmSpecific(spaceId, specId);
          break;
        case 'delete-specific':
          this.deleteSpecificSpace(spaceId, specId);
          break;
        case 'add-specific':
          this.addSpecificSpace(spaceId);
          break;
        case 'cancel-edit':
          this.cancelEditing();
          break;
      }
    });

    // Delegación para inputs
    spacesList.addEventListener('input', (e) => {
      const input = e.target;
      const action = input.dataset.action;
      const spaceId = parseInt(input.dataset.spaceId);
      const specId = parseInt(input.dataset.specId);

      if (action === 'edit-general-input') {
        this.updateGeneralInputValue(spaceId, input.value);
      } else if (action === 'editing-general-input') {
        this.updateEditingValue(input.value);
      } else if (action === 'edit-specific-input') {
        this.updateSpecificInputValue(spaceId, specId, input.value);
      } else if (action === 'editing-specific-input') {
        this.updateEditingValue(input.value);
      }
    });

    // Soporte para Enter y Escape
    spacesList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const input = e.target;
        const action = input.dataset.action;
        const spaceId = parseInt(input.dataset.spaceId);
        const specId = parseInt(input.dataset.specId);

        if (action === 'edit-general-input' && input.value.trim()) {
          this.confirmGeneral(spaceId);
        } else if (action === 'editing-general-input' && this.editingValue.trim()) {
          this.saveEditGeneral(spaceId);
        } else if (action === 'edit-specific-input' && input.value.trim()) {
          this.confirmSpecific(spaceId, specId);
        } else if (action === 'editing-specific-input' && this.editingValue.trim()) {
          this.saveEditSpecific(spaceId, specId);
        }
      } else if (e.key === 'Escape') {
        this.cancelEditing();
      }
    });

    document.getElementById('btnAddGeneral').addEventListener('click', () => {
      this.addGeneralSpace();
    });

    document.getElementById('btnBack').addEventListener('click', () => {
      this.step = 'creacion-nomenclatura';
      this.render();
    });

    document.getElementById('btnSave').addEventListener('click', () => {
      this.continuarAOcupantes();
    });
  }

  // Métodos de actualización (sin re-renderizar todo)
  updateGeneralInputValue(spaceId, value) {
    const space = this.spaces.find(s => s.id === spaceId);
    if (space) {
      space.name = value;
      const btn = document.querySelector(`button[data-action="confirm-general"][data-space-id="${spaceId}"]`);
      if (btn) {
        btn.disabled = !value.trim();
      }
      this.updateSaveButton();
    }
  }

  updateEditingValue(value) {
    this.editingValue = value;
    const saveBtn = document.querySelector(`button[data-action="save-edit-general"]`) || 
                    document.querySelector(`button[data-action="save-edit-specific"]`);
    if (saveBtn) {
      saveBtn.disabled = !value.trim();
    }
  }

  updateSpecificInputValue(spaceId, specId, value) {
    const space = this.spaces.find(s => s.id === spaceId);
    if (space) {
      const spec = space.specificSpaces.find(s => s.id === specId);
      if (spec) {
        spec.name = value;
        const btn = document.querySelector(`button[data-action="confirm-specific"][data-spec-id="${specId}"]`);
        if (btn) {
          btn.disabled = !value.trim();
        }
        this.updateSaveButton();
      }
    }
  }

  updateSaveButton() {
    const canSave = this.spaces.length > 0 && this.spaces.every(space => 
      space.name.trim() !== '' && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name.trim() !== '')
    );
    const saveBtn = document.getElementById('btnSave');
    if (saveBtn) {
      saveBtn.disabled = !canSave;
    }
  }

  // Métodos CRUD
  addGeneralSpace() {
    const newSpace = {
      id: Date.now(),
      name: '',
      isEditing: true,
      specificSpaces: []
    };
    this.spaces.push(newSpace);
    this.render();
  }

  confirmGeneral(spaceId) {
    this.spaces = this.spaces.map(space => 
      space.id === spaceId ? { ...space, isEditing: false } : space
    );
    this.render();
  }

  startEditingGeneral(spaceId, currentName) {
    this.editingId = spaceId;
    this.editingValue = currentName;
    this.render();
  }

  saveEditGeneral(spaceId) {
    this.spaces = this.spaces.map(space => 
      space.id === spaceId ? { ...space, name: this.editingValue } : space
    );
    this.cancelEditing();
  }

  deleteGeneralSpace(spaceId) {
    if (confirm('¿Estás seguro de eliminar este espacio y todos sus sub-espacios?')) {
      this.spaces = this.spaces.filter(space => space.id !== spaceId);
      this.render();
    }
  }

  addSpecificSpace(spaceId) {
    this.spaces = this.spaces.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          specificSpaces: [
            ...space.specificSpaces,
            { id: Date.now(), name: '', isEditing: true }
          ]
        };
      }
      return space;
    });
    this.render();
  }

  confirmSpecific(spaceId, specId) {
    this.spaces = this.spaces.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          specificSpaces: space.specificSpaces.map(spec =>
            spec.id === specId ? { ...spec, isEditing: false } : spec
          )
        };
      }
      return space;
    });
    this.render();
  }

  startEditingSpecific(specId, currentName) {
    this.editingId = specId;
    this.editingValue = currentName;
    this.render();
  }

  saveEditSpecific(spaceId, specId) {
    this.spaces = this.spaces.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          specificSpaces: space.specificSpaces.map(spec =>
            spec.id === specId ? { ...spec, name: this.editingValue } : spec
          )
        };
      }
      return space;
    });
    this.cancelEditing();
  }

  deleteSpecificSpace(spaceId, specId) {
    if (confirm('¿Estás seguro de eliminar este espacio específico?')) {
      this.spaces = this.spaces.map(space => {
        if (space.id === spaceId) {
          return {
            ...space,
            specificSpaces: space.specificSpaces.filter(spec => spec.id !== specId)
          };
        }
        return space;
      });
      this.render();
    }
  }

  cancelEditing() {
    this.editingId = null;
    this.editingValue = '';
    this.render();
  }

  async guardarNomenclatura() {
    try {
      console.log('🔄 Guardando nomenclatura...');
      console.log('  - Grupo ID:', this.grupoSeleccionado);
      console.log('  - General:', this.generalSpaceName);
      console.log('  - Específico:', this.specificSpaceName);

      if (!this.grupoSeleccionado) {
        throw new Error('No hay un grupo seleccionado');
      }

      this.isLoading = true;
      this.renderLoading();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

      const response = await fetch(`/onboarding-espacios/api/grupos/${this.grupoSeleccionado}/nomenclatura`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nomenclatura: {
            general: this.generalSpaceName,
            especifico: this.specificSpaceName,
            ocupante: this.occupantName || 'Ocupante',
            especialidad: this.especialidadName || 'Especialidad',
            instrumento: this.instrumentName || 'Instrumento'
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('📥 Respuesta nomenclatura:', response.status);

      const data = await response.json();
      console.log('📦 Data nomenclatura:', data);

      if (response.ok && data.ok) {
        console.log('✅ Nomenclatura guardada exitosamente');
        
        // Ahora sí pasar a la creación de espacios
        this.isLoading = false;
        this.step = 'creacion-espacios';
        this.render();
      } else {
        throw new Error(data.error || 'Error al guardar la nomenclatura');
      }

    } catch (error) {
      console.error('❌ Error guardando nomenclatura:', error);
      this.isLoading = false;
      
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'La operación tardó demasiado tiempo. Por favor, intenta nuevamente.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.';
      }
      
      this.showErrorMessage(errorMessage);
      this.render();
    }
  }

  continuarAOcupantes() {
    // Validar que hay espacios creados
    if (this.spaces.length === 0) {
      this.showErrorMessage('Debes crear al menos un espacio antes de continuar');
      return;
    }

    const allValid = this.spaces.every(space => 
      space.name.trim() !== '' && 
      space.specificSpaces.length > 0 &&
      space.specificSpaces.every(spec => spec.name.trim() !== '')
    );

    if (!allValid) {
      this.showErrorMessage('Completa todos los espacios antes de continuar');
      return;
    }

    // Pasar al paso de tipos de instrumentos
    this.step = 'creacion-tipos-instrumentos';
    this.render();
  }

  // ==================== TIPOS DE INSTRUMENTOS ====================
  renderCreacionTiposInstrumentos() {
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="onboarding-header">
            <h2>Crear Tipos de ${this.instrumentName}s</h2>
            <p>Define los tipos de ${this.instrumentName.toLowerCase()}s que se usarán en tu organización (opcional)</p>
          </div>

          <div class="especialidades-container">
            ${this.tiposInstrumentos.length === 0 ? `
              <div class="empty-state">
                <p>No hay tipos de ${this.instrumentName.toLowerCase()}s creados aún</p>
                <p class="text-muted">Puedes añadir tipos o omitir este paso</p>
              </div>
            ` : `
              <div class="especialidades-list">
                ${this.tiposInstrumentos.map((tipo, index) => `
                  <div class="especialidad-item" data-index="${index}">
                    <div class="especialidad-info">
                      <span class="especialidad-name">${tipo.nombre}</span>
                    </div>
                    <div class="especialidad-actions">
                      <button class="btn-icon btn-edit" onclick="onboardingApp.editTipoInstrumento(${index})" title="Editar">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon btn-delete" onclick="onboardingApp.deleteTipoInstrumento(${index})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}

            <div class="add-especialidad-section">
              <input 
                type="text" 
                id="nombreTipoInstrumento" 
                class="form-input" 
                placeholder="Nombre del tipo de ${this.instrumentName.toLowerCase()}"
                value="${this.editingValue}"
              >
              <button 
                class="btn btn-primary" 
                onclick="onboardingApp.${this.editingId !== null ? 'updateTipoInstrumento' : 'addTipoInstrumento'}()"
              >
                ${this.editingId !== null ? 'Actualizar' : 'Agregar'}
              </button>
              ${this.editingId !== null ? `
                <button class="btn btn-secondary" onclick="onboardingApp.cancelEditTipoInstrumento()">
                  Cancelar
                </button>
              ` : ''}
            </div>
          </div>

          <div class="onboarding-actions">
            <button class="btn btn-secondary" onclick="onboardingApp.omitirTiposInstrumentos()">
              Omitir
            </button>
            <button 
              class="btn btn-primary" 
              onclick="onboardingApp.continuarAInstrumentos()"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  addTipoInstrumento() {
    const nombreInput = document.getElementById('nombreTipoInstrumento');
    const nombre = nombreInput.value.trim();

    if (nombre === '') {
      this.showErrorMessage(`El nombre del tipo de ${this.instrumentName.toLowerCase()} no puede estar vacío`);
      return;
    }

    // Verificar si ya existe
    const existe = this.tiposInstrumentos.some(tipo => 
      tipo.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      this.showErrorMessage(`El tipo de ${this.instrumentName.toLowerCase()} "${nombre}" ya existe`);
      return;
    }

    this.tiposInstrumentos.push({ 
      id: Date.now().toString(), 
      nombre 
    });
    nombreInput.value = '';
    this.render();
  }

  editTipoInstrumento(index) {
    this.editingId = index;
    this.editingValue = this.tiposInstrumentos[index].nombre;
    this.render();
  }

  updateTipoInstrumento() {
    const nombreInput = document.getElementById('nombreTipoInstrumento');
    const nombre = nombreInput.value.trim();

    if (nombre === '') {
      this.showErrorMessage(`El nombre del tipo de ${this.instrumentName.toLowerCase()} no puede estar vacío`);
      return;
    }

    // Verificar si ya existe (excluyendo el actual)
    const existe = this.tiposInstrumentos.some((tipo, idx) => 
      idx !== this.editingId && tipo.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      this.showErrorMessage(`El tipo de ${this.instrumentName.toLowerCase()} "${nombre}" ya existe`);
      return;
    }

    this.tiposInstrumentos[this.editingId].nombre = nombre;
    this.editingId = null;
    this.editingValue = '';
    this.render();
  }

  cancelEditTipoInstrumento() {
    this.editingId = null;
    this.editingValue = '';
    this.render();
  }

  deleteTipoInstrumento(index) {
    if (confirm(`¿Estás seguro de que deseas eliminar este tipo de ${this.instrumentName.toLowerCase()}?`)) {
      this.tiposInstrumentos.splice(index, 1);
      this.render();
    }
  }

  omitirTiposInstrumentos() {
    // Omitir tipos de instrumentos e instrumentos, ir directo a especialidades
    this.step = 'creacion-especialidades';
    this.render();
  }

  continuarAInstrumentos() {
    // Si no hay tipos creados, ir directo a especialidades
    if (this.tiposInstrumentos.length === 0) {
      this.step = 'creacion-especialidades';
    } else {
      this.step = 'creacion-instrumentos';
    }
    this.render();
  }

  // ==================== ESPECIALIDADES ====================
  renderCreacionEspecialidades() {
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="onboarding-header">
            <h2>Crear ${this.especialidadName}es</h2>
            <p>Define las ${this.especialidadName.toLowerCase()}es disponibles para tus ${this.occupantName.toLowerCase()}s</p>
          </div>

          <div class="especialidades-container">
            ${this.especialidades.length === 0 ? `
              <div class="empty-state">
                <p>No hay ${this.especialidadName.toLowerCase()}es creadas aún</p>
                <p class="text-muted">Añade al menos una ${this.especialidadName.toLowerCase()}</p>
              </div>
            ` : `
              <div class="especialidades-list">
                ${this.especialidades.map((esp, index) => `
                  <div class="especialidad-item" data-index="${index}">
                    <div class="especialidad-info">
                      <span class="especialidad-name">${esp.nombre}</span>
                    </div>
                    <div class="especialidad-actions">
                      <button class="btn-icon btn-edit" onclick="onboardingApp.editEspecialidad(${index})" title="Editar">
                        <i class="fas fa-edit"></i>
                      </button>
                      <button class="btn-icon btn-delete" onclick="onboardingApp.deleteEspecialidad(${index})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}

            <div class="add-especialidad-section">
              <input 
                type="text" 
                id="nuevaEspecialidad" 
                class="especialidad-input" 
                placeholder="Nombre de la ${this.especialidadName.toLowerCase()}"
                onkeydown="if(event.key==='Enter') onboardingApp.addEspecialidad()"
              >
              <button class="btn-add-large" onclick="onboardingApp.addEspecialidad()">
                <i class="fas fa-plus"></i>
                Añadir ${this.especialidadName}
              </button>
            </div>
          </div>

          <div class="onboarding-actions">
            <button class="btn btn-secondary" onclick="onboardingApp.volverAEspacios()">
              <i class="fas fa-arrow-left"></i>
              Volver
            </button>
            <button class="btn btn-primary" onclick="onboardingApp.continuarDesdeEspecialidades()">
              Continuar
              <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  addEspecialidad() {
    const input = document.getElementById('nuevaEspecialidad');
    const nombre = input.value.trim();

    if (nombre === '') {
      this.showErrorMessage(`El nombre de la ${this.especialidadName.toLowerCase()} no puede estar vacío`);
      return;
    }

    // Verificar duplicados
    if (this.especialidades.some(e => e.nombre.toLowerCase() === nombre.toLowerCase())) {
      this.showErrorMessage('Ya existe una especialidad con ese nombre');
      return;
    }

    this.especialidades.push({ nombre });
    input.value = '';
    this.render();
    this.showNotification(`${this.especialidadName} añadida correctamente`, 'success');
  }

  editEspecialidad(index) {
    const especialidad = this.especialidades[index];
    const nuevoNombre = prompt(`Editar ${this.especialidadName}:`, especialidad.nombre);

    if (nuevoNombre === null) return; // Canceló

    if (nuevoNombre.trim() === '') {
      this.showErrorMessage('El nombre no puede estar vacío');
      return;
    }

    // Verificar duplicados (excepto el actual)
    if (this.especialidades.some((e, i) => i !== index && e.nombre.toLowerCase() === nuevoNombre.trim().toLowerCase())) {
      this.showErrorMessage('Ya existe una especialidad con ese nombre');
      return;
    }

    this.especialidades[index].nombre = nuevoNombre.trim();
    this.render();
    this.showNotification(`${this.especialidadName} actualizada`, 'success');
  }

  deleteEspecialidad(index) {
    if (confirm(`¿Eliminar la ${this.especialidadName.toLowerCase()} "${this.especialidades[index].nombre}"?`)) {
      this.especialidades.splice(index, 1);
      this.render();
      this.showNotification(`${this.especialidadName} eliminada`, 'success');
    }
  }

  volverAEspacios() {
    this.step = 'creacion-espacios';
    this.render();
  }

  continuarDesdeEspecialidades() {
    if (this.especialidades.length === 0) {
      this.showErrorMessage(`Debes crear al menos una ${this.especialidadName.toLowerCase()} antes de continuar`);
      return;
    }

    this.step = 'creacion-ocupantes';
    this.render();
  }

  // ==================== INSTRUMENTOS ====================
  renderCreacionInstrumentos() {
    this.root.innerHTML = `
      <div class="onboarding-container">
        <div class="onboarding-card">
          <div class="onboarding-header">
            <h2>Crear ${this.instrumentName}s</h2>
            <p>Asigna ${this.instrumentName.toLowerCase()}s a cada tipo creado</p>
          </div>

          <div class="instrumentos-section">
            ${this.tiposInstrumentos.map((tipo, tipoIndex) => `
              <div class="tipo-instrumento-card">
                <h3>${tipo.nombre}</h3>
                
                <div class="instrumentos-list">
                  ${this.instrumentos.filter(inst => inst.tipo_id === tipo.id).length === 0 ? `
                    <div class="empty-state-small">
                      <p>No hay ${this.instrumentName.toLowerCase()}s para este tipo</p>
                    </div>
                  ` : `
                    ${this.instrumentos.filter(inst => inst.tipo_id === tipo.id).map((inst, instIndex) => {
                      const globalIndex = this.instrumentos.findIndex(i => i.id === inst.id);
                      return `
                        <div class="instrumento-item">
                          <span class="instrumento-name">${inst.nombre}</span>
                          <div class="instrumento-actions">
                            <button class="btn-icon btn-edit" onclick="onboardingApp.editInstrumento(${globalIndex})" title="Editar">
                              <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" onclick="onboardingApp.deleteInstrumento(${globalIndex})" title="Eliminar">
                              <i class="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  `}
                </div>

                <div class="add-instrumento-section">
                  <input 
                    type="text" 
                    id="nombreInstrumento_${tipoIndex}" 
                    class="form-input" 
                    placeholder="Nombre del ${this.instrumentName.toLowerCase()}"
                  >
                  <button 
                    class="btn btn-primary btn-sm" 
                    onclick="onboardingApp.addInstrumento('${tipo.id}', ${tipoIndex})"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>

          ${this.editingId !== null ? `
            <div class="edit-instrumento-modal">
              <div class="modal-content">
                <h3>Editar ${this.instrumentName}</h3>
                <input 
                  type="text" 
                  id="editNombreInstrumento" 
                  class="form-input" 
                  value="${this.editingValue}"
                >
                <div class="modal-actions">
                  <button class="btn btn-secondary" onclick="onboardingApp.cancelEditInstrumento()">
                    Cancelar
                  </button>
                  <button class="btn btn-primary" onclick="onboardingApp.updateInstrumento()">
                    Actualizar
                  </button>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="onboarding-actions">
            <button class="btn btn-secondary" onclick="onboardingApp.omitirInstrumentos()">
              Omitir
            </button>
            <button 
              class="btn btn-primary" 
              onclick="onboardingApp.continuarDesdeInstrumentos()"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  addInstrumento(tipoId, tipoIndex) {
    const nombreInput = document.getElementById(`nombreInstrumento_${tipoIndex}`);
    const nombre = nombreInput.value.trim();

    if (nombre === '') {
      this.showErrorMessage(`El nombre del ${this.instrumentName.toLowerCase()} no puede estar vacío`);
      return;
    }

    // Verificar si ya existe en este tipo
    const existe = this.instrumentos.some(inst => 
      inst.tipo_id === tipoId && inst.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      this.showErrorMessage(`El ${this.instrumentName.toLowerCase()} "${nombre}" ya existe para este tipo`);
      return;
    }

    this.instrumentos.push({ 
      id: Date.now().toString(), 
      nombre,
      tipo_id: tipoId
    });
    nombreInput.value = '';
    this.render();
  }

  editInstrumento(index) {
    this.editingId = index;
    this.editingValue = this.instrumentos[index].nombre;
    this.render();
    
    // Focus en el input de edición
    setTimeout(() => {
      const input = document.getElementById('editNombreInstrumento');
      if (input) input.focus();
    }, 100);
  }

  updateInstrumento() {
    const nombreInput = document.getElementById('editNombreInstrumento');
    const nombre = nombreInput.value.trim();

    if (nombre === '') {
      this.showErrorMessage(`El nombre del ${this.instrumentName.toLowerCase()} no puede estar vacío`);
      return;
    }

    const instrumento = this.instrumentos[this.editingId];
    
    // Verificar si ya existe (excluyendo el actual)
    const existe = this.instrumentos.some((inst, idx) => 
      idx !== this.editingId && 
      inst.tipo_id === instrumento.tipo_id && 
      inst.nombre.toLowerCase() === nombre.toLowerCase()
    );

    if (existe) {
      this.showErrorMessage(`El ${this.instrumentName.toLowerCase()} "${nombre}" ya existe para este tipo`);
      return;
    }

    this.instrumentos[this.editingId].nombre = nombre;
    this.editingId = null;
    this.editingValue = '';
    this.render();
  }

  cancelEditInstrumento() {
    this.editingId = null;
    this.editingValue = '';
    this.render();
  }

  deleteInstrumento(index) {
    if (confirm(`¿Estás seguro de que deseas eliminar este ${this.instrumentName.toLowerCase()}?`)) {
      this.instrumentos.splice(index, 1);
      this.render();
    }
  }

  omitirInstrumentos() {
    this.step = 'creacion-especialidades';
    this.render();
  }

  continuarDesdeInstrumentos() {
    // Permitir continuar aunque no haya instrumentos
    this.step = 'creacion-especialidades';
    this.render();
  }

  // ==================== OCUPANTES ====================

  renderCreacionOcupantes() {
    this.root.innerHTML = `
      <div class="onboarding-container">
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
              <span>${this.especialidadName}es</span>
            </div>
            <div class="progress-step active">
              <span>4</span>
              <span>${this.occupantName}s</span>
            </div>
          </div>

          <h1 class="step-title">Agregar ${this.occupantName}s Iniciales</h1>
          <p class="step-subtitle">Puedes agregar ${this.occupantName.toLowerCase()}s ahora o hacerlo después</p>

          <div class="ocupantes-container">
            <div id="ocupantes-list" class="ocupantes-list">
              ${this.renderOcupantes()}
            </div>
          </div>

          <button class="btn-add-large" id="btnAgregarOcupante">
            <i class="fas fa-plus"></i>
            Agregar ${this.occupantName.toLowerCase()}
          </button>

          <div class="action-buttons">
            <button class="btn-secondary" id="btnBackOcupantes">
              <i class="fas fa-arrow-left"></i>
              Volver a ${this.especialidadName.toLowerCase()}es
            </button>
            <button class="btn-save" id="btnGuardarTodo">
              Finalizar configuración
              <i class="fas fa-check"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachOcupantesListeners();
  }

  renderOcupantes() {
    if (this.ocupantes.length === 0) {
      return '<div class="empty-state">No hay ocupantes agregados. Haz clic en "Agregar" para comenzar (opcional).</div>';
    }

    return this.ocupantes.map((ocupante, index) => `
      <div class="ocupante-item" data-ocupante-index="${index}">
        ${ocupante.isEditing ? `
          <div class="ocupante-form">
            <input 
              type="text" 
              class="ocupante-input" 
              data-ocupante-index="${index}"
              data-field="nombre"
              value="${ocupante.nombre}"
              placeholder="Nombre del ${this.occupantName.toLowerCase()}"
              autofocus
            >
            <select 
              class="ocupante-select" 
              data-ocupante-index="${index}"
              data-field="especialidad"
            >
              <option value="">Seleccionar ${this.especialidadName.toLowerCase()}...</option>
              ${this.especialidades.map(esp => `
                <option value="${esp.nombre}" ${ocupante.especialidad === esp.nombre ? 'selected' : ''}>
                  ${esp.nombre}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="ocupante-actions">
            <button class="btn-icon btn-confirm" data-action="confirm-ocupante" data-ocupante-index="${index}" ${!ocupante.nombre.trim() || !ocupante.especialidad ? 'disabled' : ''}>
              <i class="fas fa-check"></i>
            </button>
            <button class="btn-icon btn-cancel" data-action="cancel-ocupante" data-ocupante-index="${index}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        ` : `
          <div class="ocupante-info">
            <span class="ocupante-nombre">${ocupante.nombre}</span>
            <span class="ocupante-especialidad">${ocupante.especialidad}</span>
          </div>
          <div class="ocupante-actions">
            <button class="btn-icon" data-action="edit-ocupante" data-ocupante-index="${index}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon btn-delete" data-action="delete-ocupante" data-ocupante-index="${index}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `}
      </div>
    `).join('');
  }

  attachOcupantesListeners() {
    const ocupantesList = document.getElementById('ocupantes-list');

    ocupantesList.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      const index = parseInt(button.dataset.ocupanteIndex);

      switch (action) {
        case 'confirm-ocupante':
          this.confirmOcupante(index);
          break;
        case 'cancel-ocupante':
          this.cancelOcupante(index);
          break;
        case 'edit-ocupante':
          this.editOcupante(index);
          break;
        case 'delete-ocupante':
          this.deleteOcupante(index);
          break;
      }
    });

    ocupantesList.addEventListener('input', (e) => {
      if (e.target.classList.contains('ocupante-input') || e.target.classList.contains('ocupante-select')) {
        const index = parseInt(e.target.dataset.ocupanteIndex);
        const field = e.target.dataset.field;
        this.updateOcupanteInput(index, field, e.target.value);
      }
    });

    ocupantesList.addEventListener('change', (e) => {
      if (e.target.classList.contains('ocupante-select')) {
        const index = parseInt(e.target.dataset.ocupanteIndex);
        const field = e.target.dataset.field;
        this.updateOcupanteInput(index, field, e.target.value);
      }
    });

    ocupantesList.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('ocupante-input')) {
        const index = parseInt(e.target.dataset.ocupanteIndex);
        if (this.ocupantes[index].nombre.trim() && this.ocupantes[index].especialidad) {
          this.confirmOcupante(index);
        }
      } else if (e.key === 'Escape' && e.target.classList.contains('ocupante-input')) {
        const index = parseInt(e.target.dataset.ocupanteIndex);
        this.cancelOcupante(index);
      }
    });

    document.getElementById('btnAgregarOcupante').addEventListener('click', () => {
      this.addOcupante();
    });

    document.getElementById('btnBackOcupantes').addEventListener('click', () => {
      this.step = 'creacion-especialidades';
      this.render();
    });

    document.getElementById('btnGuardarTodo').addEventListener('click', () => {
      this.saveConfiguration();
    });
  }

  addOcupante() {
    this.ocupantes.push({
      nombre: '',
      especialidad: '',
      isEditing: true
    });
    this.renderOcupantesOnly();
  }

  confirmOcupante(index) {
    if (!this.ocupantes[index].nombre.trim() || !this.ocupantes[index].especialidad) return;
    this.ocupantes[index].isEditing = false;
    this.renderOcupantesOnly();
  }

  cancelOcupante(index) {
    if (!this.ocupantes[index].nombre) {
      this.ocupantes.splice(index, 1);
    } else {
      this.ocupantes[index].isEditing = false;
    }
    this.renderOcupantesOnly();
  }

  editOcupante(index) {
    this.ocupantes[index].isEditing = true;
    this.renderOcupantesOnly();
  }

  deleteOcupante(index) {
    this.ocupantes.splice(index, 1);
    this.renderOcupantesOnly();
  }

  updateOcupanteInput(index, field, value) {
    this.ocupantes[index][field] = value;
    const btn = document.querySelector(`button[data-action="confirm-ocupante"][data-ocupante-index="${index}"]`);
    if (btn) {
      btn.disabled = !this.ocupantes[index].nombre.trim() || !this.ocupantes[index].especialidad;
    }
  }

  renderOcupantesOnly() {
    const ocupantesList = document.getElementById('ocupantes-list');
    if (ocupantesList) {
      ocupantesList.innerHTML = this.renderOcupantes();
    }
  }

  async saveConfiguration() {
    // Validación previa
    console.log('🔍 Validando antes de guardar...');
    console.log('  - grupoSeleccionado:', this.grupoSeleccionado);
    console.log('  - espacios:', this.spaces.length);
    console.log('  - especialidades:', this.especialidades.length);
    console.log('  - ocupantes:', this.ocupantes.length);
    console.log('  - tipos de instrumentos:', this.tiposInstrumentos.length);
    console.log('  - instrumentos:', this.instrumentos.length);
    
    if (!this.grupoSeleccionado) {
      console.error('❌ No hay grupo seleccionado');
      this.showErrorMessage('No hay un grupo seleccionado');
      return;
    }

    if (this.spaces.length === 0) {
      console.error('❌ No hay espacios creados');
      this.showErrorMessage('Debes crear al menos un espacio antes de guardar');
      return;
    }

    // Filtrar ocupantes confirmados
    const ocupantesConfirmados = this.ocupantes.filter(o => !o.isEditing && o.nombre.trim() && o.especialidad);

    this.isLoading = true;
    this.render();

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
        especialidad: o.especialidad,
        tipo: this.occupantName
      })),
      tipos_instrumentos: this.tiposInstrumentos.map(tipo => ({
        id: tipo.id,  // Incluir el ID temporal para mapeo en el backend
        nombre: tipo.nombre
      })),
      instrumentos: this.instrumentos.map(inst => ({
        nombre: inst.nombre,
        tipo_id: inst.tipo_id  // Mantener referencia al ID temporal del tipo
      }))
    };

    console.log('💾 Guardando configuración completa...', payload);
    console.log('📊 Total espacios:', payload.espacios.length);
    console.log('📊 Total específicos:', payload.espacios.reduce((acc, e) => acc + e.specificSpaces.length, 0));
    console.log('📊 Total especialidades:', payload.especialidades.length);
    console.log('📊 Total ocupantes:', payload.ocupantes.length);
    console.log('📊 Total tipos de instrumentos:', payload.tipos_instrumentos.length);
    console.log('📊 Total instrumentos:', payload.instrumentos.length);

    try {
      console.log('🌐 Enviando petición a /api/espacios/configuracion...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch('/onboarding-espacios/api/espacios/configuracion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      console.log('📥 Respuesta recibida, status:', response.status);

      let data;
      try {
        data = await response.json();
        console.log('📦 Data parseada:', data);
      } catch (parseError) {
        console.error('❌ Error parseando respuesta:', parseError);
        throw new Error('Error de comunicación con el servidor');
      }

      if (response.ok && data.ok) {
        console.log('✅ Configuración guardada exitosamente:', data);
        this.showSuccessMessage(data);
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 2000);
      } else {
        console.error('❌ Respuesta no OK:', { status: response.status, ok: data.ok, error: data.error });
        throw new Error(data.error || `Error al guardar la configuración (${response.status})`);
      }
    } catch (error) {
      console.error('❌ Error en saveConfiguration:', error.message);
      console.error('❌ Stack:', error.stack);
      this.isLoading = false;
      
      // Manejar diferentes tipos de errores
      let errorMessage = error.message;
      if (error.name === 'AbortError') {
        errorMessage = 'La operación tardó demasiado tiempo. Por favor, intenta nuevamente.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Error de conexión. Verifica tu conexión a internet e intenta nuevamente.';
      }
      
      this.showErrorMessage(errorMessage);
      this.render();
    }
  }

  showSuccessMessage(data) {
    const totalGenerales = data.total_generales;
    const totalEspecificos = data.total_especificos;
    const totalOcupantes = data.total_ocupantes || 0;

    const message = `
      <div class="success-message">
        <i class="fas fa-check-circle"></i>
        <h3>¡Configuración guardada exitosamente!</h3>
        <p>Se han creado ${totalGenerales} ${this.generalSpaceName.toLowerCase()}(s) 
        con ${totalEspecificos} ${this.specificSpaceName.toLowerCase()}(s)
        ${totalOcupantes > 0 ? ` y ${totalOcupantes} ${this.occupantName.toLowerCase()}(s)` : ''}</p>
        <p class="redirect-info">Redirigiendo al dashboard...</p>
      </div>
    `;
    
    this.root.innerHTML = message;
  }

  showNotification(message, type = 'success') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification-toast ${type}`;
    notificationDiv.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
      <span>${message}</span>
      <button class="close-notification">&times;</button>
    `;
    
    document.body.appendChild(notificationDiv);
    
    notificationDiv.querySelector('.close-notification').addEventListener('click', () => {
      notificationDiv.remove();
    });
    
    setTimeout(() => {
      notificationDiv.remove();
    }, 3000);
  }

  showErrorMessage(errorMsg) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <span>${errorMsg}</span>
      <button class="close-error">&times;</button>
    `;
    
    document.body.appendChild(errorDiv);
    
    errorDiv.querySelector('.close-error').addEventListener('click', () => {
      errorDiv.remove();
    });
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.onboardingApp = new OnboardingEspacios();
});