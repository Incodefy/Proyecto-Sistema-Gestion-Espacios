/**
 * Cache Manager - Sistema de caché en memoria optimizado
 * Usa node-cache para mejorar performance
 */

const NodeCache = require('node-cache');
const { Logger } = require('./logger');

const logger = new Logger('CacheManager');

// Configuración de caches con diferentes TTL según tipo de dato
const caches = {
  // Cache de estados de espacios (30 segundos - alta volatilidad)
  estados: new NodeCache({ 
    stdTTL: 30,
    checkperiod: 10,
    useClones: false // Mejor performance, pero cuidado con mutaciones
  }),
  
  // Cache de agendas/appointments (1 minuto)
  agendas: new NodeCache({ 
    stdTTL: 60,
    checkperiod: 20,
    useClones: false
  }),
  
  // Cache de nomenclatura y configuración (5 minutos - baja volatilidad)
  config: new NodeCache({ 
    stdTTL: 300,
    checkperiod: 60,
    useClones: false
  }),
  
  // Cache de espacios y estructura (2 minutos)
  espacios: new NodeCache({ 
    stdTTL: 120,
    checkperiod: 30,
    useClones: false
  })
};

class CacheManager {
  /**
   * Obtiene un valor del cache
   * @param {string} cacheName - Nombre del cache (estados, agendas, config, espacios)
   * @param {string} key - Clave del valor
   * @returns {any|undefined} - Valor en cache o undefined
   */
  static get(cacheName, key) {
    try {
      const cache = caches[cacheName];
      if (!cache) {
        console.warn(`⚠️ Cache desconocido: ${cacheName}`);
        return undefined;
      }
      
      const value = cache.get(key);
      if (value !== undefined) {
        console.log(`✅ Cache HIT: ${cacheName}:${key}`);
      }
      return value;
    } catch (error) {
      console.error(`❌ Error obteniendo cache ${cacheName}:${key}:`, error);
      return undefined;
    }
  }

  /**
   * Establece un valor en el cache
   * @param {string} cacheName - Nombre del cache
   * @param {string} key - Clave del valor
   * @param {any} value - Valor a cachear
   * @param {number} [ttl] - TTL personalizado en segundos (opcional)
   */
  static set(cacheName, key, value, ttl) {
    try {
      const cache = caches[cacheName];
      if (!cache) {
        console.warn(`⚠️ Cache desconocido: ${cacheName}`);
        return false;
      }
      
      const success = cache.set(key, value, ttl);
      if (success) {
        console.log(`💾 Cache SET: ${cacheName}:${key} (TTL: ${ttl || 'default'}s)`);
      }
      return success;
    } catch (error) {
      console.error(`❌ Error guardando cache ${cacheName}:${key}:`, error);
      return false;
    }
  }

  /**
   * Invalida (elimina) una clave específica
   * @param {string} cacheName - Nombre del cache
   * @param {string} key - Clave a invalidar
   */
  static invalidate(cacheName, key) {
    try {
      const cache = caches[cacheName];
      if (!cache) return false;
      
      const deleted = cache.del(key);
      if (deleted > 0) {
        console.log(`🗑️ Cache INVALIDATED: ${cacheName}:${key}`);
      }
      return deleted > 0;
    } catch (error) {
      console.error(`❌ Error invalidando cache ${cacheName}:${key}:`, error);
      return false;
    }
  }

  /**
   * Invalida todo un cache
   * @param {string} cacheName - Nombre del cache a limpiar
   */
  static flush(cacheName) {
    try {
      const cache = caches[cacheName];
      if (!cache) return false;
      
      cache.flushAll();
      console.log(`🧹 Cache FLUSHED: ${cacheName}`);
      return true;
    } catch (error) {
      console.error(`❌ Error limpiando cache ${cacheName}:`, error);
      return false;
    }
  }

  /**
   * Obtiene estadísticas de todos los caches
   */
  static getStats() {
    const stats = {};
    for (const [name, cache] of Object.entries(caches)) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * Wrapper para ejecutar función con cache
   * @param {string} cacheName - Nombre del cache
   * @param {string} key - Clave
   * @param {Function} fn - Función async a ejecutar si no hay cache
   * @param {number} [ttl] - TTL personalizado
   */
  static async getOrSet(cacheName, key, fn, ttl) {
    // Intentar obtener de cache
    const cached = this.get(cacheName, key);
    if (cached !== undefined) {
      return cached;
    }

    // Si no está en cache, ejecutar función
    console.log(`⏳ Cache MISS: ${cacheName}:${key} - Ejecutando función...`);
    try {
      const result = await fn();
      this.set(cacheName, key, result, ttl);
      return result;
    } catch (error) {
      console.error(`❌ Error en getOrSet ${cacheName}:${key}:`, error);
      throw error;
    }
  }
}

// Event listeners para monitoreo (opcional)
Object.entries(caches).forEach(([name, cache]) => {
  cache.on('expired', (key, value) => {
    console.log(`⏰ Cache EXPIRED: ${name}:${key}`);
  });
  
  cache.on('flush', () => {
    console.log(`🧹 Cache FLUSHED: ${name}`);
  });
});

module.exports = CacheManager;
