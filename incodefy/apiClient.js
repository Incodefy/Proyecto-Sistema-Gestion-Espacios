require('dotenv').config();
const axios = require('axios');

/**
 * Cliente API para comunicarse con el backend de Lambda
 * Requiere el token de autorización del usuario
 */
class ApiClient {
  constructor(token) {
    this.token = token;
    this.baseURL = process.env.API_BASE_URL;
    
    // Crear instancia de axios con configuración base
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar el token automáticamente
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para manejar errores
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          console.error(`❌ Error API [${error.response.status}]:`, error.response.data);
          
          // Si es 401, el token expiró
          if (error.response.status === 401) {
            console.error('🔒 Token expirado o inválido');
          }
        } else if (error.request) {
          console.error('❌ No se recibió respuesta del servidor');
        } else {
          console.error('❌ Error en la petición:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  // ============ CATÁLOGO ============
  async obtenerPasillos() {
    const response = await this.client.get('/db/pasillos');
    return response.data;
  }

  async obtenerBoxes() {
    const response = await this.client.get('/db/boxes');
    return response.data;
  }

  async obtenerEspecialidades() {
    const response = await this.client.get('/db/especialidades');
    return response.data;
  }

  async obtenerMedicos() {
    const response = await this.client.get('/db/medicos');
    return response.data;
  }

  // ============ AGENDA (MIGRADO A APPOINTMENTS) ============
  /**
   * Obtiene appointments por fecha usando la nueva API
   * Requiere que el usuario tenga un grupo activo
   * @param {string} fecha - Fecha en formato YYYY-MM-DD
   * @param {string} grupo_id - ID del grupo (opcional, se puede obtener del contexto)
   * @returns {Promise<Array>} - Lista de appointments
   */
  async obtenerAgendaPorFecha(fecha, grupo_id = null) {
    try {
      // Si no se proporciona grupo_id, intentar obtener el grupo activo
      if (!grupo_id) {
        const grupoActivoResponse = await this.obtenerGrupoActivo();
        if (grupoActivoResponse && grupoActivoResponse.grupo_activo) {
          grupo_id = grupoActivoResponse.grupo_activo.grupo_id;
        } else {
          console.warn('⚠️ No hay grupo activo, retornando array vacío');
          return [];
        }
      }

      const response = await this.client.get(`/groups/${grupo_id}/appointments`, {
        params: { fecha }
      });
      
      // La nueva API retorna { ok, appointments, total }
      return response.data.appointments || [];
    } catch (error) {
      console.error('❌ Error obteniendo appointments por fecha:', error.message);
      // Retornar array vacío en caso de error para no romper la UI
      return [];
    }
  }

  async obtenerAgendaPorBox(box_id) {
    const response = await this.client.get('/db/agenda-box', {
      params: { box_id }
    });
    return response.data;
  }

  async obtenerAgendaPorMedico(medico_id) {
    const response = await this.client.get('/db/agenda-medico', {
      params: { medico_id }
    });
    return response.data;
  }

  async obtenerAgendaPorId(idAgenda) {
    const response = await this.client.get('/db/agenda-id', {
      params: { idAgenda }
    });
    return response.data;
  }

  async obtenerAgendaPorBoxYFecha(boxId, fecha) {
    const response = await this.client.get('/db/agenda-box-fecha', {
      params: { boxId, fecha }
    });
    return response.data;
  }

  // ============ VERIFICACIONES ============
  async verificarConflictoBox(box_id, fecha, hora_inicio, hora_fin) {
    const response = await this.client.get('/db/conflicto-box', {
      params: { box_id, fecha, hora_inicio, hora_fin }
    });
    return response.data;
  }

  async verificarConflictoMedico(medico_id, fecha, hora_inicio, hora_fin) {
    const response = await this.client.get('/db/conflicto-medico', {
      params: { medico_id, fecha, hora_inicio, hora_fin }
    });
    return response.data;
  }

  // ============ OPERACIONES DE AGENDA ============
  async insertarAgenda(agendaInput) {
    const response = await this.client.post('/db/insertar-agenda', agendaInput);
    return response.data;
  }

  async actualizarEstadoAgenda(idAgenda, nuevoEstado) {
    const response = await this.client.post('/db/nuevo-estado-agenda', {
      idAgenda,
      nuevoEstado
    });
    return response.data;
  }

  async obtenerEstadoNoAtendido() {
    const response = await this.client.get('/db/estado-no-atendido');
    return response.data;
  }

  // ============ CONSULTAS EN CURSO ============
  async obtenerConsultasEnCurso(hora_actual, estadosPermitidos) {
    const response = await this.client.get('/db/consultas-en-curso', {
      params: {
        hora_actual,
        estadosPermitidos: estadosPermitidos.join(",")
      }
    });
    return response.data;
  }

  // ============ INSTRUMENTOS ============
  async obtenerInstrumentosPorBox(boxId) {
    const response = await this.client.get('/db/instrumentos-box', {
      params: { boxId }
    });
    return response.data;
  }

  // ============ INFORMACIÓN ADICIONAL ============
  async obtenerBoxYPasillo(boxId) {
    const response = await this.client.get('/db/box-pasillo', {
      params: { boxId }
    });
    return response.data;
  }

  async obtenerMedicoNombre(medicoId) {
    const response = await this.client.get('/db/medico-nombre', {
      params: { medicoId }
    });
    return response.data.nombre;
  }

  async obtenerBoxNombre(boxId) {
    const response = await this.client.get('/db/box-nombre', {
      params: { medicoId: boxId } // Nota: el API original usa 'medicoId' para boxId
    });
    return response.data.nombre;
  }

  // ============ NOTIFICACIONES ============
  /**
   * Obtiene las notificaciones del usuario autenticado
   * @param {Object} filtros - { limit, grupo_id, solo_no_leidas }
   * @returns {Promise<Array>} - Lista de notificaciones
   */
  async obtenerNotificaciones(filtros = {}) {
    const params = new URLSearchParams();
    
    if (filtros.limit) params.append('limit', filtros.limit);
    if (filtros.grupo_id) params.append('grupo_id', filtros.grupo_id);
    if (filtros.solo_no_leidas) params.append('solo_no_leidas', 'true');
    
    const url = `/notifications${params.toString() ? '?' + params.toString() : ''}`;
    const response = await this.client.get(url);
    return response.data;
  }

  /**
   * Marca una notificación como leída
   * @param {string} notificationId - ID de la notificación
   * @returns {Promise<Object>} - Respuesta del servidor
   */
  async marcarNotificacionLeida(notificationId) {
    const response = await this.client.put(`/notifications/${notificationId}/read`);
    return response.data;
  }

  /**
   * Marca todas las notificaciones como leídas
   * @returns {Promise<Object>} - Respuesta del servidor
   */
  async marcarTodasLeidas() {
    const response = await this.client.put('/notifications/read-all');
    return response.data;
  }

  // ============ ESTADÍSTICAS (USANDO NUEVA TABLA APPOINTMENTS) ============
  /**
   * Obtiene el total de consultas (appointments) en un rango de fechas
   * @param {object} filtros - { fechaInicio, fechaFin, grupo_id }
   * @returns {Promise<number>} - Total de consultas
   */
  async obtenerTotalConsultas(filtros) {
    try {
      const { fechaInicio, fechaFin, grupo_id } = filtros;
      
      if (!grupo_id) {
        console.warn('⚠️ obtenerTotalConsultas: grupo_id es requerido');
        return 0;
      }

      // Obtener appointments del rango de fechas
      const appointments = await this.obtenerAppointmentsRango(grupo_id, fechaInicio, fechaFin);
      return appointments.length;
    } catch (error) {
      console.error('❌ Error en obtenerTotalConsultas:', error.message);
      return 0;
    }
  }

  /**
   * Obtiene la especialidad más demandada en un período
   * @param {object} filtros - { fechaInicio, fechaFin, grupo_id }
   * @returns {Promise<object>} - { nombre, consultas }
   */
  async obtenerEspecialidadMasDemandada(filtros) {
    try {
      const { fechaInicio, fechaFin, grupo_id } = filtros;
      
      if (!grupo_id) {
        console.warn('⚠️ obtenerEspecialidadMasDemandada: grupo_id es requerido');
        return null;
      }

      const appointments = await this.obtenerAppointmentsRango(grupo_id, fechaInicio, fechaFin);
      
      // Agrupar por especialidad
      const porEspecialidad = {};
      appointments.forEach(apt => {
        const esp = apt.especialidad_nombre || 'Sin especialidad';
        porEspecialidad[esp] = (porEspecialidad[esp] || 0) + 1;
      });

      // Encontrar la más demandada
      let maxEsp = null;
      let maxCount = 0;
      for (const [nombre, consultas] of Object.entries(porEspecialidad)) {
        if (consultas > maxCount) {
          maxCount = consultas;
          maxEsp = nombre;
        }
      }

      return maxEsp ? { nombre: maxEsp, consultas: maxCount } : null;
    } catch (error) {
      console.error('❌ Error en obtenerEspecialidadMasDemandada:', error.message);
      return null;
    }
  }

  /**
   * Obtiene consultas agrupadas por especialidad
   * @param {object} filtros - { fechaInicio, fechaFin, grupo_id }
   * @returns {Promise<Array>} - [{ nombre, consultas }, ...]
   */
  async obtenerConsultasPorEspecialidad(filtros) {
    try {
      const response = await this.client.post('/db/obtener-consultas-por-especialidad', filtros);
      return response.data;
    } catch (error) {
      console.error('❌ Error en obtenerConsultasPorEspecialidad:', error.message);
      return [];
    }
  }

  /**
   * Obtiene consultas agrupadas por día de la semana
   * @param {object} filtros - { fechaInicio, fechaFin, grupo_id }
   * @returns {Promise<Array>} - [lun, mar, mie, jue, vie, sab, dom]
   */
  async obtenerConsultasPorDia(filtros) {
    try {
      const response = await this.client.post('/db/obtener-consultas-por-dia', filtros);
      return response.data;
    } catch (error) {
      console.error('❌ Error en obtenerConsultasPorDia:', error.message);
      return [0, 0, 0, 0, 0, 0, 0];
    }
  }

  /**
   * Obtiene rendimiento de ocupantes (médicos/profesores/etc)
   * @param {object} filtros - { fechaInicio, fechaFin, grupo_id }
   * @returns {Promise<Array>} - [{ nombre, especialidad, consultas }, ...]
   */
  async obtenerRendimientoMedicos(filtros) {
    try {
      const response = await this.client.post('/db/obtener-rendimiento-medicos', filtros);
      return response.data;
    } catch (error) {
      console.error('❌ Error en obtenerRendimientoMedicos:', error.message);
      return [];
    }
  }

  /**
   * Método auxiliar para obtener appointments en un rango de fechas
   * Optimizado con cache en memoria para evitar requests duplicadas
   * @param {string} grupo_id - ID del grupo
   * @param {string} fechaInicio - Fecha inicio (YYYY-MM-DD)
   * @param {string} fechaFin - Fecha fin (YYYY-MM-DD)
   * @returns {Promise<Array>} - Lista de appointments
   */
  async obtenerAppointmentsRango(grupo_id, fechaInicio, fechaFin) {
    try {
      // ✅ Cache optimizado con TTL configurable
      const CACHE_TTL = 30000; // 30 segundos
      const cacheKey = `${grupo_id}:${fechaInicio}:${fechaFin}`;
      const now = Date.now();
      
      if (!this._appointmentsCache) {
        this._appointmentsCache = {};
        this._cacheStats = { hits: 0, misses: 0 };
      }
      
      // Verificar cache y expiración
      const cached = this._appointmentsCache[cacheKey];
      if (cached && (now - cached.timestamp < CACHE_TTL)) {
        this._cacheStats.hits++;
        console.log(`📦 Cache HIT para appointments ${fechaInicio} - ${fechaFin} (hits: ${this._cacheStats.hits}, misses: ${this._cacheStats.misses})`);
        return cached.data;
      }
      
      this._cacheStats.misses++;
      console.log(`🔍 Cache MISS para appointments ${fechaInicio} - ${fechaFin}`);
      
      const allAppointments = [];
      
      // Generar todas las fechas del rango
      const fechas = this.generarRangoFechas(fechaInicio, fechaFin);
      
      console.log(`🔄 Obteniendo appointments para ${fechas.length} fechas...`);
      const startTime = Date.now();
      
      // ✅ Aumentar concurrencia de 3 a 5 para mayor throughput
      const batchSize = 5;
      for (let i = 0; i < fechas.length; i += batchSize) {
        const batch = fechas.slice(i, i + batchSize);
        
        const promises = batch.map(fecha => 
          this.client.get(`/groups/${grupo_id}/appointments`, {
            params: { fecha }
          })
          .then(response => response.data.appointments || [])
          .catch(err => {
            console.warn(`⚠️ Error obteniendo appointments para ${fecha}:`, err.message);
            return [];
          })
        );

        const results = await Promise.all(promises);
        results.forEach(appointments => allAppointments.push(...appointments));
        
        // ✅ Reducir pausa de 50ms a 20ms para mejorar velocidad
        if (i + batchSize < fechas.length) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }

      const endTime = Date.now();
      console.log(`✅ Obtenidos ${allAppointments.length} appointments en ${endTime - startTime}ms`);
      
      // Guardar en cache
      this._appointmentsCache[cacheKey] = {
        data: allAppointments,
        timestamp: now
      };
      
      // ✅ Limpieza inteligente de cache: eliminar entradas expiradas
      const CACHE_MAX_AGE = 300000; // 5 minutos
      let cleaned = 0;
      Object.keys(this._appointmentsCache).forEach(key => {
        if (now - this._appointmentsCache[key].timestamp > CACHE_MAX_AGE) {
          delete this._appointmentsCache[key];
          cleaned++;
        }
      });
      
      if (cleaned > 0) {
        console.log(`🧹 Cache limpiado: ${cleaned} entradas expiradas eliminadas`);
      }
      
      return allAppointments;
    } catch (error) {
      console.error('❌ Error en obtenerAppointmentsRango:', error.message);
      return [];
    }
  }

  /**
   * Genera un array de fechas entre inicio y fin
   * @param {string} inicio - Fecha inicio (YYYY-MM-DD)
   * @param {string} fin - Fecha fin (YYYY-MM-DD)
   * @returns {Array<string>} - Array de fechas
   */
  generarRangoFechas(inicio, fin) {
    const fechas = [];
    const fechaActual = new Date(inicio);
    const fechaFinal = new Date(fin);

    while (fechaActual <= fechaFinal) {
      fechas.push(fechaActual.toISOString().split('T')[0]);
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    return fechas;
  }

  async obtenerBoxesDisponibles(boxes) {
    const response = await this.client.post('/db/boxes-disponibles', { boxes });
    return response.data;
  }

  async obtenerMedicosPorEspecialidades(especialidades) {
    const response = await this.client.post('/db/medicos-especialidades', {
      especialidades
    });
    return response.data;
  }

  // ============ CONFIGURACIÓN DE ESPACIOS (ONBOARDING) ============
  async crearGrupo(nombre) {    
    try {
      const response = await this.client.post('/groups', {
        name: nombre
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        console.error('Headers:', error.response.headers);
      }
      throw error;
    }
  }

  async guardarEspacios(grupo_id, espacios, ocupantes = [], especialidades = [], tiposInstrumentos = [], instrumentos = []) {
    const response = await this.client.post(`/groups/${grupo_id}/spaces`, {
      grupo_id,
      espacios,
      especialidades,
      ocupantes,
      tipos_instrumentos: tiposInstrumentos,
      instrumentos
    });
    return response.data;
  }

  async obtenerConfiguracionEspacios(grupo_id) {
    const response = await this.client.get('/api/espacios/configuracion', {
      params: { grupo_id }
    });
    return response.data;
  }

  async listarEspacios(grupo_id) {
    const response = await this.client.get('/api/espacios/lista', {
      params: { grupo_id }
    });
    return response.data;
  }

  async crearEspacio(data) {
    const response = await this.client.post('/api/espacios/espacio', data);
    return response.data;
  }

  async actualizarEspacio(espacioId, data) {
    const encodedId = encodeURIComponent(espacioId);
    const response = await this.client.put(`/api/espacios/espacio/${encodedId}`, data);
    return response.data;
  }

  async eliminarEspacio(espacioId, grupoId) {
    const encodedId = encodeURIComponent(espacioId);
    const response = await this.client.delete(`/api/espacios/espacio/${encodedId}`, {
      params: { grupo_id: grupoId }
    });
    return response.data;
  }

  async asignarGrupoActivo(grupo_id) {
    const response = await this.client.put('/api/espacios/asignar-grupo', {
      grupo_id
    });
    return response.data;
  }

  async obtenerGrupoActivo() {
    const response = await this.client.get('/api/espacios/grupo-activo');
    return response.data;
  }

  async eliminarConfiguracionEspacios(grupo_id) {
    const response = await this.client.delete('/api/espacios/configuracion', {
      params: { grupo_id }
    });
    return response.data;
  }

  async obtenerEstadisticasEspacios(grupo_id) {
    const response = await this.client.get('/api/espacios/estadisticas', {
      params: { grupo_id }
    });
    return response.data;
  }

  async listarGruposUsuario() {
    const response = await this.client.get('/groups');
    return response.data;
  }

  async obtenerGrupo(grupoId) {
    const response = await this.client.get(`/grupos/${grupoId}`);
    return response.data;
  }

  async actualizarNomenclaturaGrupo(grupoId, nomenclatura) {
    const response = await this.client.put(`/grupos/${grupoId}/nomenclatura`, {
      nomenclatura
    });
    return response.data;
  }

  // ============ GESTIÓN DE MIEMBROS ============
  async listarMiembrosGrupo(grupoId) {
    const response = await this.client.get(`/api/grupos/${grupoId}/miembros`);
    return response.data;
  }

  async invitarMiembro(grupo_id, email, rol) {
    const response = await this.client.post('/api/grupos/invitar', {
      grupo_id,
      email,
      rol
    });
    return response.data;
  }

  async actualizarRolMiembro(miembroId, grupo_id, rol) {
    const response = await this.client.put(`/api/grupos/miembro/${miembroId}/rol`, 
      { rol },
      { params: { grupo_id } }
    );
    return response.data;
  }

  async removerMiembro(miembroId, grupo_id) {
    const response = await this.client.delete(`/api/grupos/miembro/${miembroId}`, {
      params: { grupo_id }
    });
    return response.data;
  }

  async verificarInvitacion(token) {
    const response = await this.client.get(`/api/invitaciones/verificar?token=${token}`);
    return response.data;
  }

  async aceptarInvitacion(token) {
    const response = await this.client.post('/api/invitaciones/aceptar', { token });
    return response.data;
  }

  // ============ MÉTODO GENÉRICO FETCH ============
  /**
   * Método genérico para hacer peticiones GET
   * @param {string} path - Ruta relativa (ej: '/groups/123/appointments')
   * @param {object} options - Opciones adicionales (headers, params, etc)
   * @returns {Promise<object>} - Respuesta del servidor
   */
  async fetch(path, options = {}) {
    try {
      const response = await this.client.get(path, options);
      return response.data;
    } catch (error) {
      console.error(`❌ Error en fetch(${path}):`, error.message);
      return { ok: false, error: error.message };
    }
  }

}

module.exports = ApiClient;