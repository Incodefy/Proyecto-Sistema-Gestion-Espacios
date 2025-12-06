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
        espacios,
        ocupantes,
        especialidades,
        tiposInstrumentos,
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

  // Mantener compatibilidad con apiClient original
  // (todos los métodos del archivo original siguen funcionando)
}

module.exports = ApiClientV2;
