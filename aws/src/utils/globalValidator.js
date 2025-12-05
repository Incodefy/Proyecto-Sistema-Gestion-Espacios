/**
 * Global Validator Enforcer
 * 
 * Utility para asegurar que TODOS los handlers tengan validación obligatoria
 * Wrapper sobre createAPIHandler que aplica validación automática
 */

const { validateMiddleware } = require('./validator');
const { Logger } = require('./logger');

/**
 * Schemas obligatorios por método HTTP
 */
const VALIDATION_SCHEMAS_BY_METHOD = {
  POST: 'default', // Cada handler debe especificar su schema
  PUT: 'default',
  PATCH: 'default',
  DELETE: 'deleteById', // Schema genérico para DELETE
  GET: null // GET no requiere validación de body
};

/**
 * Wrapper para createAPIHandler que FUERZA validación
 * 
 * @param {Function} handler - Handler function
 * @param {Object} options - Opciones de createAPIHandler
 * @param {string} options.validationSchema - OBLIGATORIO para POST/PUT/PATCH
 * @returns {Function} - Handler wrapped con validación
 */
function createValidatedAPIHandler(handler, options = {}) {
  const { createAPIHandler } = require('../handlers/createAPIHandler');
  
  // Detectar método HTTP del handler
  const method = options.method || 'POST';
  
  // Validar que handlers POST/PUT/PATCH tengan schema
  if (['POST', 'PUT', 'PATCH'].includes(method) && !options.validationSchema) {
    throw new Error(
      `Handler para método ${method} DEBE especificar 'validationSchema'. ` +
      `Agregar { validationSchema: 'nombreSchema' } en las opciones.`
    );
  }

  // Si tiene schema, agregar validateMiddleware
  if (options.validationSchema) {
    const originalPreMiddleware = options.preMiddleware || [];
    options.preMiddleware = [
      validateMiddleware(options.validationSchema),
      ...originalPreMiddleware
    ];
  }

  return createAPIHandler(handler, options);
}

/**
 * Valida que un objeto tenga los campos requeridos
 * Útil para validaciones rápidas sin schema completo
 */
function requireFields(data, fields, context = 'request') {
  const missing = [];
  
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `${context} inválido: campos requeridos faltantes: ${missing.join(', ')}`
    );
  }
}

/**
 * Valida tipos de datos
 */
function validateTypes(data, typeMap) {
  const errors = [];

  for (const [field, expectedType] of Object.entries(typeMap)) {
    const value = data[field];
    
    if (value === undefined || value === null) continue;

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== expectedType) {
      errors.push(`${field}: esperado ${expectedType}, recibido ${actualType}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validación de tipos fallida: ${errors.join(', ')}`);
  }
}

/**
 * Sanitiza strings para prevenir injection
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .trim()
    .replace(/[<>]/g, '') // Remover < y >
    .replace(/javascript:/gi, '') // Remover javascript:
    .replace(/on\w+=/gi, ''); // Remover event handlers
}

/**
 * Sanitiza recursivamente un objeto
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

module.exports = {
  createValidatedAPIHandler,
  requireFields,
  validateTypes,
  sanitizeString,
  sanitizeObject
};
