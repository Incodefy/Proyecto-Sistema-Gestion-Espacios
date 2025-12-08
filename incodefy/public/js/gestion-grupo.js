// public/js/gestion-grupo.js

// ============= MODAL MANAGER =============
class ModalManager {
  constructor() {
    this.createModalContainer();
  }

  createModalContainer() {
    if (!document.getElementById('modal-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
  }

  async confirm(options) {
    const {
      title = '¿Confirmar acción?',
      message = '¿Estás seguro de continuar?',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      type = 'danger' // 'danger', 'warning', 'info'
    } = options;

    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      
      const modal = document.createElement('div');
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      
      const iconMap = {
        danger: 'fa-exclamation-triangle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
      };
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header ${type}">
              <h5 class="modal-title ${type === 'danger' ? 'text-danger' : ''}">
                <i class="fas ${iconMap[type]}"></i>
                ${title}
              </h5>
              <button type="button" class="btn-close" data-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p>${message}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary cancel-btn">
                <i class="fas fa-times"></i>
                ${cancelText}
              </button>
              <button type="button" class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} confirm-btn">
                <i class="fas fa-check"></i>
                ${confirmText}
              </button>
            </div>
          </div>
        </div>
      `;

      const handleClose = (confirmed) => {
        modal.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => {
          modal.remove();
          overlay.innerHTML = '';
        }, 200);
        resolve(confirmed);
      };

      modal.querySelector('.btn-close').addEventListener('click', () => handleClose(false));
      modal.querySelector('.cancel-btn').addEventListener('click', () => handleClose(false));
      modal.querySelector('.confirm-btn').addEventListener('click', () => handleClose(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose(false);
      });

      overlay.appendChild(modal);
      overlay.classList.add('show');
      setTimeout(() => modal.classList.add('show'), 10);
    });
  }

  async prompt(options) {
    const {
      title = 'Ingrese un valor',
      message = '',
      placeholder = '',
      defaultValue = '',
      confirmText = 'Guardar',
      cancelText = 'Cancelar',
      inputType = 'text',
      required = true
    } = options;

    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      
      const modal = document.createElement('div');
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-edit"></i>
                ${title}
              </h5>
              <button type="button" class="btn-close" data-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${message ? `<p class="modal-message">${message}</p>` : ''}
              <div class="form-group">
                <input 
                  type="${inputType}" 
                  class="form-input modal-input" 
                  placeholder="${placeholder}"
                  value="${defaultValue}"
                  ${required ? 'required' : ''}
                />
                <span class="input-error" style="display: none;">
                  <i class="fas fa-exclamation-circle"></i>
                  Este campo es requerido
                </span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary cancel-btn">
                <i class="fas fa-times"></i>
                ${cancelText}
              </button>
              <button type="button" class="btn btn-primary confirm-btn">
                <i class="fas fa-save"></i>
                ${confirmText}
              </button>
            </div>
          </div>
        </div>
      `;

      const input = modal.querySelector('.modal-input');
      const errorSpan = modal.querySelector('.input-error');
      
      const handleClose = (value) => {
        modal.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => {
          modal.remove();
          overlay.innerHTML = '';
        }, 200);
        resolve(value);
      };

      const handleConfirm = () => {
        const value = input.value.trim();
        if (required && !value) {
          errorSpan.style.display = 'flex';
          input.classList.add('error');
          return;
        }
        handleClose(value);
      };

      input.addEventListener('input', () => {
        errorSpan.style.display = 'none';
        input.classList.remove('error');
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleConfirm();
      });

      modal.querySelector('.btn-close').addEventListener('click', () => handleClose(null));
      modal.querySelector('.cancel-btn').addEventListener('click', () => handleClose(null));
      modal.querySelector('.confirm-btn').addEventListener('click', handleConfirm);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose(null);
      });

      overlay.appendChild(modal);
      overlay.classList.add('show');
      setTimeout(() => {
        modal.classList.add('show');
        input.focus();
      }, 10);
    });
  }

  async editOcupante(options) {
    const {
      title = 'Editar Ocupante',
      nombreActual = '',
      especialidadActual = '',
      especialidades = [],
      nombreLabel = 'Nombre',
      especialidadLabel = 'Especialidad',
      confirmText = 'Actualizar',
      cancelText = 'Cancelar'
    } = options;

    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-overlay');
      
      const modal = document.createElement('div');
      modal.className = 'modal fade show';
      modal.style.display = 'block';
      
      const especialidadesOptions = especialidades.map(esp => 
        `<option value="${esp.id}" ${esp.id === especialidadActual ? 'selected' : ''}>${esp.nombre}</option>`
      ).join('');
      
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-user-edit"></i>
                ${title}
              </h5>
              <button type="button" class="btn-close" data-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">
                  <i class="fas fa-user"></i>
                  ${nombreLabel}
                </label>
                <input 
                  type="text" 
                  class="form-input" 
                  id="modal-ocupante-nombre"
                  placeholder="Ingrese el nombre completo"
                  value="${nombreActual}"
                  required
                />
                <span class="input-error" id="error-nombre" style="display: none;">
                  <i class="fas fa-exclamation-circle"></i>
                  Este campo es requerido
                </span>
              </div>
              
              <div class="form-group">
                <label class="form-label">
                  <i class="fas fa-briefcase"></i>
                  ${especialidadLabel}
                </label>
                <select class="form-select" id="modal-ocupante-especialidad" required>
                  <option value="">Seleccione una especialidad</option>
                  ${especialidadesOptions}
                </select>
                <span class="input-error" id="error-especialidad" style="display: none;">
                  <i class="fas fa-exclamation-circle"></i>
                  Debe seleccionar una especialidad
                </span>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary cancel-btn">
                <i class="fas fa-times"></i>
                ${cancelText}
              </button>
              <button type="button" class="btn btn-primary confirm-btn">
                <i class="fas fa-check-circle"></i>
                ${confirmText}
              </button>
            </div>
          </div>
        </div>
      `;

      const nombreInput = modal.querySelector('#modal-ocupante-nombre');
      const especialidadSelect = modal.querySelector('#modal-ocupante-especialidad');
      const errorNombre = modal.querySelector('#error-nombre');
      const errorEspecialidad = modal.querySelector('#error-especialidad');
      
      const handleClose = (result) => {
        modal.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => {
          modal.remove();
          overlay.innerHTML = '';
        }, 200);
        resolve(result);
      };

      const handleConfirm = () => {
        const nombre = nombreInput.value.trim();
        const especialidadId = especialidadSelect.value;
        
        let hasError = false;
        
        if (!nombre) {
          errorNombre.style.display = 'flex';
          nombreInput.classList.add('error');
          hasError = true;
        }
        
        if (!especialidadId) {
          errorEspecialidad.style.display = 'flex';
          especialidadSelect.classList.add('error');
          hasError = true;
        }
        
        if (hasError) return;
        
        handleClose({ nombre, especialidadId });
      };

      nombreInput.addEventListener('input', () => {
        errorNombre.style.display = 'none';
        nombreInput.classList.remove('error');
      });

      especialidadSelect.addEventListener('change', () => {
        errorEspecialidad.style.display = 'none';
        especialidadSelect.classList.remove('error');
      });

      nombreInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleConfirm();
      });

      modal.querySelector('.btn-close').addEventListener('click', () => handleClose(null));
      modal.querySelector('.cancel-btn').addEventListener('click', () => handleClose(null));
      modal.querySelector('.confirm-btn').addEventListener('click', handleConfirm);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose(null);
      });

      overlay.appendChild(modal);
      overlay.classList.add('show');
      setTimeout(() => {
        modal.classList.add('show');
        nombreInput.focus();
      }, 10);
    });
  }
}

// ============= GESTION GRUPO =============
class GestionGrupo {
  constructor() {
    this.grupoId = null;
    this.currentUserSub = window.currentUserSub || null;
    this.currentUserEmail = window.currentUserEmail || null;
    this.currentUserRole = null; // Se obtiene al cargar miembros
    this.modalManager = new ModalManager();
    this.nomenclatura = {
      general: '',
      especifico: '',
      ocupante: '',
      especialidad: '',
      instrumento: ''
    };
    this.espacios = [];
    this.miembros = [];
    this.especialidades = [];
    this.ocupantes = [];
    this.tiposInstrumentos = [];
    this.instrumentos = [];
    this.tipoSeleccionado = null;
    this.especialidadSeleccionada = null; // Para el diseño master-detail de recursos médicos
    this.editingId = null;
    this.editingValue = '';
    
    // Para los modales
    this.currentMemberToEdit = null;
    this.selectedNewRole = null;
    this.currentMemberToRemove = null;
    
    this.init();
  }

  async init() {
    console.log('🚀 Iniciando Gestión de Grupo');
    
    // Restaurar tab desde URL ANTES de cargar datos
    this.restoreTabFromURL();
    
    // Cargar grupo activo y nomenclatura primero (necesarios para las siguientes llamadas)
    await this.cargarGrupoActivo();
    await this.cargarNomenclatura();
    
    // Cargar todos los datos restantes en paralelo para mejorar el rendimiento
    await Promise.all([
      this.cargarEspacios(),
      this.cargarEspecialidades(),
      this.cargarOcupantes(),
      this.cargarTiposInstrumentos(),
      this.cargarInstrumentos(),
      this.cargarMiembros()
    ]);
    
    // Inicializar event listeners
    this.initEventListeners();
    this.initRoleChangeModal();
    this.initRemoveMemberModal();
    
    // Renderizar todo
    this.render();
  }

  async cargarGrupoActivo() {
    try {
      // Primero intentar usar los datos pasados desde el backend
      if (window.grupoActivo) {
        this.grupoId = window.grupoActivo.grupo_id;
        document.getElementById('grupoNombre').textContent = window.grupoActivo.nombre || 'Grupo sin nombre';
        console.log('✅ Grupo activo cargado desde backend:', this.grupoId);
        return;
      }
      
      // Si no hay datos del backend, hacer request
      const response = await fetch('/api/espacios/grupo-activo');
      const data = await response.json();
      
      if (data.ok && data.grupo_activo) {
        this.grupoId = data.grupo_activo.grupo_id;
        document.getElementById('grupoNombre').textContent = data.grupo_activo.nombre || 'Grupo sin nombre';
        console.log('✅ Grupo activo cargado:', this.grupoId);
      } else {
        throw new Error('No se encontró grupo activo');
      }
    } catch (error) {
      console.error('❌ Error cargando grupo activo:', error);
      this.showNotification('No tienes un grupo activo. Configura uno primero.', 'error');
    }
  }

  async cargarNomenclatura() {
    if (!this.grupoId) return;
    
    try {
      // ⭐ ESTRATEGIA HÍBRIDA: Usar valores iniciales del servidor para carga instantánea
      // y hacer petición en background para verificar actualizaciones
      
      // 1. Cargar valores iniciales inmediatamente (si existen)
      if (window.nomenclaturaInicial) {
        this.nomenclatura = window.nomenclaturaInicial;
        console.log('⚡ Nomenclatura inicial cargada (instantáneo):', this.nomenclatura);
        
        // Actualizar UI inmediatamente con valores iniciales
        this.updateInputsFromNomenclatura();
        this.updateDynamicTexts();
      }
      
      // 2. Hacer petición en paralelo para verificar si hay actualizaciones
      // (solo si la página se cargó hace más de 5 segundos o no hay valores iniciales)
      const pageLoadTime = window.pageLoadTimestamp || Date.now();
      const timeSinceLoad = Date.now() - pageLoadTime;
      
      if (!window.nomenclaturaInicial || timeSinceLoad > 5000) {
        console.log('🔍 Verificando actualizaciones de nomenclatura...');
        
        const response = await fetch(`/grupos/${this.grupoId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.ok && data.group?.nomenclatura) {
            // Solo actualizar si los valores cambiaron
            const hasChanged = JSON.stringify(this.nomenclatura) !== JSON.stringify(data.group.nomenclatura);
            
            if (hasChanged) {
              this.nomenclatura = data.group.nomenclatura;
              console.log('✅ Nomenclatura actualizada desde API:', this.nomenclatura);
              
              // Actualizar UI con nuevos valores
              this.updateInputsFromNomenclatura();
              this.updateDynamicTexts();
            } else {
              console.log('✅ Nomenclatura está actualizada (sin cambios)');
            }
          }
        }
      } else {
        console.log('⚡ Usando valores iniciales (página recién cargada)');
      }
      
      // Si no hay valores iniciales ni de API, usar defaults
      if (!this.nomenclatura) {
        this.nomenclatura = { general: 'Pasillo', especifico: 'Box', ocupante: 'Médico', especialidad: 'Especialidad' };
        console.log('⚠️ Usando nomenclatura por defecto');
        this.updateInputsFromNomenclatura();
        this.updateDynamicTexts();
      }
    } catch (error) {
      console.error('❌ Error cargando nomenclatura:', error);
      // Usar valores por defecto en caso de error
      this.nomenclatura = { general: 'Pasillo', especifico: 'Box', ocupante: 'Médico', especialidad: 'Especialidad' };
      this.updateInputsFromNomenclatura();
      this.updateDynamicTexts();
    }
  }

  // Método auxiliar para actualizar inputs desde nomenclatura (evita duplicación de código)
  updateInputsFromNomenclatura() {
    if (!this.nomenclatura) return;
    
    const inputs = {
      nombreGeneral: this.nomenclatura.general || '',
      nombreEspecifico: this.nomenclatura.especifico || '',
      nombreOcupante: this.nomenclatura.ocupante || '',
      nombreEspecialidad: this.nomenclatura.especialidad || ''
    };
    
    Object.entries(inputs).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.value = value;
    });
  }

  async cargarEspacios() {
    if (!this.grupoId) {
      console.log('⚠️ No hay grupo_id, no se pueden cargar espacios');
      this.espacios = [];
      this.renderEspacios();
      return;
    }
    
    try {
      const response = await fetch(`/api/espacios/lista?grupo_id=${this.grupoId}`);
      const data = await response.json();
      
      if (data.ok && data.espacios && Array.isArray(data.espacios)) {
        // Los espacios ya vienen organizados jerárquicamente desde Lambda
        this.espacios = data.espacios.map(general => ({
          id: general.SK, // SPACE#1
          name: general.nombre,
          isEditing: false,
          specificSpaces: (general.specificSpaces || []).map(spec => ({
            id: spec.SK, // SUBSPACE#1
            name: spec.nombre,
            isEditing: false
          }))
        }));
        
        console.log('✅ Espacios cargados:', this.espacios.length);
        console.log('📊 Estructura:', JSON.stringify(this.espacios, null, 2));
      } else {
        console.log('⚠️ No hay espacios configurados');
        this.espacios = [];
      }
      this.renderEspacios();
    } catch (error) {
      console.error('❌ Error cargando espacios:', error);
      this.espacios = [];
      this.renderEspacios();
    }
  }

  async cargarMiembros() {
    if (!this.grupoId) {
      console.log('⚠️ No hay grupo_id, no se pueden cargar miembros');
      this.miembros = [];
      this.renderMiembros();
      return;
    }
    
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/miembros`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      
      if (data.ok && data.miembros && Array.isArray(data.miembros)) {
        this.miembros = data.miembros;
        console.log('✅ Miembros cargados:', this.miembros.length);
        
        // Detectar el rol del usuario actual
        const currentMember = this.miembros.find(m => 
          (m.user_sub === this.currentUserSub) || 
          (m.email === this.currentUserEmail) ||
          (m.user_email === this.currentUserEmail)
        );
        
        if (currentMember) {
          this.currentUserRole = currentMember.role || currentMember.rol;
          console.log('👤 Rol del usuario actual:', this.currentUserRole);
        }
      } else {
        console.log('⚠️ No hay miembros o endpoint no disponible');
        this.miembros = [];
      }
      
      // Ajustar opciones de invitación según el rol del usuario
      this.ajustarOpcionesInvitacion();
      
      this.renderMiembros();
    } catch (error) {
      console.error('❌ Error cargando miembros:', error);
      // En caso de error, mostrar lista vacía
      this.miembros = [];
      this.renderMiembros();
    }
  }

  ajustarOpcionesInvitacion() {
    const inviteRoleSelect = document.getElementById('inviteRole');
    if (!inviteRoleSelect) return;

    // Si es admin, remover la opción de administrador
    if (this.currentUserRole === 'admin') {
      const adminOption = inviteRoleSelect.querySelector('option[value="admin"]');
      if (adminOption) {
        adminOption.remove();
      }
      console.log('🔒 Admin: Solo puede invitar como writer o reader');
    }
  }

  async cargarEspecialidades() {
    if (!this.grupoId) {
      console.log('⚠️ No hay grupo_id, no se pueden cargar especialidades');
      this.especialidades = [];
      return;
    }
    
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/especialidades`);
      const data = await response.json();
      
      if (data.ok && data.especialidades && Array.isArray(data.especialidades)) {
        this.especialidades = data.especialidades;
        console.log('✅ Especialidades cargadas:', this.especialidades.length);
      } else {
        console.log('⚠️ No hay especialidades');
        this.especialidades = [];
      }
    } catch (error) {
      console.error('❌ Error cargando especialidades:', error);
      this.especialidades = [];
    }
  }

  async cargarOcupantes() {
    if (!this.grupoId) {
      console.log('⚠️ No hay grupo_id, no se pueden cargar ocupantes');
      this.ocupantes = [];
      return;
    }
    
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/ocupantes`);
      const data = await response.json();
      
      if (data.ok && data.ocupantes && Array.isArray(data.ocupantes)) {
        this.ocupantes = data.ocupantes;
        console.log('✅ Ocupantes cargados:', this.ocupantes.length);
      } else {
        console.log('⚠️ No hay ocupantes');
        this.ocupantes = [];
      }
    } catch (error) {
      console.error('❌ Error cargando ocupantes:', error);
      this.ocupantes = [];
    }
  }

  initEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        this.switchTab(tabName);
        // Actualizar URL con hash
        window.location.hash = tabName;
      });
    });

    // Escuchar cambios en el hash (botón atrás/adelante del navegador)
    window.addEventListener('hashchange', () => {
      this.restoreTabFromURL();
    });

    // Nomenclatura
    document.getElementById('btnGuardarNomenclatura').addEventListener('click', () => {
      this.guardarNomenclatura();
    });

    // Espacios - delegación de eventos
    const espaciosList = document.getElementById('espaciosList');
    espaciosList.addEventListener('click', (e) => this.handleEspaciosClick(e));
    espaciosList.addEventListener('input', (e) => this.handleEspaciosInput(e));
    espaciosList.addEventListener('keydown', (e) => this.handleEspaciosKeydown(e));
    
    document.getElementById('btnAddGeneral').addEventListener('click', () => {
      this.addGeneralSpace();
    });

    // Miembros
    document.getElementById('btnInviteMember').addEventListener('click', () => {
      this.invitarMiembro();
    });

    // Miembros - delegación de eventos para la tabla
    const membersTableContainer = document.getElementById('membersTableContainer');
    membersTableContainer.addEventListener('click', (e) => this.handleMembersClick(e));
  }

  // ============= MODALES =============

  initRoleChangeModal() {
    const modal = document.getElementById('changeRoleModal');
    if (!modal) {
      console.warn('⚠️ Modal changeRoleModal no encontrado');
      return;
    }

    const roleOptions = modal.querySelectorAll('.role-option');
    const btnConfirm = document.getElementById('btnConfirmRoleChange');

    // Seleccionar rol
    roleOptions.forEach(option => {
      option.addEventListener('click', () => {
        // Remover selección previa
        roleOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Agregar selección actual
        option.classList.add('selected');
        this.selectedNewRole = option.dataset.role;
        
        // Habilitar botón solo si es diferente al rol actual (buscar tanto 'role' como 'rol')
        const rolActual = this.currentMemberToEdit?.role || this.currentMemberToEdit?.rol;
        if (this.currentMemberToEdit && this.selectedNewRole !== rolActual) {
          btnConfirm.disabled = false;
        } else {
          btnConfirm.disabled = true;
        }
      });
    });

    // Confirmar cambio de rol
    btnConfirm.addEventListener('click', async () => {
      await this.confirmarCambioRol();
    });

    // Resetear modal al cerrar
    modal.addEventListener('hidden.bs.modal', () => {
      roleOptions.forEach(opt => opt.classList.remove('selected'));
      this.selectedNewRole = null;
      this.currentMemberToEdit = null;
      btnConfirm.disabled = true;
    });
  }

  initRemoveMemberModal() {
    const modal = document.getElementById('removeMemberModal');
    if (!modal) {
      console.warn('⚠️ Modal removeMemberModal no encontrado');
      return;
    }

    const btnConfirm = document.getElementById('btnConfirmRemove');

    btnConfirm.addEventListener('click', async () => {
      await this.confirmarRemoverMiembro();
    });

    // Resetear modal al cerrar
    modal.addEventListener('hidden.bs.modal', () => {
      this.currentMemberToRemove = null;
    });
  }

  openChangeRoleModal(miembro) {
    this.currentMemberToEdit = miembro;
    
    const modal = document.getElementById('changeRoleModal');
    const avatar = document.getElementById('modalMemberAvatar');
    const name = document.getElementById('modalMemberName');
    const email = document.getElementById('modalMemberEmail');
    
    // Obtener datos del miembro
    const nombreMiembro = miembro.user_name || miembro.nombre || miembro.user_email || miembro.email;
    const emailMiembro = miembro.user_email || miembro.email || '';
    const iniciales = this.getInitials(nombreMiembro);
    
    // Llenar información del miembro
    avatar.textContent = iniciales;
    name.textContent = nombreMiembro;
    email.textContent = emailMiembro;
    
    // Obtener opciones de roles y filtrar según permisos
    const roleOptions = modal.querySelectorAll('.role-option');
    roleOptions.forEach(option => {
      const optionRole = option.dataset.role;
      
      // Determinar si la opción debe estar deshabilitada
      let disabled = false;
      
      // Owner nunca se puede asignar desde el modal
      if (optionRole === 'owner') {
        disabled = true;
      }
      // Si el usuario actual es admin, solo puede asignar writer/reader
      else if (this.currentUserRole === 'admin' && optionRole === 'admin') {
        disabled = true;
      }
      
      // Aplicar estado disabled
      if (disabled) {
        option.classList.add('disabled');
        option.style.opacity = '0.5';
        option.style.cursor = 'not-allowed';
        option.style.pointerEvents = 'none';
      } else {
        option.classList.remove('disabled');
        option.style.opacity = '1';
        option.style.cursor = 'pointer';
        option.style.pointerEvents = 'auto';
      }
      
      // Pre-seleccionar el rol actual (buscar tanto 'role' como 'rol')
      const rolActual = miembro.role || miembro.rol;
      if (optionRole === rolActual) {
        option.classList.add('selected');
        this.selectedNewRole = rolActual;
      } else {
        option.classList.remove('selected');
      }
    });
    
    // Deshabilitar botón hasta que se seleccione un rol diferente
    document.getElementById('btnConfirmRoleChange').disabled = true;
    
    // Mostrar modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  async confirmarCambioRol() {
    if (!this.currentMemberToEdit || !this.selectedNewRole) return;

    const modal = document.getElementById('changeRoleModal');
    const btnConfirm = document.getElementById('btnConfirmRoleChange');

    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
      const memberId = this.currentMemberToEdit.user_sub || this.currentMemberToEdit.id;
      
      const response = await fetch(`/api/grupos/miembro/${memberId}/rol`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rol: this.selectedNewRole,
          grupo_id: this.grupoId
        })
      });

      const data = await response.json();

      if (data.ok) {
        // Cerrar modal
        const bsModal = bootstrap.Modal.getInstance(modal);
        bsModal.hide();

        // Mostrar mensaje de éxito
        this.showNotification('Rol actualizado correctamente', 'success');

        // Recargar lista de miembros
        await this.cargarMiembros();
      } else {
        this.showNotification(data.error || 'Error al actualizar el rol', 'error');
      }
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      this.showNotification('Error al actualizar el rol', 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
    }
  }

  openRemoveMemberModal(miembro) {
    this.currentMemberToRemove = miembro;
    
    const modal = document.getElementById('removeMemberModal');
    const avatar = document.getElementById('modalRemoveMemberAvatar');
    const name = document.getElementById('modalRemoveMemberName');
    const email = document.getElementById('modalRemoveMemberEmail');
    
    // Obtener datos del miembro
    const nombreMiembro = miembro.user_name || miembro.nombre || miembro.user_email || miembro.email;
    const emailMiembro = miembro.user_email || miembro.email || '';
    const iniciales = this.getInitials(nombreMiembro);
    
    // Llenar información del miembro
    avatar.textContent = iniciales;
    name.textContent = nombreMiembro;
    email.textContent = emailMiembro;
    
    // Mostrar modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
  }

  async confirmarRemoverMiembro() {
    if (!this.currentMemberToRemove) return;

    const modal = document.getElementById('removeMemberModal');
    const btnConfirm = document.getElementById('btnConfirmRemove');

    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removiendo...';

    try {
      const memberId = this.currentMemberToRemove.user_sub || this.currentMemberToRemove.id;
      
      const response = await fetch(
        `/api/grupos/miembro/${memberId}?grupo_id=${this.grupoId}`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json();

      if (data.ok) {
        // Cerrar modal
        const bsModal = bootstrap.Modal.getInstance(modal);
        bsModal.hide();

        // Mostrar mensaje de éxito
        this.showNotification('Miembro removido correctamente', 'success');

        // Recargar lista de miembros
        await this.cargarMiembros();
      } else {
        this.showNotification(data.error || 'Error al remover el miembro', 'error');
      }
    } catch (error) {
      console.error('Error al remover miembro:', error);
      this.showNotification('Error al remover el miembro', 'error');
    } finally {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<i class="fas fa-trash"></i> Remover Miembro';
    }
  }

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // ============= TABS Y NAVEGACIÓN =============

  switchTab(tabName) {
    // Actualizar botones
    document.querySelectorAll('.tab-button').forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });
    
    // Actualizar contenido - usar hidden attribute en lugar de clases
    document.querySelectorAll('.tab-content').forEach(content => {
      const isActive = content.id === `tab-${tabName}`;
      if (isActive) {
        content.removeAttribute('hidden');
        content.classList.add('active');
      } else {
        content.setAttribute('hidden', '');
        content.classList.remove('active');
      }
    });
  }

  restoreTabFromURL() {
    // Obtener hash de la URL (sin el #)
    let hash = window.location.hash.slice(1);
    
    // Lista de tabs válidos
    const validTabs = ['nomenclatura', 'espacios', 'recursos-medicos', 'instrumentos', 'miembros'];
    
    // Si el hash no es válido o está vacío, usar 'nomenclatura' por defecto
    if (!hash || !validTabs.includes(hash)) {
      hash = 'nomenclatura';
      // Actualizar la URL sin recargar la página
      window.history.replaceState(null, '', `#${hash}`);
    }
    
    // Cambiar al tab correspondiente
    this.switchTab(hash);
  }

  // Función auxiliar para pluralizar palabras en español
  pluralize(word) {
    if (!word) return '';
    
    const lowerWord = word.toLowerCase();
    
    // Si termina en vocal (a, e, i, o, u), agregar 's'
    if (/[aeiouáéíóú]$/i.test(lowerWord)) {
      return word + 's';
    }
    
    // Si termina en consonante, agregar 'es'
    return word + 'es';
  }

  updateDynamicTexts() {
    const general = this.nomenclatura.general.toLowerCase() || 'espacio';
    const especifico = this.nomenclatura.especifico.toLowerCase() || 'sub-espacio';
    const especialidad = this.nomenclatura.especialidad || 'Especialidad';
    const ocupante = this.nomenclatura.ocupante || 'Ocupante';
    
    // Actualizar textos de espacios
    document.getElementById('espaciosDescription').textContent = 
      `Agrega, edita o elimina ${this.pluralize(general)} y ${this.pluralize(especifico)} de tu grupo`;
    
    document.getElementById('btnAddGeneralText').textContent = 
      `Agregar nuevo ${general}`;
    
    // Actualizar textos de especialidades
    const especialidadTitle = document.getElementById('especialidades-title');
    if (especialidadTitle) {
      especialidadTitle.textContent = this.pluralize(especialidad);
    }
    
    const especialidadSubtitle = document.getElementById('especialidades-subtitle');
    if (especialidadSubtitle) {
      especialidadSubtitle.textContent = `Categorías de ${this.pluralize(especialidad.toLowerCase())}`;
    }
    
    const nuevaEspecialidadInput = document.getElementById('nuevaEspecialidadNombre');
    if (nuevaEspecialidadInput) {
      nuevaEspecialidadInput.placeholder = `Nombre de ${especialidad.toLowerCase()}`;
    }
    
    const btnAgregarEspecialidad = document.getElementById('btnAgregarEspecialidadText');
    if (btnAgregarEspecialidad) {
      btnAgregarEspecialidad.textContent = 'Agregar';
    }
    
    // Actualizar textos de ocupantes
    const ocupantesTitle = document.getElementById('ocupantes-title');
    if (ocupantesTitle) {
      ocupantesTitle.textContent = this.pluralize(ocupante);
    }
  }

  // ============= NOMENCLATURA =============
  
  async guardarNomenclatura() {
    const general = document.getElementById('nombreGeneral').value.trim();
    const especifico = document.getElementById('nombreEspecifico').value.trim();
    const ocupante = document.getElementById('nombreOcupante').value.trim();
    const especialidad = document.getElementById('nombreEspecialidad').value.trim();
    
    if (!general || !especifico || !ocupante || !especialidad) {
      this.showNotification('Completa todos los campos', 'warning');
      return;
    }
    
    if (!this.grupoId) {
      this.showNotification('No hay grupo activo', 'error');
      return;
    }
    
    try {
      console.log('💾 Guardando nomenclatura:', { general, especifico, ocupante, especialidad });
      
      const response = await fetch('/api/espacios/nomenclatura', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grupo_id: this.grupoId,
          nomenclatura: { general, especifico, ocupante, especialidad }
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        this.nomenclatura = { general, especifico, ocupante, especialidad };
        this.updateDynamicTexts();
        this.showNotification('Nomenclatura actualizada correctamente', 'success');
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('❌ Error guardando nomenclatura:', error);
      this.showNotification('Error al guardar la nomenclatura', 'error');
    }
  }

  // ============= ESPACIOS =============
  
  render() {
    this.renderEspacios();
    this.renderEspecialidades();
    this.renderOcupantes();
    this.renderTipos();
    this.renderInstrumentos();
    this.renderMiembros();
  }

  renderEspacios() {
    const container = document.getElementById('espaciosList');
    
    if (this.espacios.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-building"></i>
          <h3>No hay espacios creados</h3>
          <p>Haz clic en "Agregar" para comenzar</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.espacios.map(space => `
      <div class="space-item" data-space-id="${space.id}">
        <div class="space-general">
          ${this.renderGeneralSpace(space)}
        </div>
        <div class="space-specific-container">
          ${this.renderSpecificSpaces(space)}
          ${space.name && !space.isEditing ? `
            <button class="btn-add" data-action="add-specific" data-space-id="${space.id}">
              <i class="fas fa-plus"></i>
              Agregar ${this.nomenclatura.especifico.toLowerCase()}
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
          placeholder="Nombre del ${this.nomenclatura.general.toLowerCase()}"
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
            data-spec-id="${spec.id}"
            data-action="editing-specific-input"
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

  handleEspaciosClick(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const spaceId = button.dataset.spaceId;
    const specId = button.dataset.specId;

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
  }

  handleEspaciosInput(e) {
    const input = e.target;
    const action = input.dataset.action;
    const spaceId = input.dataset.spaceId;
    const specId = input.dataset.specId;

    if (action === 'edit-general-input') {
      this.updateGeneralInputValue(spaceId, input.value);
    } else if (action === 'editing-general-input') {
      this.updateEditingValue(input.value);
    } else if (action === 'edit-specific-input') {
      this.updateSpecificInputValue(spaceId, specId, input.value);
    } else if (action === 'editing-specific-input') {
      this.updateEditingValue(input.value);
    }
  }

  handleEspaciosKeydown(e) {
    if (e.key === 'Enter') {
      const input = e.target;
      const action = input.dataset.action;
      const spaceId = input.dataset.spaceId;
      const specId = input.dataset.specId;

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
  }

  updateGeneralInputValue(spaceId, value) {
    const space = this.espacios.find(s => s.id === spaceId);
    if (space) {
      space.name = value;
      const btn = document.querySelector(`button[data-action="confirm-general"][data-space-id="${spaceId}"]`);
      if (btn) btn.disabled = !value.trim();
    }
  }

  updateEditingValue(value) {
    this.editingValue = value;
    const saveBtn = document.querySelector(`button[data-action="save-edit-general"]`) || 
                    document.querySelector(`button[data-action="save-edit-specific"]`);
    if (saveBtn) saveBtn.disabled = !value.trim();
  }

  updateSpecificInputValue(spaceId, specId, value) {
    const space = this.espacios.find(s => s.id === spaceId);
    if (space) {
      const spec = space.specificSpaces.find(s => s.id === specId);
      if (spec) {
        spec.name = value;
        const btn = document.querySelector(`button[data-action="confirm-specific"][data-space-id="${spaceId}"][data-spec-id="${specId}"]`);
        if (btn) btn.disabled = !value.trim();
      }
    }
  }

  addGeneralSpace() {
    const newSpace = {
      id: `temp-${Date.now()}`,
      name: '',
      isEditing: true,
      specificSpaces: []
    };
    this.espacios.push(newSpace);
    this.renderEspacios();
  }

  async confirmGeneral(spaceId) {
    const space = this.espacios.find(s => s.id === spaceId);
    if (!space || !space.name || !space.name.trim()) {
      alert('El nombre del espacio es requerido');
      return;
    }

    try {
      const response = await fetch('/api/espacios/espacio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: this.grupoId,
          nombre: space.name.trim(),
          tipo: 'general'
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Espacio general creado:', data.espacio_id);
        await this.cargarEspacios();
      } else {
        alert('Error al crear el espacio: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error creando espacio general:', error);
      alert('Error de conexión al crear el espacio');
    }
  }

  startEditingGeneral(spaceId, currentName) {
    this.editingId = spaceId;
    this.editingValue = currentName;
    this.renderEspacios();
  }

  async saveEditGeneral(spaceId) {
    if (!this.editingValue || !this.editingValue.trim()) {
      alert('El nombre del espacio es requerido');
      return;
    }

    try {
      const response = await fetch(`/api/espacios/espacio/${encodeURIComponent(spaceId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: this.grupoId,
          nombre: this.editingValue.trim()
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Espacio actualizado');
        this.cancelEditing();
        await this.cargarEspacios();
      } else {
        alert('Error al actualizar el espacio: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error actualizando espacio:', error);
      alert('Error de conexión al actualizar el espacio');
    }
  }

  async deleteGeneralSpace(spaceId) {
    const space = this.espacios.find(s => s.id === spaceId);
    const hasSubspaces = space && space.specificSpaces && space.specificSpaces.length > 0;
    
    const message = hasSubspaces 
      ? '¿Estás seguro de eliminar este espacio? Primero debes eliminar todos sus sub-espacios.'
      : '¿Estás seguro de eliminar este espacio?';
    
    if (hasSubspaces) {
      alert(message);
      return;
    }
    
    if (!confirm(message)) return;

    try {
      const response = await fetch(`/api/espacios/espacio/${encodeURIComponent(spaceId)}?grupo_id=${encodeURIComponent(this.grupoId)}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Espacio eliminado');
        await this.cargarEspacios();
      } else {
        alert('Error al eliminar el espacio: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error eliminando espacio:', error);
      alert('Error de conexión al eliminar el espacio');
    }
  }

  addSpecificSpace(spaceId) {
    this.espacios = this.espacios.map(space => {
      if (space.id === spaceId) {
        return {
          ...space,
          specificSpaces: [
            ...space.specificSpaces,
            { id: `temp-${Date.now()}`, name: '', isEditing: true }
          ]
        };
      }
      return space;
    });
    this.renderEspacios();
  }

  async confirmSpecific(spaceId, specId) {
    const space = this.espacios.find(s => s.id === spaceId);
    if (!space) return;
    
    const subspace = space.specificSpaces.find(s => s.id === specId);
    if (!subspace || !subspace.name || !subspace.name.trim()) {
      alert('El nombre del sub-espacio es requerido');
      return;
    }

    try {
      const response = await fetch('/api/espacios/espacio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: this.grupoId,
          nombre: subspace.name.trim(),
          tipo: 'especifico',
          pertenece_a: spaceId
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Sub-espacio creado:', data.espacio_id);
        await this.cargarEspacios();
      } else {
        alert('Error al crear el sub-espacio: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error creando sub-espacio:', error);
      alert('Error de conexión al crear el sub-espacio');
    }
  }

  startEditingSpecific(specId, currentName) {
    this.editingId = specId;
    this.editingValue = currentName;
    this.renderEspacios();
  }

  async saveEditSpecific(spaceId, specId) {
    if (!this.editingValue || !this.editingValue.trim()) {
      alert('El nombre del sub-espacio es requerido');
      return;
    }

    try {
      const response = await fetch(`/api/espacios/espacio/${encodeURIComponent(specId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grupo_id: this.grupoId,
          nombre: this.editingValue.trim()
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Sub-espacio actualizado');
        this.cancelEditing();
        await this.cargarEspacios();
      } else {
        alert('Error al actualizar el sub-espacio: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error actualizando sub-espacio:', error);
      alert('Error de conexión al actualizar el sub-espacio');
    }
  }

  async deleteSpecificSpace(spaceId, specId) {
    if (!confirm('¿Estás seguro de eliminar este espacio específico?')) return;

    try {
      const deleteUrl = `/api/espacios/espacio/${encodeURIComponent(specId)}?grupo_id=${encodeURIComponent(this.grupoId)}`;
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.ok) {
        console.log('✅ Sub-espacio eliminado exitosamente');
        await this.cargarEspacios();
      } else {
        alert('Error al eliminar: ' + (data.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('❌ Error eliminando sub-espacio:', error);
      alert('Error de conexión al eliminar el sub-espacio');
    }
  }

  cancelEditing() {
    this.editingId = null;
    this.editingValue = '';
    this.renderEspacios();
  }

  async guardarEspacios() {
    console.log('💾 Guardando espacios...', this.espacios);
    
    if (!this.grupoId) {
      this.showNotification('No hay grupo activo', 'error');
      return;
    }
    
    try {
      // Aquí deberías implementar la lógica para guardar los espacios
      // Por ahora solo mostramos mensaje de éxito
      // TODO: Implementar endpoint para actualizar múltiples espacios
      
      this.showNotification('Espacios guardados correctamente', 'success');
    } catch (error) {
      console.error('❌ Error guardando espacios:', error);
      this.showNotification('Error al guardar los espacios', 'error');
    }
  }

  // ============= MIEMBROS =============
  
  renderMiembros() {
    const container = document.getElementById('membersTableContainer');
    document.getElementById('membersCount').textContent = 
      `${this.miembros.length} miembro${this.miembros.length !== 1 ? 's' : ''} en este grupo`;
    
    if (this.miembros.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <h3>No hay miembros aún</h3>
          <p>Invita a personas para colaborar en este grupo</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="members-table">
        <thead>
          <tr>
            <th>Miembro</th>
            <th>Rol</th>
            <th>Fecha de Ingreso</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${this.miembros.map(m => this.renderMiembro(m)).join('')}
        </tbody>
      </table>
    `;
  }

  canManageMember(miembro) {
    const targetRole = miembro.role || miembro.rol;
    const targetSub = miembro.user_sub || miembro.id;
    
    // No puede gestionar a sí mismo
    const isSelf = targetSub === this.currentUserSub || 
                   (miembro.email === this.currentUserEmail) ||
                   (miembro.user_email === this.currentUserEmail);
    
    if (isSelf) return false;
    
    // Owner puede gestionar a todos (excepto a sí mismo)
    if (this.currentUserRole === 'owner') return true;
    
    // Nadie puede gestionar al owner
    if (targetRole === 'owner') return false;
    
    // Admin solo puede gestionar writer y reader
    if (this.currentUserRole === 'admin') {
      return targetRole === 'writer' || targetRole === 'reader' || targetRole === 'editor' || targetRole === 'viewer';
    }
    
    // Otros roles no pueden gestionar a nadie
    return false;
  }

  renderMiembro(miembro) {
    // Generar iniciales del nombre o email
    const nombreMiembro = miembro.user_name || miembro.nombre || miembro.user_email || miembro.email;
    const emailMiembro = miembro.user_email || miembro.email || '';
    const iniciales = this.getInitials(nombreMiembro);
    
    const fecha = new Date(miembro.added_at || miembro.fecha_ingreso).toLocaleDateString('es-CL');
    const rol = miembro.role || miembro.rol;
    const esCreador = miembro.role === 'owner' || miembro.esCreador;
    const puedeGestionar = this.canManageMember(miembro);
    
    // Escapar caracteres especiales para JSON
    const miembroJSON = JSON.stringify(miembro).replace(/"/g, '&quot;');
    
    return `
      <tr>
        <td>
          <div class="member-info">
            <div class="member-avatar">${iniciales}</div>
            <div class="member-details">
              <div class="member-name">${nombreMiembro}</div>
              <div class="member-email">${emailMiembro}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="role-badge ${rol}">${this.getRoleName(rol)}</span>
        </td>
        <td>
          <span class="member-date">${fecha}</span>
        </td>
        <td>
          <div class="member-actions">
            <button 
              class="btn-icon edit" 
              data-action="change-role" 
              data-member='${miembroJSON}'
              title="${puedeGestionar ? 'Cambiar rol' : 'No tienes permisos para cambiar el rol'}"
              ${!puedeGestionar ? 'disabled' : ''}
            >
              <i class="fas fa-user-edit"></i>
            </button>
            <button 
              class="btn-icon delete" 
              data-action="remove-member" 
              data-member='${miembroJSON}'
              title="${puedeGestionar ? 'Remover miembro' : 'No tienes permisos para remover este miembro'}"
              ${!puedeGestionar ? 'disabled' : ''}
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  getRoleName(rol) {
    const roles = {
      owner: 'Propietario',
      admin: 'Administrador',
      writer: 'Editor',
      reader: 'Lector'
    };
    return roles[rol] || rol;
  }

  ajustarOpcionesInvitacion() {
    const inviteRoleSelect = document.getElementById('inviteRole');
    if (!inviteRoleSelect) return;

    // Si es admin, remover la opción de administrador
    if (this.currentUserRole === 'admin') {
      const adminOption = inviteRoleSelect.querySelector('option[value="admin"]');
      if (adminOption) {
        adminOption.remove();
      }
      console.log('🔒 Admin: Solo puede invitar como writer o reader');
    }
  }

  async invitarMiembro() {
    const email = document.getElementById('inviteEmail').value.trim();
    const rol = document.getElementById('inviteRole').value;
    
    if (!email) {
      this.showNotification('Ingresa un correo electrónico', 'warning');
      return;
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showNotification('Ingresa un correo válido', 'warning');
      return;
    }
    
    if (!this.grupoId) {
      this.showNotification('No hay grupo activo', 'error');
      return;
    }
    
    try {
      console.log('📧 Enviando invitación:', { email, rol });
      
      const response = await fetch('/api/grupos/invitar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grupo_id: this.grupoId,
          email,
          rol
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        this.showNotification('Invitación enviada correctamente', 'success');
        document.getElementById('inviteEmail').value = '';
        // Recargar lista de miembros
        await this.cargarMiembros();
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('❌ Error enviando invitación:', error);
      this.showNotification('Error al enviar la invitación', 'error');
    }
  }

  handleMembersClick(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const action = button.dataset.action;
    const memberData = button.dataset.member;

    if (!memberData) return;

    try {
      const miembro = JSON.parse(memberData);

      switch (action) {
        case 'change-role':
          this.openChangeRoleModal(miembro);
          break;
        case 'remove-member':
          this.openRemoveMemberModal(miembro);
          break;
      }
    } catch (error) {
      console.error('Error parseando datos del miembro:', error);
    }
  }

  // ============= ESPECIALIDADES (MASTER-DETAIL) =============

  renderEspecialidades() {
    const container = document.getElementById('especialidades-list');
    
    if (!container) return;
    
    const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
    
    if (this.especialidades.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-stethoscope"></i>
          <p>No hay ${this.pluralize(nombreEspecialidad.toLowerCase())} registradas</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.especialidades.map(esp => `
      <div class="item-card ${this.especialidadSeleccionada === esp.id ? 'selected' : ''}" 
           data-action="select-especialidad" data-id="${esp.id}">
        <div class="item-info">
          <div class="item-name">${esp.nombre}</div>
          <div class="item-count">${this.ocupantes.filter(o => o.especialidad_id === esp.id).length} ${(this.nomenclatura.ocupante || 'ocupante').toLowerCase()}(s)</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon edit" data-action="edit-especialidad" data-id="${esp.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" data-action="delete-especialidad" data-id="${esp.id}" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  seleccionarEspecialidad(especialidadId) {
    this.especialidadSeleccionada = especialidadId;
    this.renderEspecialidades();
    this.renderOcupantes();
    
    // Mostrar el formulario de agregar ocupante
    const addSection = document.getElementById('add-ocupante-section');
    if (addSection) {
      addSection.classList.remove('d-none');
    }
    
    // Actualizar el subtitle
    const especialidad = this.especialidades.find(e => e.id === especialidadId);
    const subtitle = document.getElementById('ocupantes-subtitle');
    if (subtitle && especialidad) {
      const nombreOcupante = this.nomenclatura.ocupante || 'Ocupante';
      subtitle.textContent = `${this.pluralize(nombreOcupante)} de ${especialidad.nombre}`;
    }
  }

  async mostrarFormularioEspecialidad(especialidadId = null) {
    const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
    const especialidad = especialidadId ? this.especialidades.find(e => e.id === especialidadId) : null;
    const titulo = especialidad ? `Editar ${nombreEspecialidad}` : `Nueva ${nombreEspecialidad}`;
    const valorActual = especialidad ? especialidad.nombre : '';
    
    const nuevoNombre = await this.modalManager.prompt({
      title: titulo,
      placeholder: `Nombre de la ${nombreEspecialidad.toLowerCase()}`,
      defaultValue: valorActual,
      confirmText: especialidad ? 'Actualizar' : 'Crear'
    });
    
    if (nuevoNombre && nuevoNombre.trim()) {
      if (especialidad) {
        this.actualizarEspecialidad(especialidadId, nuevoNombre.trim());
      } else {
        this.crearEspecialidad(nuevoNombre.trim());
      }
    }
  }

  async agregarEspecialidad() {
    const nombreInput = document.getElementById('nuevaEspecialidadNombre');
    const nombre = nombreInput.value.trim();

    if (!nombre) {
      this.showNotification('El nombre es requerido', 'error');
      return;
    }

    await this.crearEspecialidad(nombre);
    nombreInput.value = '';
  }

  async crearEspecialidad(nombre) {
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/especialidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        // Limpiar input
        document.getElementById('nuevaEspecialidadNombre').value = '';
        
        await this.cargarEspecialidades();
        this.renderEspecialidades();
        
        const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
        this.showNotification(`${nombreEspecialidad} creada exitosamente`, 'success');
      } else {
        throw new Error(data.error || 'Error al crear especialidad');
      }
    } catch (error) {
      console.error('Error creando especialidad:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async editarEspecialidad(id) {
    await this.mostrarFormularioEspecialidad(id);
  }

  async actualizarEspecialidad(id, nombre) {
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/especialidades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        await this.cargarEspecialidades();
        this.renderEspecialidades();
        this.showNotification(`${this.nomenclatura.especialidad || 'Especialidad'} actualizada`, 'success');
      } else {
        throw new Error(data.error || 'Error al actualizar especialidad');
      }
    } catch (error) {
      console.error('Error actualizando especialidad:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async eliminarEspecialidad(id) {
    const especialidad = this.especialidades.find(e => e.id === id);
    const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
    
    const confirmed = await this.modalManager.confirm({
      title: `Eliminar ${nombreEspecialidad}`,
      message: `¿Estás seguro de eliminar la ${nombreEspecialidad.toLowerCase()} "${especialidad.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/especialidades/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.ok) {
        await this.cargarEspecialidades();
        this.renderEspecialidades();
        this.showNotification(`${nombreEspecialidad} eliminada`, 'success');
      } else {
        throw new Error(data.error || 'Error al eliminar especialidad');
      }
    } catch (error) {
      console.error('Error eliminando especialidad:', error);
      this.showNotification(error.message, 'error');
    }
  }

  // ============= OCUPANTES (MASTER-DETAIL) =============

  renderOcupantes() {
    const container = document.getElementById('ocupantes-list');
    
    if (!container) return;
    
    const nombreOcupante = this.nomenclatura.ocupante || 'Ocupante';
    
    // Si no hay especialidad seleccionada, mostrar estado vacío
    if (!this.especialidadSeleccionada) {
      const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-hand-pointer"></i>
          <p>Selecciona una ${nombreEspecialidad.toLowerCase()}</p>
        </div>
      `;
      return;
    }
    
    // Filtrar ocupantes por especialidad seleccionada
    const ocupantesFiltrados = this.ocupantes.filter(o => o.especialidad_id === this.especialidadSeleccionada);
    
    if (ocupantesFiltrados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-user-md"></i>
          <p>No hay ${this.pluralize(nombreOcupante.toLowerCase())} en esta especialidad</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = ocupantesFiltrados.map(ocup => `
      <div class="item-card">
        <div class="item-info">
          <div class="item-name">${ocup.nombre}</div>
        </div>
        <div class="item-actions">
          <button class="btn-icon edit" data-action="edit-ocupante" data-id="${ocup.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" data-action="delete-ocupante" data-id="${ocup.id}" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  async agregarOcupante() {
    const nombreInput = document.getElementById('nuevoOcupanteNombre');
    const nombre = nombreInput.value.trim();

    if (!nombre) {
      this.showNotification('El nombre es requerido', 'error');
      return;
    }

    if (!this.especialidadSeleccionada) {
      this.showNotification('Debes seleccionar una especialidad primero', 'error');
      return;
    }

    await this.crearOcupante(nombre, this.especialidadSeleccionada);
    nombreInput.value = '';
  }

  mostrarFormularioOcupante(ocupanteId = null) {
    const nombreOcupante = this.nomenclatura.ocupante || 'Ocupante';
    const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
    const ocupante = ocupanteId ? this.ocupantes.find(o => o.id === ocupanteId) : null;
    
    // Verificar que haya especialidades disponibles
    if (this.especialidades.length === 0) {
      this.showNotification(`Primero debes crear al menos una ${nombreEspecialidad.toLowerCase()}`, 'error');
      return;
    }
    
    // Configurar el modal
    const modal = document.getElementById('ocupanteModal');
    const modalTitle = document.getElementById('ocupanteModalTitle');
    const nombreInput = document.getElementById('ocupanteNombre');
    const especialidadSelect = document.getElementById('ocupanteEspecialidad');
    
    modalTitle.innerHTML = ocupante 
      ? `<i class="fas fa-edit"></i> Editar ${nombreOcupante}`
      : `<i class="fas fa-plus"></i> Nuevo ${nombreOcupante}`;
    
    nombreInput.value = ocupante ? ocupante.nombre : '';
    
    // Llenar el select de especialidades
    especialidadSelect.innerHTML = `
      <option value="">Seleccione una ${nombreEspecialidad.toLowerCase()}</option>
      ${this.especialidades.map(esp => `
        <option value="${esp.id}" ${ocupante && ocupante.especialidad_id === esp.id ? 'selected' : ''}>
          ${esp.nombre}
        </option>
      `).join('')}
    `;
    
    // Guardar el ID del ocupante que se está editando
    modal.dataset.ocupanteId = ocupanteId || '';
    
    // Mostrar el modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Focus en el input de nombre
    setTimeout(() => nombreInput.focus(), 300);
  }

  guardarOcupanteDesdeModal() {
    const modal = document.getElementById('ocupanteModal');
    const nombreInput = document.getElementById('ocupanteNombre');
    const especialidadSelect = document.getElementById('ocupanteEspecialidad');
    const ocupanteId = modal.dataset.ocupanteId;
    
    const nombre = nombreInput.value.trim();
    const especialidadId = especialidadSelect.value;
    
    // Validaciones
    if (!nombre) {
      this.showNotification('El nombre es requerido', 'error');
      nombreInput.focus();
      return;
    }
    
    if (!especialidadId) {
      const nombreEspecialidad = this.nomenclatura.especialidad || 'especialidad';
      this.showNotification(`Debes seleccionar una ${nombreEspecialidad.toLowerCase()}`, 'error');
      especialidadSelect.focus();
      return;
    }
    
    // Cerrar el modal
    const bsModal = bootstrap.Modal.getInstance(modal);
    bsModal.hide();
    
    // Crear o actualizar
    if (ocupanteId) {
      this.actualizarOcupante(ocupanteId, nombre, especialidadId);
    } else {
      this.crearOcupante(nombre, especialidadId);
    }
  }

  async crearOcupante(nombre, especialidadId) {
    try {
      // Obtener el nombre de la especialidad
      const especialidad = this.especialidades.find(e => e.id === especialidadId);
      
      const response = await fetch(`/api/grupos/${this.grupoId}/ocupantes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre, 
          especialidad_id: especialidadId,
          especialidad: especialidad?.nombre || '',
          tipo: this.nomenclatura.ocupante || 'Ocupante'
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        await this.cargarOcupantes();
        this.renderOcupantes();
        this.showNotification(`${this.nomenclatura.ocupante || 'Ocupante'} creado exitosamente`, 'success');
      } else {
        throw new Error(data.error || 'Error al crear ocupante');
      }
    } catch (error) {
      console.error('Error creando ocupante:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async editarOcupante(id) {
    const ocupante = this.ocupantes.find(o => o.id === id);
    if (!ocupante) return;

    const nombreOcupante = this.nomenclatura.ocupante || 'Ocupante';
    const nombreEspecialidad = this.nomenclatura.especialidad || 'Especialidad';
    
    const result = await this.modalManager.editOcupante({
      title: `Editar ${nombreOcupante}`,
      nombreActual: ocupante.nombre,
      especialidadActual: ocupante.especialidad_id,
      especialidades: this.especialidades,
      nombreLabel: `Nombre del ${nombreOcupante.toLowerCase()}`,
      especialidadLabel: nombreEspecialidad,
      confirmText: 'Actualizar'
    });
    
    if (result) {
      this.actualizarOcupante(id, result.nombre, result.especialidadId);
    }
  }

  async actualizarOcupante(id, nombre, especialidadId) {
    try {
      // Obtener el nombre de la especialidad
      const especialidad = this.especialidades.find(e => e.id === especialidadId);
      
      const response = await fetch(`/api/grupos/${this.grupoId}/ocupantes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre, 
          especialidad_id: especialidadId,
          especialidad: especialidad?.nombre || '',
          tipo: this.nomenclatura.ocupante || 'Ocupante'
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        await this.cargarOcupantes();
        this.renderOcupantes();
        this.showNotification(`${this.nomenclatura.ocupante || 'Ocupante'} actualizado`, 'success');
      } else {
        throw new Error(data.error || 'Error al actualizar ocupante');
      }
    } catch (error) {
      console.error('Error actualizando ocupante:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async eliminarOcupante(id) {
    const ocupante = this.ocupantes.find(o => o.id === id);
    const nombreOcupante = this.nomenclatura.ocupante || 'Ocupante';
    
    const confirmed = await this.modalManager.confirm({
      title: `Eliminar ${nombreOcupante}`,
      message: `¿Estás seguro de eliminar a "${ocupante.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/ocupantes/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.ok) {
        await this.cargarOcupantes();
        this.renderOcupantes();
        this.showNotification(`${nombreOcupante} eliminado`, 'success');
      } else {
        throw new Error(data.error || 'Error al eliminar ocupante');
      }
    } catch (error) {
      console.error('Error eliminando ocupante:', error);
      this.showNotification(error.message, 'error');
    }
  }

  // ============= TIPOS DE INSTRUMENTOS =============

  async cargarTiposInstrumentos() {
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/tipos-instrumentos`);
      const data = await response.json();
      
      if (data.ok) {
        this.tiposInstrumentos = data.tipos || [];
        console.log('✅ Tipos de instrumentos cargados:', this.tiposInstrumentos.length);
      }
    } catch (error) {
      console.error('Error cargando tipos de instrumentos:', error);
    }
  }

  renderTipos() {
    const tiposList = document.getElementById('tipos-list');
    if (!tiposList) return;

    if (this.tiposInstrumentos.length === 0) {
      tiposList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-list"></i>
          <p>No hay tipos de instrumentos creados</p>
        </div>
      `;
      return;
    }

    tiposList.innerHTML = this.tiposInstrumentos.map(tipo => `
      <div class="item-card ${this.tipoSeleccionado === tipo.id ? 'selected' : ''}" 
           data-action="select-tipo" data-id="${tipo.id}">
        <div class="item-info">
          <span class="item-name">${tipo.nombre}</span>
          <span class="item-count">${this.instrumentos.filter(i => i.tipo_instrumento_id === tipo.id).length} instrumentos</span>
        </div>
        <div class="item-actions">
          <button class="btn-icon edit" data-action="edit-tipo" data-id="${tipo.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" data-action="delete-tipo" data-id="${tipo.id}" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  seleccionarTipo(tipoId) {
    this.tipoSeleccionado = tipoId;
    this.renderTipos();
    this.renderInstrumentos();
    document.getElementById('add-instrumento-section').classList.remove('d-none');
    
    const tipo = this.tiposInstrumentos.find(t => t.id === tipoId);
    document.getElementById('instrumentos-subtitle').textContent = 
      `Instrumentos de: ${tipo?.nombre || ''}`;
  }

  async agregarTipo() {
    const nombreInput = document.getElementById('nuevoTipoNombre');
    const nombre = nombreInput.value.trim();

    if (!nombre) {
      this.showNotification('El nombre es requerido', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/tipos-instrumentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre })
      });

      const data = await response.json();

      if (data.ok) {
        await this.cargarTiposInstrumentos();
        this.renderTipos();
        nombreInput.value = '';
        this.showNotification('Tipo creado correctamente', 'success');
      } else {
        throw new Error(data.error || 'Error al crear tipo');
      }
    } catch (error) {
      console.error('Error creando tipo:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async editarTipo(id) {
    const tipo = this.tiposInstrumentos.find(t => t.id === id);
    if (!tipo) return;

    const nuevoNombre = await this.modalManager.prompt({
      title: 'Editar Tipo de Instrumento',
      placeholder: 'Nombre del tipo',
      defaultValue: tipo.nombre,
      confirmText: 'Actualizar'
    });
    
    if (!nuevoNombre || nuevoNombre.trim() === '') return;

    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/tipos-instrumentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevoNombre.trim() })
      });

      const data = await response.json();

      if (data.ok) {
        await this.cargarTiposInstrumentos();
        this.renderTipos();
        if (this.tipoSeleccionado === id) {
          document.getElementById('instrumentos-subtitle').textContent = 
            `Instrumentos de: ${nuevoNombre.trim()}`;
        }
        this.showNotification('Tipo actualizado', 'success');
      } else {
        throw new Error(data.error || 'Error al actualizar tipo');
      }
    } catch (error) {
      console.error('Error actualizando tipo:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async eliminarTipo(id) {
    const tipo = this.tiposInstrumentos.find(t => t.id === id);
    if (!tipo) return;

    const instrumentosAsociados = this.instrumentos.filter(i => i.tipo_instrumento_id === id).length;
    
    const message = instrumentosAsociados > 0
      ? `Este tipo tiene ${instrumentosAsociados} instrumento(s) asociado(s). Si lo eliminas, estos instrumentos quedarán sin tipo asignado. ¿Deseas continuar?`
      : `¿Estás seguro de eliminar el tipo "${tipo.nombre}"? Esta acción no se puede deshacer.`;
    
    const confirmed = await this.modalManager.confirm({
      title: 'Eliminar Tipo',
      message: message,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/tipos-instrumentos/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.ok) {
        if (this.tipoSeleccionado === id) {
          this.tipoSeleccionado = null;
          document.getElementById('add-instrumento-section').classList.add('d-none');
        }
        await this.cargarTiposInstrumentos();
        await this.cargarInstrumentos();
        this.renderTipos();
        this.renderInstrumentos();
        this.showNotification('Tipo eliminado', 'success');
      } else {
        throw new Error(data.error || 'Error al eliminar tipo');
      }
    } catch (error) {
      console.error('Error eliminando tipo:', error);
      this.showNotification(error.message, 'error');
    }
  }

  // ============= INSTRUMENTOS =============

  async cargarInstrumentos() {
    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/instrumentos`);
      const data = await response.json();
      
      if (data.ok) {
        this.instrumentos = data.instrumentos || [];
        console.log('✅ Instrumentos cargados:', this.instrumentos.length);
      }
    } catch (error) {
      console.error('Error cargando instrumentos:', error);
    }
  }

  renderInstrumentos() {
    const instrumentosList = document.getElementById('instrumentos-list');
    if (!instrumentosList) return;

    if (!this.tipoSeleccionado) {
      instrumentosList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-hand-pointer"></i>
          <p>Selecciona un tipo</p>
        </div>
      `;
      return;
    }

    const instrumentosFiltrados = this.instrumentos.filter(
      i => i.tipo_instrumento_id === this.tipoSeleccionado
    );

    if (instrumentosFiltrados.length === 0) {
      instrumentosList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-tools"></i>
          <p>No hay instrumentos en este tipo</p>
        </div>
      `;
      return;
    }

    instrumentosList.innerHTML = instrumentosFiltrados.map(inst => `
      <div class="item-card">
        <div class="item-info">
          <span class="item-name">${inst.nombre}</span>
        </div>
        <div class="item-actions">
          <button class="btn-icon edit" data-action="edit-instrumento" data-id="${inst.id}" title="Editar">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" data-action="delete-instrumento" data-id="${inst.id}" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  async agregarInstrumento() {
    if (!this.tipoSeleccionado) {
      this.showNotification('Selecciona un tipo primero', 'error');
      return;
    }

    const nombreInput = document.getElementById('nuevoInstrumentoNombre');
    const nombre = nombreInput.value.trim();

    if (!nombre) {
      this.showNotification('El nombre es requerido', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/instrumentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre,
          tipo_instrumento_id: this.tipoSeleccionado
        })
      });

      const data = await response.json();

      if (data.ok) {
        await this.cargarInstrumentos();
        this.renderInstrumentos();
        this.renderTipos(); // Actualizar contador
        nombreInput.value = '';
        this.showNotification('Instrumento creado', 'success');
      } else {
        throw new Error(data.error || 'Error al crear instrumento');
      }
    } catch (error) {
      console.error('Error creando instrumento:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async editarInstrumento(id) {
    const instrumento = this.instrumentos.find(i => i.id === id);
    if (!instrumento) return;

    const nuevoNombre = await this.modalManager.prompt({
      title: 'Editar Instrumento',
      placeholder: 'Nombre del instrumento',
      defaultValue: instrumento.nombre,
      confirmText: 'Actualizar'
    });
    
    if (!nuevoNombre || nuevoNombre.trim() === '') return;

    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/instrumentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: nuevoNombre.trim(),
          tipo_instrumento_id: instrumento.tipo_instrumento_id
        })
      });

      const data = await response.json();

      if (data.ok) {
        await this.cargarInstrumentos();
        this.renderInstrumentos();
        this.showNotification('Instrumento actualizado', 'success');
      } else {
        throw new Error(data.error || 'Error al actualizar instrumento');
      }
    } catch (error) {
      console.error('Error actualizando instrumento:', error);
      this.showNotification(error.message, 'error');
    }
  }

  async eliminarInstrumento(id) {
    const instrumento = this.instrumentos.find(i => i.id === id);
    if (!instrumento) return;

    const confirmed = await this.modalManager.confirm({
      title: 'Eliminar Instrumento',
      message: `¿Estás seguro de eliminar "${instrumento.nombre}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/grupos/${this.grupoId}/instrumentos/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.ok) {
        await this.cargarInstrumentos();
        this.renderInstrumentos();
        this.renderTipos(); // Actualizar contador
        this.showNotification('Instrumento eliminado', 'success');
      } else {
        throw new Error(data.error || 'Error al eliminar instrumento');
      }
    } catch (error) {
      console.error('Error eliminando instrumento:', error);
      this.showNotification(error.message, 'error');
    }
  }

  // ============= UTILIDADES =============
  
  showNotification(message, type = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning'} notification-toast`;
    notification.innerHTML = `
      <div class="d-flex align-items-center">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Inicializar cuando el DOM esté listo
let gestionGrupo;
document.addEventListener('DOMContentLoaded', () => {
  gestionGrupo = new GestionGrupo();
  window.gestionGrupo = gestionGrupo; // Mantener para compatibilidad
  
  // ========= Event Listeners (refactorizado para CSP sin unsafe-inline) =========
  
  // Agregar especialidad
  const btnAddEspecialidad = document.querySelector('[data-action="add-especialidad"]');
  if (btnAddEspecialidad) {
    btnAddEspecialidad.addEventListener('click', () => gestionGrupo.agregarEspecialidad());
  }
  
  // Agregar ocupante
  const btnAddOcupante = document.querySelector('[data-action="add-ocupante"]');
  if (btnAddOcupante) {
    btnAddOcupante.addEventListener('click', () => gestionGrupo.agregarOcupante());
  }
  
  // Agregar tipo
  const btnAddTipo = document.querySelector('[data-action="add-tipo"]');
  if (btnAddTipo) {
    btnAddTipo.addEventListener('click', () => gestionGrupo.agregarTipo());
  }
  
  // Agregar instrumento
  const btnAddInstrumento = document.querySelector('[data-action="add-instrumento"]');
  if (btnAddInstrumento) {
    btnAddInstrumento.addEventListener('click', () => gestionGrupo.agregarInstrumento());
  }
  
  // ========= Delegación de eventos para items dinámicos =========
  
  // Especialidades
  const especialidadesList = document.getElementById('especialidades-list');
  if (especialidadesList) {
    especialidadesList.addEventListener('click', (e) => {
      const selectCard = e.target.closest('[data-action="select-especialidad"]');
      const editBtn = e.target.closest('[data-action="edit-especialidad"]');
      const deleteBtn = e.target.closest('[data-action="delete-especialidad"]');
      
      if (editBtn) {
        e.stopPropagation();
        gestionGrupo.editarEspecialidad(editBtn.dataset.id);
      } else if (deleteBtn) {
        e.stopPropagation();
        gestionGrupo.eliminarEspecialidad(deleteBtn.dataset.id);
      } else if (selectCard) {
        gestionGrupo.seleccionarEspecialidad(selectCard.dataset.id);
      }
    });
  }
  
  // Ocupantes
  const ocupantesList = document.getElementById('ocupantes-list');
  if (ocupantesList) {
    ocupantesList.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit-ocupante"]');
      const deleteBtn = e.target.closest('[data-action="delete-ocupante"]');
      
      if (editBtn) {
        gestionGrupo.editarOcupante(editBtn.dataset.id);
      } else if (deleteBtn) {
        gestionGrupo.eliminarOcupante(deleteBtn.dataset.id);
      }
    });
  }
  
  // Tipos de instrumentos
  const tiposList = document.getElementById('tipos-list');
  if (tiposList) {
    tiposList.addEventListener('click', (e) => {
      const selectCard = e.target.closest('[data-action="select-tipo"]');
      const editBtn = e.target.closest('[data-action="edit-tipo"]');
      const deleteBtn = e.target.closest('[data-action="delete-tipo"]');
      
      if (editBtn) {
        e.stopPropagation();
        gestionGrupo.editarTipo(editBtn.dataset.id);
      } else if (deleteBtn) {
        e.stopPropagation();
        gestionGrupo.eliminarTipo(deleteBtn.dataset.id);
      } else if (selectCard) {
        gestionGrupo.seleccionarTipo(selectCard.dataset.id);
      }
    });
  }
  
  // Instrumentos
  const instrumentosList = document.getElementById('instrumentos-list');
  if (instrumentosList) {
    instrumentosList.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit-instrumento"]');
      const deleteBtn = e.target.closest('[data-action="delete-instrumento"]');
      
      if (editBtn) {
        gestionGrupo.editarInstrumento(editBtn.dataset.id);
      } else if (deleteBtn) {
        gestionGrupo.eliminarInstrumento(deleteBtn.dataset.id);
      }
    });
  }
  
  // ========= Fin Event Listeners =========
});