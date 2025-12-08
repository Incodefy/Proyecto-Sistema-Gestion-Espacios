/**
 * Cliente API Mejorado v2.1 para Backend Serverless
 * 
 * Integra con el backend AWS Lambda con mejoras de seguridad:
 * - Correlation IDs para trazabilidad
 * - Headers de rate limiting
 * - Manejo de errores sanitizados
 * - Retry automático con backoff
 * - Request/Response logging
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

class ApiClientV2 {
  constructor(token, options = {}) {
    this.token = token;
    this.baseURL = process.env.API_BASE_URL;
    this.correlationId = options.correlationId || this.generateCorrelationId();
    this.userSub = options.userSub || null;
    
    // Configuración de retry
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Crear instancia de axios con configuración base
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000, // Incrementado para handlers con encryption
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '2.1.0'
      }
    });

    this._setupInterceptors();
  }

  /**
   * Genera un Correlation ID único para tracking
   */
  generateCorrelationId() {
    return `req-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Configura interceptors de axios
   */
  _setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Agregar token de autorización
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }

        // Agregar correlation ID para trazabilidad
        config.headers['X-Correlation-ID'] = this.correlationId;

        // Logging de request (solo en dev)
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔵 [${this.correlationId}] ${config.method.toUpperCase()} ${config.url}`);
        }

        // Timestamp de inicio para medir duración
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => {
        console.error('❌ Error en request interceptor:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Calcular duración
        const duration = Date.now() - response.config.metadata.startTime;

        // Extraer headers de rate limiting
        const rateLimitHeaders = this._extractRateLimitHeaders(response.headers);

        // Logging de response (solo en dev)
        if (process.env.NODE_ENV === 'development') {
          console.log(`🟢 [${this.correlationId}] ${response.status} (${duration}ms)`);
          
          if (rateLimitHeaders.limit) {
            console.log(`📊 Rate Limit: ${rateLimitHeaders.remaining}/${rateLimitHeaders.limit}`);
          }
        }

        // Agregar metadata a la response
        response.metadata = {
          duration,
          correlationId: response.headers['x-correlation-id'] || this.correlationId,
          rateLimitHeaders
        };

        return response;
      },
      async (error) => {
        return this._handleErrorResponse(error);
      }
    );
  }

  /**
   * Extrae headers de rate limiting
   */
  _extractRateLimitHeaders(headers) {
    return {
      limit: headers['x-ratelimit-limit'],
      remaining: headers['x-ratelimit-remaining'],
      reset: headers['x-ratelimit-reset'] ? new Date(parseInt(headers['x-ratelimit-reset'])) : null
    };
  }

  /**
   * Maneja errores de respuesta con retry automático
   */
  async _handleErrorResponse(error) {
    const config = error.config;

    // Si ya se excedió el máximo de retries
    if (!config || !config.metadata) {
      config.metadata = { retries: 0 };
    }

    if (error.response) {
      // El servidor respondió con un status code fuera del rango 2xx
      const { status, data } = error.response;
      const duration = Date.now() - config.metadata.startTime;

      console.error(
        `🔴 [${this.correlationId}] Error ${status} (${duration}ms)`,
        data?.error || data?.message || 'Unknown error'
      );

      // 401 - Token expirado
      if (status === 401) {
        console.error('🔒 Token expirado o inválido - se requiere re-autenticación');
        error.isAuthError = true;
      }

      // 429 - Rate limit exceeded
      if (status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        console.warn(`⏱️ Rate limit exceeded - Retry after ${retryAfter}s`);
        
        // Intentar retry automático si es posible
        if (config.metadata.retries < this.maxRetries) {
          const delay = (parseInt(retryAfter) || 5) * 1000;
          console.log(`🔄 Retry automático en ${delay / 1000}s...`);
          
          config.metadata.retries++;
          await this._sleep(delay);
          return this.client.request(config);
        }
      }

      // 500/502/503 - Server errors (retry con backoff)
      if ([500, 502, 503].includes(status) && config.metadata.retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, config.metadata.retries); // Exponential backoff
        console.log(`🔄 Server error - Retry ${config.metadata.retries + 1}/${this.maxRetries} en ${delay}ms`);
        
        config.metadata.retries++;
        await this._sleep(delay);
        return this.client.request(config);
      }

      // Enriquecer error con información del backend
      error.apiError = {
        status,
        code: data?.code,
        message: data?.error || data?.message,
        correlationId: error.response.headers['x-correlation-id']
      };

    } else if (error.request) {
      // Request fue hecho pero no hubo respuesta (timeout, network error)
      console.error(`🔴 [${this.correlationId}] No se recibió respuesta del servidor`);
      
      // Retry para network errors
      if (config.metadata.retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, config.metadata.retries);
        console.log(`🔄 Network error - Retry ${config.metadata.retries + 1}/${this.maxRetries} en ${delay}ms`);
        
        config.metadata.retries++;
        await this._sleep(delay);
        return this.client.request(config);
      }

      error.apiError = {
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'No se pudo conectar con el servidor'
      };

    } else {
      // Error configurando el request
      console.error(`🔴 [${this.correlationId}] Error en la petición:`, error.message);
      error.apiError = {
        status: 0,
        code: 'REQUEST_ERROR',
        message: error.message
      };
    }

    return Promise.reject(error);
  }

  /**
   * Sleep helper para retry
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper para extraer data de respuestas
   */
  _extractData(response) {
    // Si la response tiene estructura { ok, data }
    if (response.data && typeof response.data === 'object') {
      return response.data.data || response.data;
    }
    return response.data;
  }

  // ============================================
  // MÉTODOS DE LA API (ACTUALIZADOS PARA v2.1)
  // ============================================

  /**
   * Obtiene el grupo activo del usuario
   */
  async obtenerGrupoActivo() {
    try {
      const response = await this.client.get('/api/espacios/grupo-activo');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo grupo activo:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Asigna un grupo como activo
   */
  async asignarGrupoActivo(grupo_id) {
    try {
      const response = await this.client.put('/api/espacios/asignar-grupo', { grupo_id });
      return this._extractData(response);
    } catch (error) {
      console.error('Error asignando grupo activo:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene lista de grupos del usuario
   */
  async listarGruposUsuario() {
    try {
      const response = await this.client.get('/groups');
      return this._extractData(response);
    } catch (error) {
      console.error('Error listando grupos:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Crea un nuevo grupo
   */
  async crearGrupo(nombre, descripcion = '') {
    try {
      const response = await this.client.post('/groups', {
        name: nombre,
        description: descripcion
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error creando grupo:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene información de un grupo
   */
  async obtenerGrupo(group_id) {
    try {
      const response = await this.client.get(`/grupos/${group_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo grupo:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene solo la nomenclatura de un grupo (llamada directa al grupo)
   */
  async obtenerNomenclaturaGrupo(group_id) {
    try {
      const response = await this.client.get(`/grupos/${group_id}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const data = this._extractData(response);
      return data.group?.nomenclatura || null;
    } catch (error) {
      console.error('Error obteniendo nomenclatura:', error.apiError || error.message);
      return null;
    }
  }

  /**
   * Actualiza la nomenclatura de un grupo
   */
  async actualizarNomenclaturaGrupo(grupoId, nomenclatura) {
    try {
      const response = await this.client.put(`/grupos/${grupoId}/nomenclatura`, {
        nomenclatura
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error actualizando nomenclatura:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene appointments por fecha
   */
  async obtenerAgendaPorFecha(fecha, grupo_id = null) {
    try {
      // Si no se proporciona grupo_id, obtener el activo
      if (!grupo_id) {
        const grupoActivoResponse = await this.obtenerGrupoActivo();
        if (grupoActivoResponse && grupoActivoResponse.grupo_activo) {
          grupo_id = grupoActivoResponse.grupo_activo.grupo_id;
        } else {
          console.warn('⚠️ No hay grupo activo');
          return [];
        }
      }

      const response = await this.client.get(`/groups/${grupo_id}/appointments`, {
        params: { fecha }
      });
      
      const data = this._extractData(response);
      return data.appointments || data;
    } catch (error) {
      console.error('Error obteniendo appointments:', error.apiError || error.message);
      return [];
    }
  }

  /**
   * Obtiene notificaciones del usuario
   */
  async obtenerNotificaciones(filtros = {}) {
    try {
      const response = await this.client.get('/notifications', { params: filtros });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Marca notificación como leída
   */
  async marcarNotificacionLeida(notificationId) {
    try {
      const response = await this.client.put(`/notifications/${notificationId}/read`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error marcando notificación:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene permisos del usuario actual
   */
  async getMyPermissions() {
    try {
      const response = await this.client.get('/my-permissions');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo permisos:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene personalización del usuario
   */
  async obtenerPersonalizacion() {
    try {
      const response = await this.client.get('/personalization');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo personalización:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Guarda personalización del usuario
   */
  async guardarPersonalizacion(preferences) {
    try {
      const response = await this.client.post('/personalization', { preferences });
      return this._extractData(response);
    } catch (error) {
      console.error('Error guardando personalización:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de espacios de un grupo
   */
  async obtenerConfiguracionEspacios(grupo_id = null) {
    try {
      const endpoint = grupo_id 
        ? `/api/espacios/configuracion?grupo_id=${grupo_id}`
        : '/api/espacios/configuracion';
      const response = await this.client.get(endpoint);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo configuración espacios:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Guarda espacios de un grupo
   */
  async guardarEspacios(grupo_id, espacios, ocupantes = [], especialidades = [], tiposInstrumentos = [], instrumentos = []) {
    try {
      const response = await this.client.post(`/groups/${grupo_id}/spaces`, {
        grupo_id,
        espacios,
        especialidades,
        ocupantes,
        tipos_instrumentos: tiposInstrumentos,
        instrumentos
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error guardando espacios:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Lista espacios de un grupo
   */
  async listarEspacios(grupo_id) {
    try {
      const response = await this.client.get(`/api/espacios/lista?grupo_id=${grupo_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error listando espacios:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Elimina la configuración de espacios de un grupo
   */
  async eliminarConfiguracionEspacios(grupo_id) {
    try {
      const response = await this.client.delete(`/api/espacios/configuracion?grupo_id=${grupo_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error eliminando configuración espacios:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Crea un espacio individual
   */
  async crearEspacio(data) {
    try {
      const response = await this.client.post('/api/espacios/espacio', data);
      return this._extractData(response);
    } catch (error) {
      console.error('Error creando espacio:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Actualiza un espacio individual
   */
  async actualizarEspacio(espacioId, data) {
    try {
      const encodedId = encodeURIComponent(espacioId);
      const response = await this.client.put(`/api/espacios/espacio/${encodedId}`, data);
      return this._extractData(response);
    } catch (error) {
      console.error('Error actualizando espacio:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Elimina un espacio individual
   */
  async eliminarEspacio(espacioId, grupoId) {
    try {
      const encodedId = encodeURIComponent(espacioId);
      const response = await this.client.delete(`/api/espacios/espacio/${encodedId}?grupo_id=${grupoId}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error eliminando espacio:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de espacios de un grupo
   */
  async obtenerEstadisticasEspacios(grupo_id) {
    try {
      const response = await this.client.get(`/api/espacios/estadisticas?grupo_id=${grupo_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo estadísticas espacios:', error.apiError || error.message);
      throw error;
    }
  }

  // ============ GESTIÓN DE MIEMBROS ============

  /**
   * Lista miembros de un grupo
   */
  async listarMiembrosGrupo(grupoId) {
    try {
      const response = await this.client.get(`/api/grupos/${grupoId}/miembros`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error listando miembros:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Invita un miembro a un grupo
   */
  async invitarMiembro(grupo_id, email, rol) {
    try {
      const response = await this.client.post('/api/grupos/invitar', {
        grupo_id,
        email,
        rol
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error invitando miembro:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Actualiza el rol de un miembro
   */
  async actualizarRolMiembro(miembroId, grupo_id, rol) {
    try {
      const response = await this.client.put(`/api/grupos/miembro/${miembroId}/rol?grupo_id=${grupo_id}`, { new_role: rol });
      return this._extractData(response);
    } catch (error) {
      console.error('Error actualizando rol miembro:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Remueve un miembro de un grupo
   */
  async removerMiembro(miembroId, grupo_id) {
    try {
      const response = await this.client.delete(`/api/grupos/miembro/${miembroId}?grupo_id=${grupo_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error removiendo miembro:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Verifica una invitación
   */
  async verificarInvitacion(token) {
    try {
      const response = await this.client.get(`/api/invitaciones/verificar?token=${token}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error verificando invitación:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Acepta una invitación
   */
  async aceptarInvitacion(token) {
    try {
      const response = await this.client.post('/api/invitaciones/aceptar', { token });
      return this._extractData(response);
    } catch (error) {
      console.error('Error aceptando invitación:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  async checkPermission(grupo_id, permission) {
    try {
      const response = await this.client.post('/check-permission', {
        group_id: grupo_id,
        permission
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error verificando permiso:', error.apiError || error.message);
      throw error;
    }
  }

  // ============ GESTIÓN DE ESPECIALIDADES ============

  /**
   * Lista especialidades de un grupo
   */
  async listarEspecialidades(grupoId) {
    try {
      const response = await this.client.get(`/groups/${grupoId}/especialidades`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error listando especialidades:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Crea una nueva especialidad
   */
  async crearEspecialidad(grupoId, data) {
    try {
      const response = await this.client.post(`/groups/${grupoId}/especialidades`, data);
      return this._extractData(response);
    } catch (error) {
      console.error('Error creando especialidad:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Actualiza una especialidad
   */
  async actualizarEspecialidad(grupoId, especialidadId, data) {
    try {
      const response = await this.client.put(`/groups/${grupoId}/especialidades/${especialidadId}`, data);
      return this._extractData(response);
    } catch (error) {
      console.error('Error actualizando especialidad:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Elimina una especialidad
   */
  async eliminarEspecialidad(grupoId, especialidadId) {
    try {
      const response = await this.client.delete(`/groups/${grupoId}/especialidades/${especialidadId}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error eliminando especialidad:', error.apiError || error.message);
      throw error;
    }
  }

  // ============ GESTIÓN DE OCUPANTES ============

  /**
   * Lista ocupantes de un grupo
   */
  async listarOcupantes(grupoId) {
    try {
      const response = await this.client.get(`/groups/${grupoId}/ocupantes`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error listando ocupantes:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Crea un nuevo ocupante
   */
  async crearOcupante(grupoId, data) {
    try {
      const response = await this.client.post(`/groups/${grupoId}/ocupantes`, data);
      return this._extractData(response);
    } catch (error) {
      console.error('Error creando ocupante:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Actualiza un ocupante
   */
  async actualizarOcupante(grupoId, ocupanteId, data) {
    try {
      const response = await this.client.put(`/groups/${grupoId}/ocupantes/${ocupanteId}`, data);
      return this._extractData(response);
    } catch (error) {
      console.error('Error actualizando ocupante:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Elimina un ocupante
   */
  async eliminarOcupante(grupoId, ocupanteId) {
    try {
      const response = await this.client.delete(`/groups/${grupoId}/ocupantes/${ocupanteId}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error eliminando ocupante:', error.apiError || error.message);
      throw error;
    }
  }

  // ============ MÉTODOS DE AGENDA ============

  /**
   * Obtiene pasillos
   */
  async obtenerPasillos() {
    try {
      const response = await this.client.get('/api/pasillos');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo pasillos:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene boxes
   */
  async obtenerBoxes() {
    try {
      const response = await this.client.get('/api/boxes');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo boxes:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene especialidades
   */
  async obtenerEspecialidades() {
    try {
      const response = await this.client.get('/api/especialidades');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo especialidades:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene médicos
   */
  async obtenerMedicos() {
    try {
      const response = await this.client.get('/api/medicos');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo médicos:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene agenda por box
   */
  async obtenerAgendaPorBox(box_id) {
    try {
      const response = await this.client.get(`/api/agenda/box/${box_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo agenda por box:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene agenda por médico
   */
  async obtenerAgendaPorMedico(medico_id) {
    try {
      const response = await this.client.get(`/api/agenda/medico/${medico_id}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo agenda por médico:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene agenda por ID
   */
  async obtenerAgendaPorId(idAgenda) {
    try {
      const response = await this.client.get(`/api/agenda/${idAgenda}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo agenda por ID:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene agenda por box y fecha
   */
  async obtenerAgendaPorBoxYFecha(boxId, fecha) {
    try {
      const response = await this.client.get(`/api/agenda/box/${boxId}/fecha/${fecha}`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo agenda por box y fecha:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Verifica conflicto de box
   */
  async verificarConflictoBox(box_id, fecha, hora_inicio, hora_fin) {
    try {
      const response = await this.client.get('/api/agenda/conflicto/box', {
        params: { box_id, fecha, hora_inicio, hora_fin }
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error verificando conflicto box:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Verifica conflicto de médico
   */
  async verificarConflictoMedico(medico_id, fecha, hora_inicio, hora_fin) {
    try {
      const response = await this.client.get('/api/agenda/conflicto/medico', {
        params: { medico_id, fecha, hora_inicio, hora_fin }
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error verificando conflicto médico:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Inserta una agenda
   */
  async insertarAgenda(agendaInput) {
    try {
      const response = await this.client.post('/api/agenda', agendaInput);
      return this._extractData(response);
    } catch (error) {
      console.error('Error insertando agenda:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Actualiza estado de agenda
   */
  async actualizarEstadoAgenda(idAgenda, nuevoEstado) {
    try {
      const response = await this.client.put(`/api/agenda/${idAgenda}/estado`, {
        estado: nuevoEstado
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error actualizando estado agenda:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene estado no atendido
   */
  async obtenerEstadoNoAtendido() {
    try {
      const response = await this.client.get('/api/estados/no-atendido');
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo estado no atendido:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene consultas en curso
   */
  async obtenerConsultasEnCurso(hora_actual, estadosPermitidos) {
    try {
      const response = await this.client.get('/api/agenda/en-curso', {
        params: { hora_actual, estados: estadosPermitidos }
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo consultas en curso:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene instrumentos por box
   */
  async obtenerInstrumentosPorBox(boxId) {
    try {
      const response = await this.client.get(`/api/boxes/${boxId}/instrumentos`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo instrumentos por box:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene box y pasillo
   */
  async obtenerBoxYPasillo(boxId) {
    try {
      const response = await this.client.get(`/api/boxes/${boxId}/pasillo`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo box y pasillo:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene nombre de médico
   */
  async obtenerMedicoNombre(medicoId) {
    try {
      const response = await this.client.get(`/api/medicos/${medicoId}/nombre`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo nombre médico:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene nombre de box
   */
  async obtenerBoxNombre(boxId) {
    try {
      const response = await this.client.get(`/api/boxes/${boxId}/nombre`);
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo nombre box:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Marca todas las notificaciones como leídas
   */
  async marcarTodasLeidas() {
    try {
      const response = await this.client.put('/api/notificaciones/marcar-todas-leidas');
      return this._extractData(response);
    } catch (error) {
      console.error('Error marcando todas como leídas:', error.apiError || error.message);
      throw error;
    }
  }

  // ============ ESTADÍSTICAS Y REPORTES ============

  /**
   * Obtiene total de consultas
   */
  async obtenerTotalConsultas(filtros) {
    try {
      const response = await this.client.get('/api/estadisticas/total-consultas', {
        params: filtros
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo total consultas:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene especialidad más demandada
   */
  async obtenerEspecialidadMasDemandada(filtros) {
    try {
      const response = await this.client.get('/api/estadisticas/especialidad-mas-demandada', {
        params: filtros
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo especialidad más demandada:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene consultas por especialidad
   */
  async obtenerConsultasPorEspecialidad(filtros) {
    try {
      const response = await this.client.get('/api/estadisticas/consultas-por-especialidad', {
        params: filtros
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo consultas por especialidad:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene consultas por día
   */
  async obtenerConsultasPorDia(filtros) {
    try {
      const response = await this.client.get('/api/estadisticas/consultas-por-dia', {
        params: filtros
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo consultas por día:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene rendimiento de médicos
   */
  async obtenerRendimientoMedicos(filtros) {
    try {
      const response = await this.client.get('/api/estadisticas/rendimiento-medicos', {
        params: filtros
      });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo rendimiento médicos:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene appointments en un rango de fechas
   */
  async obtenerAppointmentsRango(grupo_id, fechaInicio, fechaFin) {
    try {
      const response = await this.client.get(`/groups/${grupo_id}/appointments`, {
        params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
      });
      const data = this._extractData(response);
      // El Lambda devuelve { ok, appointments, count }, necesitamos el array
      return data.appointments || [];
    } catch (error) {
      console.error('Error obteniendo appointments rango:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene boxes disponibles
   */
  async obtenerBoxesDisponibles(boxes) {
    try {
      const response = await this.client.post('/api/boxes/disponibles', { boxes });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo boxes disponibles:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Obtiene médicos por especialidades
   */
  async obtenerMedicosPorEspecialidades(especialidades) {
    try {
      const response = await this.client.post('/api/medicos/por-especialidades', { especialidades });
      return this._extractData(response);
    } catch (error) {
      console.error('Error obteniendo médicos por especialidades:', error.apiError || error.message);
      throw error;
    }
  }

  /**
   * Método genérico fetch (compatibilidad con apiClient original)
   */
  async fetch(path, options = {}) {
    try {
      const response = await this.client.get(path, options);
      return this._extractData(response);
    } catch (error) {
      console.error(`Error en fetch(${path}):`, error.apiError || error.message);
      return { ok: false, error: error.message };
    }
  }

  // Mantener compatibilidad con apiClient original
  // (todos los métodos del archivo original siguen funcionando)
}

module.exports = ApiClientV2;
