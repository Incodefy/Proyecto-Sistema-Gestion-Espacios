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

  // ============ AGENDA ============
  async obtenerAgendaPorFecha(fecha) {
    const response = await this.client.get('/db/agenda', {
      params: { fecha }
    });
    return response.data;
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
  async obtenerNotificaciones() {
    const response = await this.client.get('/db/notificaciones');
    return response.data;
  }

  // ============ ESTADÍSTICAS ============
  async obtenerTotalConsultas(filtros) {
    const response = await this.client.post('/db/total-consultas', filtros);
    return response.data.total;
  }

  async obtenerBoxesDisponibles(boxes) {
    const response = await this.client.post('/db/boxes-disponibles', { boxes });
    return response.data;
  }

  async obtenerEspecialidadMasDemandada(filtros) {
    const response = await this.client.post('/db/especialidad-mas-demandada', filtros);
    return response.data;
  }

  async obtenerConsultasPorEspecialidad(filtros) {
    const response = await this.client.post('/db/consultas-especialidad', filtros);
    return response.data;
  }

  async obtenerConsultasPorDia(filtros) {
    const response = await this.client.post('/db/consultas-dia', filtros);
    return response.data;
  }

  async obtenerRendimientoMedicos(filtros) {
    const response = await this.client.post('/db/rendimiento-medicos', filtros);
    return response.data;
  }

  async obtenerMedicosPorEspecialidades(especialidades) {
    const response = await this.client.post('/db/medicos-especialidades', {
      especialidades
    });
    return response.data;
  }
}

module.exports = ApiClient;