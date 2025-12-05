/**
 * In-Memory Cache Layer
 * 
 * Cache con TTL para datos frecuentemente accedidos:
 * - Permisos de roles
 * - Configuración del sistema
 * - Datos de referencia
 * - Resultados de queries costosas
 */

const { Logger } = require('./logger');

class CacheEntry {
  constructor(value, ttl) {
    this.value = value;
    this.expiresAt = Date.now() + ttl;
    this.createdAt = Date.now();
    this.hits = 0;
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  touch() {
    this.hits++;
  }

  getAge() {
    return Date.now() - this.createdAt;
  }
}

class Cache {
  constructor(options = {}) {
    this.cache = new Map();
    this.config = {
      defaultTTL: options.defaultTTL || 300000, // 5 minutos
      maxSize: options.maxSize || 1000,
      cleanupInterval: options.cleanupInterval || 60000, // 1 minuto
      enableStats: options.enableStats !== false
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expirations: 0
    };

    this.logger = new Logger({ component: 'Cache' });

    // Iniciar cleanup periódico
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }
  }

  /**
   * Obtiene valor del cache
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (entry.isExpired()) {
      this.cache.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return null;
    }

    entry.touch();
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Almacena valor en cache
   */
  set(key, value, ttl = null) {
    // Si cache está lleno, evict el menos usado
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const actualTTL = ttl || this.config.defaultTTL;
    const entry = new CacheEntry(value, actualTTL);
    this.cache.set(key, entry);
    this.stats.sets++;

    this.logger.debug('Cache set', { key, ttl: actualTTL });
  }

  /**
   * Elimina valor del cache
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this.logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  /**
   * Verifica si key existe y no ha expirado
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.isExpired()) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }
    return true;
  }

  /**
   * Limpia entradas expiradas
   */
  cleanup() {
    const before = this.cache.size;
    let expired = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.isExpired()) {
        this.cache.delete(key);
        expired++;
      }
    }

    if (expired > 0) {
      this.stats.expirations += expired;
      this.logger.debug('Cache cleanup', { 
        before, 
        after: this.cache.size, 
        expired 
      });
    }
  }

  /**
   * Evict LRU (Least Recently Used)
   */
  evictLRU() {
    let oldestKey = null;
    let oldestHits = Infinity;
    let oldestAge = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Priorizar items con menos hits y más viejos
      const score = entry.hits + (entry.getAge() / 1000);
      if (score < oldestHits) {
        oldestHits = score;
        oldestKey = key;
        oldestAge = entry.getAge();
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      this.logger.debug('Cache eviction (LRU)', { 
        key: oldestKey, 
        hits: oldestHits,
        age: oldestAge
      });
    }
  }

  /**
   * Limpia todo el cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared', { entriesCleared: size });
  }

  /**
   * Obtiene estadísticas del cache
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: `${hitRate}%`,
      utilizationRate: `${((this.cache.size / this.config.maxSize) * 100).toFixed(2)}%`
    };
  }

  /**
   * Reset estadísticas
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      expirations: 0
    };
  }

  /**
   * Wrapper para get-or-fetch pattern
   */
  async getOrFetch(key, fetchFn, ttl = null) {
    let value = this.get(key);
    
    if (value !== null) {
      return value;
    }

    // Cache miss - fetch value
    value = await fetchFn();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Wrapper para memoización de funciones
   */
  memoize(fn, keyGenerator, ttl = null) {
    return async (...args) => {
      const key = keyGenerator(...args);
      return await this.getOrFetch(key, () => fn(...args), ttl);
    };
  }

  /**
   * Destructor
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

/**
 * Caches especializados
 */

// Cache global para permisos (TTL: 10 min)
const permissionsCache = new Cache({
  defaultTTL: 600000,
  maxSize: 500
});

// Cache para configuración del sistema (TTL: 15 min)
const configCache = new Cache({
  defaultTTL: 900000,
  maxSize: 200
});

// Cache para datos de usuario (TTL: 5 min)
const userDataCache = new Cache({
  defaultTTL: 300000,
  maxSize: 1000
});

// Cache para queries de DynamoDB (TTL: 2 min)
const queryCache = new Cache({
  defaultTTL: 120000,
  maxSize: 500
});

/**
 * Helpers para casos de uso comunes
 */

/**
 * Cache permissions para un role
 */
async function cacheRolePermissions(role, fetchFn) {
  const key = `permissions:role:${role}`;
  return await permissionsCache.getOrFetch(key, fetchFn);
}

/**
 * Cache permissions para un usuario
 */
async function cacheUserPermissions(userSub, fetchFn) {
  const key = `permissions:user:${userSub}`;
  return await permissionsCache.getOrFetch(key, fetchFn);
}

/**
 * Invalida cache de permisos para un role
 */
function invalidateRolePermissions(role) {
  return permissionsCache.delete(`permissions:role:${role}`);
}

/**
 * Invalida cache de permisos para un usuario
 */
function invalidateUserPermissions(userSub) {
  return permissionsCache.delete(`permissions:user:${userSub}`);
}

/**
 * Cache configuración del sistema
 */
async function cacheSystemConfig(key, fetchFn) {
  return await configCache.getOrFetch(`config:${key}`, fetchFn);
}

/**
 * Invalida configuración del sistema
 */
function invalidateSystemConfig(key) {
  return configCache.delete(`config:${key}`);
}

/**
 * Cache user data
 */
async function cacheUserData(userSub, fetchFn) {
  const key = `user:${userSub}`;
  return await userDataCache.getOrFetch(key, fetchFn);
}

/**
 * Invalida user data
 */
function invalidateUserData(userSub) {
  return userDataCache.delete(`user:${userSub}`);
}

/**
 * Cache query result
 */
async function cacheQueryResult(queryKey, fetchFn, ttl = null) {
  return await queryCache.getOrFetch(queryKey, fetchFn, ttl);
}

/**
 * Obtiene stats de todos los caches
 */
function getAllCacheStats() {
  return {
    permissions: permissionsCache.getStats(),
    config: configCache.getStats(),
    userData: userDataCache.getStats(),
    query: queryCache.getStats()
  };
}

/**
 * Limpia todos los caches
 */
function clearAllCaches() {
  permissionsCache.clear();
  configCache.clear();
  userDataCache.clear();
  queryCache.clear();
}

module.exports = {
  // Class
  Cache,
  
  // Specialized caches
  permissionsCache,
  configCache,
  userDataCache,
  queryCache,
  
  // Helpers
  cacheRolePermissions,
  cacheUserPermissions,
  invalidateRolePermissions,
  invalidateUserPermissions,
  cacheSystemConfig,
  invalidateSystemConfig,
  cacheUserData,
  invalidateUserData,
  cacheQueryResult,
  getAllCacheStats,
  clearAllCaches
};
