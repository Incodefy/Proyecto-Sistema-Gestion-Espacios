const fetch = require('node-fetch');

// Cache en memoria con TTL de 5 minutos
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const DEBUG = process.env.DEBUG_PERSONALIZATION === 'true';

function getCacheKey(userSub) {
  return `personalization:${userSub}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Limpiar cache viejo cada 100 entradas
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        cache.delete(k);
      }
    }
  }
}

/**
 * Middleware para obtener la configuración de personalización del usuario
 * desde la sesión (ya cargada en login) o desde la API de AWS como fallback.
 * OPTIMIZADO: Prioriza req.session.user.personalization + Cache en memoria de 5 minutos
 */
async function personalizationMiddleware(req, res, next) {
  // Solo se ejecuta si hay un usuario autenticado con un token
  if (!req.session.user || !req.session.user.idToken) {
    return next();
  }

  // Evita hacer fetch repetidamente en la misma petición si ya se cargó
  if (res.locals.personalization) {
    return next();
  }

  // PRIORIDAD 1: Usar la personalización de la sesión (ya cargada en login)
  if (req.session.user.personalization && Object.keys(req.session.user.personalization).length > 0) {
    if (DEBUG) console.log('🎨 Personalization: Usando datos de sesión (req.session.user.personalization)');
    // Eliminado log verboso que imprimía en cada request
    res.locals.personalization = req.session.user.personalization;
    return next();
  }

  // PRIORIDAD 2: Verificar cache en memoria
  const userSub = req.session.user.sub;
  const cacheKey = getCacheKey(userSub);
  const cached = getFromCache(cacheKey);
  
  if (cached) {
    if (DEBUG) console.log('🎨 Personalization: Usando cache en memoria');
    res.locals.personalization = cached;
    return next();
  }

  // PRIORIDAD 3: Fallback a API (solo si no hay datos en sesión ni cache)
  try {
    const url = `${process.env.API_BASE_URL}/personalization`;
    
    if (DEBUG) console.log('🎨 Personalization: Haciendo fetch a API (fallback)', { url, userSub });
    
    const apiResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${req.session.user.idToken}`
      }
    });

    if (apiResponse.ok) {
      const responseData = await apiResponse.json();
      if (DEBUG) console.log('🎨 Personalization: Respuesta de API completa:', JSON.stringify(responseData, null, 2));
      
      const data = responseData.data || responseData;
      const finalParameters = data.final_parameters || {};
      
      if (DEBUG) console.log('🎨 Personalization: final_parameters extraídos:', finalParameters);
      
      // Guardar en cache, sesión y res.locals
      setCache(cacheKey, finalParameters);
      req.session.user.personalization = finalParameters; // Actualizar sesión también
      res.locals.personalization = finalParameters;
      
      if (DEBUG) console.log('🎨 Personalization: Cargado desde API, cacheado y guardado en sesión');
    } else {
      console.error('🎨 Personalization: Error HTTP', apiResponse.status);
      res.locals.personalization = {};
    }
  } catch (error) {
    console.error('🎨 Personalization: Error de red:', error.message);
    res.locals.personalization = {};
  }

  next();
}

module.exports = personalizationMiddleware;
