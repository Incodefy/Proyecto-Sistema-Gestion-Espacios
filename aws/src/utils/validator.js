/**
 * JSON Schema Validator
 * 
 * Middleware de validación de schemas usando AJV
 * Proporciona validación consistente y mensajes de error detallados
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { Logger } = require('./logger');

// Inicializar AJV con opciones
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all', // Remueve propiedades no definidas en schema
  useDefaults: true,
  coerceTypes: true,
  strict: false
});

// Agregar formatos (email, uuid, date-time, etc.)
addFormats(ajv);

// Custom keywords
ajv.addKeyword({
  keyword: 'isNotEmpty',
  type: 'string',
  validate: (schema, data) => {
    return typeof data === 'string' && data.trim().length > 0;
  },
  errors: false
});

/**
 * Schemas comunes reutilizables
 */
const commonSchemas = {
  uuid: {
    type: 'string',
    format: 'uuid',
    errorMessage: 'Debe ser un UUID válido'
  },
  
  email: {
    type: 'string',
    format: 'email',
    maxLength: 255,
    errorMessage: 'Debe ser un email válido'
  },
  
  nonEmptyString: {
    type: 'string',
    minLength: 1,
    maxLength: 500,
    isNotEmpty: true
  },
  
  pagination: {
    type: 'object',
    properties: {
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      offset: { type: 'integer', minimum: 0, default: 0 }
    }
  }
};

/**
 * Schemas por endpoint
 */
const schemas = {
  // === GRUPOS ===
  createGroup: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100, isNotEmpty: true },
      description: { type: 'string', maxLength: 500 },
      settings: {
        type: 'object',
        additionalProperties: true
      }
    },
    additionalProperties: false
  },

  updateGroupName: {
    type: 'object',
    required: ['group_id', 'name'],
    properties: {
      group_id: commonSchemas.uuid,
      name: { type: 'string', minLength: 1, maxLength: 100, isNotEmpty: true }
    },
    additionalProperties: false
  },

  inviteMember: {
    type: 'object',
    required: ['grupo_id', 'email', 'rol'],
    properties: {
      grupo_id: commonSchemas.uuid,
      email: commonSchemas.email,
      rol: { 
        type: 'string', 
        enum: ['admin', 'escritor', 'lector'],
        errorMessage: 'Rol debe ser uno de: admin, escritor, lector'
      }
    },
    additionalProperties: false
  },

  updateMemberRole: {
    type: 'object',
    required: ['group_id', 'user_sub', 'new_role'],
    properties: {
      group_id: commonSchemas.uuid,
      user_sub: commonSchemas.uuid,
      new_role: { 
        type: 'string', 
        enum: ['admin', 'escritor', 'lector', 'owner']
      }
    },
    additionalProperties: false
  },

  // === OCUPANTES ===
  createOcupante: {
    type: 'object',
    required: ['nombre', 'tipo'],
    properties: {
      nombre: { type: 'string', minLength: 1, maxLength: 200, isNotEmpty: true },
      tipo: { 
        type: 'string',
        enum: ['medico', 'enfermera', 'tecnico', 'administrativo', 'otro']
      },
      especialidad: { type: 'string', maxLength: 100 },
      email: commonSchemas.email,
      telefono: { type: 'string', maxLength: 20 },
      activo: { type: 'boolean', default: true }
    },
    additionalProperties: false
  },

  updateOcupante: {
    type: 'object',
    required: ['id'],
    properties: {
      id: commonSchemas.uuid,
      nombre: { type: 'string', minLength: 1, maxLength: 200 },
      tipo: { 
        type: 'string',
        enum: ['medico', 'enfermera', 'tecnico', 'administrativo', 'otro']
      },
      especialidad: { type: 'string', maxLength: 100 },
      email: commonSchemas.email,
      telefono: { type: 'string', maxLength: 20 },
      activo: { type: 'boolean' }
    },
    additionalProperties: false
  },

  // === ESPECIALIDADES ===
  createEspecialidad: {
    type: 'object',
    required: ['nombre'],
    properties: {
      nombre: { type: 'string', minLength: 1, maxLength: 100, isNotEmpty: true },
      descripcion: { type: 'string', maxLength: 500 },
      codigo: { type: 'string', maxLength: 20 },
      activa: { type: 'boolean', default: true }
    },
    additionalProperties: false
  },

  // === INSTRUMENTOS ===
  createInstrumento: {
    type: 'object',
    required: ['nombre', 'tipo_id'],
    properties: {
      nombre: { type: 'string', minLength: 1, maxLength: 200, isNotEmpty: true },
      tipo_id: commonSchemas.uuid,
      codigo: { type: 'string', maxLength: 50 },
      descripcion: { type: 'string', maxLength: 500 },
      cantidad: { type: 'integer', minimum: 0 },
      ubicacion: { type: 'string', maxLength: 100 },
      estado: {
        type: 'string',
        enum: ['disponible', 'en_uso', 'mantenimiento', 'dañado'],
        default: 'disponible'
      }
    },
    additionalProperties: false
  },

  // === APPOINTMENTS ===
  createAppointment: {
    type: 'object',
    required: ['ocupante_id', 'espacio_id', 'fecha_inicio', 'fecha_fin'],
    properties: {
      ocupante_id: commonSchemas.uuid,
      espacio_id: commonSchemas.uuid,
      fecha_inicio: { type: 'string', format: 'date-time' },
      fecha_fin: { type: 'string', format: 'date-time' },
      titulo: { type: 'string', maxLength: 200 },
      descripcion: { type: 'string', maxLength: 1000 },
      estado: {
        type: 'string',
        enum: ['pendiente', 'confirmado', 'cancelado', 'completado'],
        default: 'pendiente'
      },
      prioridad: {
        type: 'string',
        enum: ['baja', 'normal', 'alta', 'urgente'],
        default: 'normal'
      }
    },
    additionalProperties: false
  },

  updateAppointment: {
    type: 'object',
    required: ['appointment_id'],
    properties: {
      appointment_id: commonSchemas.uuid,
      ocupante_id: commonSchemas.uuid,
      espacio_id: commonSchemas.uuid,
      fecha_inicio: { type: 'string', format: 'date-time' },
      fecha_fin: { type: 'string', format: 'date-time' },
      titulo: { type: 'string', maxLength: 200 },
      descripcion: { type: 'string', maxLength: 1000 },
      estado: {
        type: 'string',
        enum: ['pendiente', 'confirmado', 'cancelado', 'completado']
      },
      prioridad: {
        type: 'string',
        enum: ['baja', 'normal', 'alta', 'urgente']
      }
    },
    additionalProperties: false
  },

  // === PERSONALIZATION ===
  setPersonalization: {
    type: 'object',
    required: ['preferences'],
    properties: {
      preferences: {
        type: 'object',
        properties: {
          theme: { type: 'string', enum: ['light', 'dark', 'auto'] },
          language: { type: 'string', pattern: '^[a-z]{2}$' },
          notifications: { type: 'boolean' },
          emailNotifications: { type: 'boolean' }
        },
        additionalProperties: true
      }
    },
    additionalProperties: false
  },

  // === PERMISSIONS ===
  updateRolePermissions: {
    type: 'object',
    required: ['role', 'permissions'],
    properties: {
      role: { type: 'string', minLength: 1, maxLength: 50 },
      permissions: {
        type: 'array',
        items: { type: 'string' },
        minItems: 0
      }
    },
    additionalProperties: false
  }
};

// Compilar schemas
const compiledSchemas = {};
for (const [name, schema] of Object.entries(schemas)) {
  compiledSchemas[name] = ajv.compile(schema);
}

/**
 * Formatea errores de validación de AJV en formato user-friendly
 */
function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'Validación fallida';
  }

  return errors.map(err => {
    const field = err.instancePath ? err.instancePath.substring(1) : err.params.missingProperty;
    
    switch (err.keyword) {
      case 'required':
        return `El campo '${field}' es requerido`;
      case 'type':
        return `El campo '${field}' debe ser de tipo ${err.params.type}`;
      case 'minLength':
        return `El campo '${field}' debe tener al menos ${err.params.limit} caracteres`;
      case 'maxLength':
        return `El campo '${field}' debe tener máximo ${err.params.limit} caracteres`;
      case 'minimum':
        return `El campo '${field}' debe ser mayor o igual a ${err.params.limit}`;
      case 'maximum':
        return `El campo '${field}' debe ser menor o igual a ${err.params.limit}`;
      case 'enum':
        return `El campo '${field}' debe ser uno de: ${err.params.allowedValues.join(', ')}`;
      case 'format':
        return `El campo '${field}' tiene formato inválido (esperado: ${err.params.format})`;
      case 'pattern':
        return `El campo '${field}' no cumple el formato requerido`;
      case 'additionalProperties':
        return `El campo '${err.params.additionalProperty}' no está permitido`;
      case 'isNotEmpty':
        return `El campo '${field}' no puede estar vacío`;
      default:
        return err.message || `Error de validación en '${field}'`;
    }
  }).join(', ');
}

/**
 * Valida datos contra un schema
 * 
 * @param {string} schemaName - Nombre del schema
 * @param {object} data - Datos a validar
 * @param {Logger} logger - Logger opcional
 * @returns {object} { valid: boolean, errors: string|null, data: object }
 */
function validate(schemaName, data, logger = null) {
  const validator = compiledSchemas[schemaName];
  
  if (!validator) {
    const error = `Schema '${schemaName}' no encontrado`;
    if (logger) logger.error('Schema validation error', new Error(error));
    throw new Error(error);
  }

  // Clonar data para no mutar el original
  const dataCopy = JSON.parse(JSON.stringify(data));
  const valid = validator(dataCopy);

  if (!valid) {
    const errorMessage = formatValidationErrors(validator.errors);
    if (logger) {
      logger.warn('Validation failed', {
        schema: schemaName,
        errors: validator.errors,
        errorMessage
      });
    }
    return { valid: false, errors: errorMessage, data: null };
  }

  if (logger) {
    logger.debug('Validation passed', { schema: schemaName });
  }

  return { valid: true, errors: null, data: dataCopy };
}

/**
 * Middleware para validar body de requests
 * 
 * @param {string} schemaName - Nombre del schema a usar
 * @returns {Function} Middleware function
 */
function validateMiddleware(schemaName) {
  return async (event, logger) => {
    try {
      const body = typeof event.body === 'string' 
        ? JSON.parse(event.body) 
        : event.body;

      const result = validate(schemaName, body, logger);
      
      if (!result.valid) {
        return {
          statusCode: 400,
          headers: require('../middleware/securityHeaders').getSecurityHeaders(),
          body: JSON.stringify({
            ok: false,
            error: result.errors,
            code: 'VALIDATION_ERROR'
          })
        };
      }

      // Reemplazar body con datos validados y sanitizados
      event.body = result.data;
      return null; // Continuar procesamiento
    } catch (error) {
      if (logger) logger.error('Validation middleware error', error);
      return {
        statusCode: 400,
        headers: require('../middleware/securityHeaders').getSecurityHeaders(),
        body: JSON.stringify({
          ok: false,
          error: 'Datos inválidos',
          code: 'INVALID_JSON'
        })
      };
    }
  };
}

module.exports = {
  validate,
  validateMiddleware,
  schemas,
  commonSchemas
};
