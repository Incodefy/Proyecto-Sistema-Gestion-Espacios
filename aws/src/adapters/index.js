/**
 * Adapter Registry - Factory Pattern para ACL
 * 
 * Centraliza la creación y gestión de adaptadores del Anti-Corruption Layer.
 * 
 * Propósito:
 * - Singleton management para todos los adaptadores
 * - Configuración centralizada
 * - Dependency injection para testing
 * - Lazy initialization
 * 
 * Beneficios:
 * - Un solo punto de configuración
 * - Fácil mockeo en tests
 * - Control de instancias (memoria)
 * - Hot-swapping de adaptadores (dev/prod)
 */

const { getUserAdapter, UserAdapter } = require('./userAdapter');
const { getEmailAdapter, EmailAdapter } = require('./emailAdapter');
const { getAuthAdapter, AuthAdapter } = require('./authAdapter');
const { createLogger } = require('../utils/logger');

class AdapterRegistry {
  constructor(config = {}) {
    this.config = config;
    this.adapters = new Map();
    this.logger = config.logger || createLogger({ component: 'AdapterRegistry' });
    this.logger.debug('Adapter registry initialized');
  }

  /**
   * Obtiene UserAdapter (singleton)
   * @returns {UserAdapter}
   */
  getUserAdapter() {
    if (!this.adapters.has('user')) {
      this.logger.debug('Creating UserAdapter instance');
      const adapter = getUserAdapter({
        userPoolId: this.config.userPoolId || process.env.USER_POOL_ID,
        cognitoClient: this.config.cognitoClient,
        logger: this.logger.child({ adapter: 'user' })
      });
      this.adapters.set('user', adapter);
    }
    return this.adapters.get('user');
  }

  /**
   * Obtiene EmailAdapter (singleton)
   * @returns {EmailAdapter}
   */
  getEmailAdapter() {
    if (!this.adapters.has('email')) {
      this.logger.debug('Creating EmailAdapter instance');
      const adapter = getEmailAdapter({
        fromEmail: this.config.fromEmail || process.env.SES_FROM_EMAIL,
        sesClient: this.config.sesClient,
        logger: this.logger.child({ adapter: 'email' })
      });
      this.adapters.set('email', adapter);
    }
    return this.adapters.get('email');
  }

  /**
   * Obtiene AuthAdapter (singleton)
   * @returns {AuthAdapter}
   */
  getAuthAdapter() {
    if (!this.adapters.has('auth')) {
      this.logger.debug('Creating AuthAdapter instance');
      const adapter = getAuthAdapter({
        userPoolId: this.config.userPoolId || process.env.USER_POOL_ID,
        clientId: this.config.clientId || process.env.USER_POOL_CLIENT_ID,
        cognitoClient: this.config.cognitoClient,
        logger: this.logger.child({ adapter: 'auth' })
      });
      this.adapters.set('auth', adapter);
    }
    return this.adapters.get('auth');
  }

  /**
   * Registra adaptador custom (para extensiones futuras)
   * @param {string} name - Nombre del adaptador
   * @param {Object} adapter - Instancia del adaptador
   */
  register(name, adapter) {
    this.logger.debug('Registering custom adapter', { name });
    this.adapters.set(name, adapter);
  }

  /**
   * Obtiene adaptador custom
   * @param {string} name - Nombre del adaptador
   * @returns {Object|null}
   */
  get(name) {
    return this.adapters.get(name) || null;
  }

  /**
   * Limpia todos los adaptadores (útil para testing)
   */
  clear() {
    this.logger.debug('Clearing all adapters');
    this.adapters.clear();
  }

  /**
   * Lista adaptadores registrados
   * @returns {string[]}
   */
  list() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Health check de todos los adaptadores
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      adapters: {}
    };

    for (const [name, adapter] of this.adapters.entries()) {
      try {
        // Verificar que el adaptador está disponible
        health.adapters[name] = {
          status: 'healthy',
          type: adapter.constructor.name
        };
      } catch (error) {
        health.adapters[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return health;
  }
}

// ========== SINGLETON GLOBAL ==========

let _registry = null;

/**
 * Obtiene instancia global del registry
 * @param {Object} config - Configuración (solo usado en primera llamada)
 * @returns {AdapterRegistry}
 */
function getAdapterRegistry(config = {}) {
  if (!_registry) {
    _registry = new AdapterRegistry(config);
  }
  return _registry;
}

/**
 * Resetea registry (solo para testing)
 */
function resetAdapterRegistry() {
  if (_registry) {
    _registry.clear();
  }
  _registry = null;
}

// ========== CONVENIENCE EXPORTS ==========

/**
 * Shortcuts para obtener adaptadores directamente
 * Uso: const { users, emails, auth } = require('./adapters');
 */
function createAdapterAPI() {
  const registry = getAdapterRegistry();
  
  return {
    // Adaptadores principales
    users: registry.getUserAdapter(),
    emails: registry.getEmailAdapter(),
    auth: registry.getAuthAdapter(),
    
    // Registry completo (para casos avanzados)
    registry,
    
    // Health check
    healthCheck: () => registry.healthCheck()
  };
}

// ========== EXPORTS ==========

module.exports = {
  // Registry
  AdapterRegistry,
  getAdapterRegistry,
  resetAdapterRegistry,
  
  // Convenience API
  createAdapterAPI,
  
  // Individual adapters (re-export)
  getUserAdapter,
  getEmailAdapter,
  getAuthAdapter,
  UserAdapter,
  EmailAdapter,
  AuthAdapter
};
