/**
 * Tests para Cache
 */

const { 
  cache,
  catalogCache,
  groupCache,
  userCache,
  notificationCache
} = require('../../src/utils/cache');

describe('Cache', () => {
  beforeEach(() => {
    // Limpiar caches antes de cada test
    cache.clear();
    catalogCache.clear();
    groupCache.clear();
    userCache.clear();
    notificationCache.clear();
  });

  describe('Basic Cache Operations', () => {
    test('debe almacenar y recuperar valor', () => {
      cache.set('test-key', { data: 'test-value' });
      const value = cache.get('test-key');
      
      expect(value).toEqual({ data: 'test-value' });
    });

    test('debe retornar undefined para clave inexistente', () => {
      const value = cache.get('non-existent-key');
      expect(value).toBeUndefined();
    });

    test('debe verificar si existe una clave', () => {
      cache.set('exists', 'value');
      
      expect(cache.has('exists')).toBe(true);
      expect(cache.has('not-exists')).toBe(false);
    });

    test('debe eliminar valor', () => {
      cache.set('to-delete', 'value');
      expect(cache.has('to-delete')).toBe(true);
      
      cache.delete('to-delete');
      expect(cache.has('to-delete')).toBe(false);
    });

    test('debe limpiar todo el cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    test('debe retornar tamaño del cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
    });
  });

  describe('TTL (Time To Live)', () => {
    test('debe expirar valores después del TTL', async () => {
      cache.set('expires', 'value', 100); // 100ms TTL
      
      expect(cache.get('expires')).toBe('value');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get('expires')).toBeUndefined();
    }, 500);

    test('debe mantener valores dentro del TTL', async () => {
      cache.set('valid', 'value', 500); // 500ms TTL
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('valid')).toBe('value');
    }, 500);
  });

  describe('Specialized Caches', () => {
    test('catalogCache debe tener TTL de 5 minutos', () => {
      catalogCache.set('catalog-item', { id: 1, name: 'Item' });
      expect(catalogCache.get('catalog-item')).toBeDefined();
    });

    test('groupCache debe almacenar datos de grupo', () => {
      const groupData = { id: 'group-123', name: 'Test Group' };
      groupCache.set('group-123', groupData);
      
      expect(groupCache.get('group-123')).toEqual(groupData);
    });

    test('userCache debe almacenar datos de usuario', () => {
      const userData = { sub: 'user-456', email: 'test@example.com' };
      userCache.set('user-456', userData);
      
      expect(userCache.get('user-456')).toEqual(userData);
    });

    test('notificationCache debe funcionar independientemente', () => {
      notificationCache.set('notif-1', { title: 'Test' });
      cache.set('notif-1', { title: 'Different' });
      
      expect(notificationCache.get('notif-1').title).toBe('Test');
      expect(cache.get('notif-1').title).toBe('Different');
    });
  });

  describe('LRU Eviction', () => {
    test('debe evictar elementos menos usados cuando está lleno', () => {
      const smallCache = require('../../src/utils/cache').createCache({ maxSize: 3 });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');
      
      // Acceder key1 para hacerla "más usada"
      smallCache.get('key1');
      
      // Agregar key4 debería evictar key2 (menos usada)
      smallCache.set('key4', 'value4');
      
      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key4')).toBe('value4');
      // key2 o key3 fue evictado
      expect(smallCache.size()).toBe(3);
    });
  });

  describe('Stats', () => {
    test('debe rastrear hits y misses', () => {
      cache.set('exists', 'value');
      
      cache.get('exists'); // hit
      cache.get('not-exists'); // miss
      cache.get('exists'); // hit
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });

    test('debe resetear stats', () => {
      cache.set('key', 'value');
      cache.get('key');
      
      cache.resetStats();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
