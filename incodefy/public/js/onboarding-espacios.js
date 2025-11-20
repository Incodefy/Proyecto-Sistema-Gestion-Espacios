// public/js/onboarding-espacios.js

class OnboardingEspacios {
  constructor() {
    this.step = 'loading'; // loading, seleccion-grupo, creacion-nomenclatura, creacion-espacios
    this.generalSpaceName = '';
    this.specificSpaceName = '';
    this.spaces = [];
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
      const response = await fetch('/api/espacios/grupos-usuario', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.gruposDisponibles = data.grupos || [];
        console.log('📋 Grupos disponibles:', this.gruposDisponibles);
      }
    } catch (error) {
      console.log('ℹ️ Error cargando grupos (esto es normal si no hay grupos)', error);
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

      const response = await fetch('/api/grupos', {
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
      // 🔥 Obtener información real del grupo
      const response = await fetch(`/api/grupos/${grupoId}`);
      const data = await response.json();

      if (!data.ok || !data.group) {
        throw new Error("No se pudo obtener la información del grupo");
      }

      const grupo = data.group;
      this.grupoSeleccionado = grupoId;

      // 📌 Lógica de flujo
      if (grupo.configured === true) {
        return window.location.href = "/dashboard";
      }

      if (!grupo.nomenclatura) {
        this.step = "creacion-nomenclatura";
        return this.render();
      }

      this.generalSpaceName = grupo.nomenclatura.general;
      this.specificSpaceName = grupo.nomenclatura.especifico;

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

    btnContinue.addEventListener('click', () => {
      if (this.generalSpaceName.trim() && this.specificSpaceName.trim()) {
        console.log('✅ Nombres definidos:', {
          general: this.generalSpaceName,
          especifico: this.specificSpaceName
        });
        this.step = 'creacion-espacios';
        this.render();
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
              ${this.isLoading ? 'Guardando...' : 'Guardar Configuración'}
              ${!this.isLoading ? '<i class="fas fa-check"></i>' : ''}
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
      this.saveConfiguration();
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

  async saveConfiguration() {
    this.isLoading = true;
    this.render();

    const payload = {
      grupo_id: this.grupoSeleccionado,
      nomenclatura: {
        general: this.generalSpaceName,
        especifico: this.specificSpaceName
      },
      espacios: this.spaces.map(space => ({
        name: space.name,
        specificSpaces: space.specificSpaces.map(spec => ({
          name: spec.name
        }))
      }))
    };

    console.log('💾 Guardando configuración...', payload);
    console.log('📊 Total espacios:', payload.espacios.length);
    console.log('📊 Total específicos:', payload.espacios.reduce((acc, e) => acc + e.specificSpaces.length, 0));

    try {
      console.log('🌐 Enviando petición a /api/espacios/configuracion...');
      const response = await fetch('/api/espacios/configuracion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('📥 Respuesta recibida, status:', response.status);
      console.log('📥 Response ok:', response.ok);

      const data = await response.json();
      console.log('📦 Data parseada:', data);

      if (response.ok && data.ok) {
        console.log('✅ Configuración guardada exitosamente:', data);
        
        // Mostrar mensaje de éxito
        this.showSuccessMessage(data);
        
        // Redirigir después de 2 segundos
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        console.error('❌ Respuesta no OK:', { ok: data.ok, error: data.error });
        throw new Error(data.error || 'Error al guardar la configuración');
      }
    } catch (error) {
      console.error('❌ Error en saveConfiguration:', error.message);
      console.error('❌ Stack:', error.stack);
      this.isLoading = false;
      this.showErrorMessage(error.message);
      this.render();
    }
  }

  showSuccessMessage(data) {
    const totalGenerales = data.total_generales ?? data.data?.espacios_creados?.generales;
    const totalEspecificos = data.total_especificos ?? data.data?.espacios_creados?.especificos;

    const message = `
      <div class="success-message">
        <i class="fas fa-check-circle"></i>
        <h3>¡Configuración guardada exitosamente!</h3>
        <p>Se han creado ${totalGenerales} ${this.generalSpaceName.toLowerCase()}(s) 
        con ${totalEspecificos} ${this.specificSpaceName.toLowerCase()}(s)</p>
        <p class="redirect-info">Redirigiendo al dashboard...</p>
      </div>
    `;
    
    this.root.innerHTML = message;
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
  new OnboardingEspacios();
});