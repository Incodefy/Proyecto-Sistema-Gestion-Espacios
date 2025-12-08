// Sistema de notificaciones toast en tiempo real

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.preferences = null; // Preferencias del usuario
    this.init();
    this.loadPreferences();
  }

  init() {
    // Crear contenedor de notificaciones si no existe
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }

  /**
   * Carga las preferencias de notificaciones del usuario
   */
  async loadPreferences() {
    try {
      const response = await fetch('/preferencias-notificaciones');
      const data = await response.json();
      if (data.ok && data.preferencias) {
        this.preferences = data.preferencias;
        console.log('✅ Preferencias de notificaciones cargadas:', this.preferences);
      }
    } catch (error) {
      console.warn('⚠️ No se pudieron cargar preferencias, mostrando todas las notificaciones');
      this.preferences = null;
    }
  }

  /**
   * Verifica si una notificación debe mostrarse según las preferencias
   * @param {string} category - Categoría: 'appointments', 'spaces', 'occupants', 'members'
   * @param {string} type - Tipo específico de notificación
   * @returns {boolean}
   */
  shouldShowNotification(category, type) {
    // Si no hay preferencias cargadas, mostrar todas
    if (!this.preferences) return true;
    
    // Si la categoría no existe en preferencias, mostrar
    if (!this.preferences[category]) return true;
    
    // Verificar si el tipo específico está habilitado
    const isEnabled = this.preferences[category][type];
    
    // Si no está definido, por defecto mostrar
    if (isEnabled === undefined) return true;
    
    return isEnabled;
  }

  /**
   * Muestra una notificación toast
   * @param {Object} options - Opciones de la notificación
   * @param {string} options.id - ID único de la notificación
   * @param {string} options.title - Título de la notificación
   * @param {string} options.message - Mensaje de la notificación
   * @param {string} options.type - Tipo: 'success', 'info', 'warning', 'error'
   * @param {number} options.duration - Duración en ms (0 = permanente)
   * @param {Function} options.onClick - Callback al hacer click
   */
  show({ id, title, message, type = 'info', duration = 5000, onClick }) {
    // Si ya existe una notificación con este ID, actualizarla
    if (this.notifications.has(id)) {
      this.update(id, { title, message, type });
      return;
    }

    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} notification-enter`;
    notification.dataset.notificationId = id;

    // Icono según el tipo usando Font Awesome
    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      info: '<i class="fas fa-info-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      error: '<i class="fas fa-times-circle"></i>'
    };

    notification.innerHTML = `
      <div class="notification-icon">${icons[type] || icons.info}</div>
      <div class="notification-content">
        <div class="notification-title">${this.escapeHtml(title)}</div>
        ${message ? `<div class="notification-message">${this.escapeHtml(message)}</div>` : ''}
      </div>
      <button class="notification-close" aria-label="Cerrar">&times;</button>
    `;

    // Event listeners
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide(id);
    });

    if (onClick) {
      notification.style.cursor = 'pointer';
      notification.addEventListener('click', () => {
        onClick();
        this.hide(id);
      });
    }

    // Agregar al contenedor
    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Trigger animación de entrada
    setTimeout(() => {
      notification.classList.remove('notification-enter');
    }, 10);

    // Auto-cerrar si tiene duración
    if (duration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, duration);
    }
  }

  /**
   * Oculta una notificación
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.classList.add('notification-exit');
    
    setTimeout(() => {
      notification.remove();
      this.notifications.delete(id);
    }, 300);
  }

  /**
   * Actualiza una notificación existente
   */
  update(id, { title, message, type }) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    // Actualizar clase de tipo
    notification.className = `notification notification-${type}`;

    // Actualizar contenido
    const titleEl = notification.querySelector('.notification-title');
    const messageEl = notification.querySelector('.notification-message');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl && message) messageEl.textContent = message;
  }

  /**
   * Limpia todas las notificaciones
   */
  clearAll() {
    this.notifications.forEach((_, id) => this.hide(id));
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Muestra notificación de cita creada
   */
  showAppointmentCreated(data) {
    if (!this.shouldShowNotification('appointments', 'INSERT')) return;
    
    this.show({
      id: `appointment-created-${Date.now()}`,
      title: 'Nueva cita agendada',
      message: `${data.ocupante_nombre} - ${data.fecha} ${data.hora_inicio}`,
      type: 'success',
      duration: 6000
    });
  }

  /**
   * Muestra notificación de cita modificada
   */
  showAppointmentModified(data) {
    if (!this.shouldShowNotification('appointments', 'MODIFY')) return;
    
    this.show({
      id: `appointment-modified-${Date.now()}`,
      title: 'Cita modificada',
      message: `${data.ocupante_nombre} - ${data.fecha} ${data.hora_inicio}`,
      type: 'info',
      duration: 6000
    });
  }

  /**
   * Muestra notificación de cita cancelada
   */
  showAppointmentCancelled(data) {
    if (!this.shouldShowNotification('appointments', 'REMOVE')) return;
    
    this.show({
      id: `appointment-cancelled-${Date.now()}`,
      title: 'Cita cancelada',
      message: `${data.ocupante_nombre} - ${data.fecha} ${data.hora_inicio}`,
      type: 'warning',
      duration: 6000
    });
  }

  /**
   * Muestra notificación de espacio creado
   */
  showSpaceCreated(data) {
    if (!this.shouldShowNotification('spaces', 'SPACE_CREATED')) return;
    
    this.show({
      id: `space-created-${Date.now()}`,
      title: 'Nuevo espacio creado',
      message: `${data.nombre} (${data.type === 'general' ? 'General' : 'Específico'})`,
      type: 'success',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de espacio modificado
   */
  showSpaceModified(data) {
    if (!this.shouldShowNotification('spaces', 'SPACE_MODIFIED')) return;
    
    let changesText = '';
    if (data.changes && Object.keys(data.changes).length > 0) {
      const changesList = Object.entries(data.changes).map(([field, change]) => {
        const fieldName = field === 'nombre' ? 'Nombre' : 
                         field === 'capacidad' ? 'Capacidad' : 
                         field === 'descripcion' ? 'Descripción' : 
                         field === 'estado' ? 'Estado' : field;
        return `${fieldName}: "${change.old}" → "${change.new}"`;
      });
      changesText = changesText = changesList.join('\n');
    } else {
      changesText = 'actualizado';
    }
    
    this.show({
      id: `space-modified-${Date.now()}`,
      title: `Espacio modificado: ${data.nombre}`,
      message: changesText,
      type: 'info',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de espacio eliminado
   */
  showSpaceDeleted(data) {
    if (!this.shouldShowNotification('spaces', 'SPACE_DELETED')) return;
    
    this.show({
      id: `space-deleted-${Date.now()}`,
      title: 'Espacio eliminado',
      message: data.nombre,
      type: 'warning',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de ocupante creado
   */
  showOccupantCreated(data) {
    if (!this.shouldShowNotification('occupants', 'OCCUPANT_CREATED')) return;
    
    this.show({
      id: `occupant-created-${Date.now()}`,
      title: 'Nuevo ocupante agregado',
      message: `${data.nombre} ${data.apellido || ''} - ${data.espacio || 'Sin asignar'}`,
      type: 'success',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de ocupante modificado
   */
  showOccupantModified(data) {
    if (!this.shouldShowNotification('occupants', 'OCCUPANT_MODIFIED')) return;
    
    const changes = data.changes ? Object.keys(data.changes).join(', ') : 'actualizado';
    this.show({
      id: `occupant-modified-${Date.now()}`,
      title: 'Ocupante modificado',
      message: `${data.nombre} ${data.apellido || ''} - ${changes}`,
      type: 'info',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de ocupante eliminado
   */
  showOccupantDeleted(data) {
    if (!this.shouldShowNotification('occupants', 'OCCUPANT_DELETED')) return;
    
    this.show({
      id: `occupant-deleted-${Date.now()}`,
      title: 'Ocupante eliminado',
      message: `${data.nombre} ${data.apellido || ''}`,
      type: 'warning',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de nuevo miembro
   */
  showMemberAdded(data) {
    if (!this.shouldShowNotification('members', 'MEMBER_ADDED')) return;
    
    this.show({
      id: `member-added-${Date.now()}`,
      title: 'Nuevo miembro en el grupo',
      message: `${data.nombre || data.email} - Rol: ${data.rol}`,
      type: 'success',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de miembro modificado
   */
  showMemberModified(data) {
    if (!this.shouldShowNotification('members', 'MEMBER_MODIFIED')) return;
    
    const changes = data.changes ? Object.keys(data.changes).join(', ') : 'actualizado';
    this.show({
      id: `member-modified-${Date.now()}`,
      title: 'Miembro modificado',
      message: `${data.nombre || data.email} - ${changes}`,
      type: 'info',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de miembro removido
   */
  showMemberRemoved(data) {
    if (!this.shouldShowNotification('members', 'MEMBER_REMOVED')) return;
    
    this.show({
      id: `member-removed-${Date.now()}`,
      title: 'Miembro removido del grupo',
      message: data.nombre || data.email,
      type: 'warning',
      duration: 5000
    });
  }

  /**
   * Muestra notificación de cambio de rol
   */
  showRoleChanged(data) {
    if (!this.shouldShowNotification('members', 'ROLE_CHANGED')) return;
    
    this.show({
      id: `role-changed-${Date.now()}`,
      title: 'Rol actualizado',
      message: `${data.nombre || data.email}: ${data.oldRole} → ${data.newRole}`,
      type: 'info',
      duration: 6000
    });
  }

  /**
   * Muestra notificación de nomenclatura actualizada
   */
  showNomenclaturaUpdated(data) {
    if (!this.shouldShowNotification('configuration', 'NOMENCLATURA_ACTUALIZADA')) return;
    
    let message = 'La nomenclatura del grupo ha sido actualizada';
    if (data.cambios && data.cambios.length > 0) {
      const camposTexto = {
        general: 'Espacio General',
        especifico: 'Espacio Específico',
        ocupante: 'Ocupante',
        especialidad: 'Especialidad',
        instrumento: 'Instrumento'
      };
      
      const cambiosTexto = data.cambios.map(c => camposTexto[c.campo] || c.campo).join(', ');
      message = `Nomenclatura actualizada: ${cambiosTexto}`;
    }
    
    this.show({
      id: `nomenclatura-updated-${Date.now()}`,
      title: 'Nomenclatura actualizada',
      message: message,
      type: 'info',
      duration: 6000
    });
  }

  /**
   * Muestra notificación genérica desde WebSocket
   */
  showFromWebSocket(notification) {
    const typeMap = {
      'APPOINTMENT_CREATED': 'success',
      'APPOINTMENT_MODIFIED': 'info',
      'APPOINTMENT_CANCELLED': 'warning',
      'SPACE_CREATED': 'success',
      'SPACE_MODIFIED': 'info',
      'SPACE_DELETED': 'warning',
      'OCCUPANT_CREATED': 'success',
      'OCCUPANT_MODIFIED': 'info',
      'OCCUPANT_DELETED': 'warning',
      'MEMBER_ADDED': 'success',
      'MEMBER_REMOVED': 'warning',
      'ROLE_CHANGED': 'info'
    };

    this.show({
      id: notification.id || `notification-${Date.now()}`,
      title: notification.titulo || notification.title,
      message: notification.mensaje || notification.message,
      type: typeMap[notification.tipo] || 'info',
      duration: 6000,
      onClick: notification.onClick
    });
  }

  /**
   * Recarga las preferencias de notificaciones
   * Útil después de que el usuario guarde cambios en preferencias
   */
  async reloadPreferences() {
    await this.loadPreferences();
  }
}

// Instancia global
window.notificationManager = new NotificationManager();
