/**
 * Validación de inputs con AJV (JSON Schema)
 * Migración desde Joi a AJV para mejor performance y estándares
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const addErrors = require('ajv-errors');

// Configurar AJV con opciones de seguridad
const ajv = new Ajv({ 
  allErrors: true,          // Reportar todos los errores
  removeAdditional: true,   // Eliminar propiedades adicionales
  coerceTypes: true,        // Convertir tipos automáticamente
  useDefaults: true,        // Aplicar valores por defecto
  strict: true              // Modo estricto
});

// Agregar formatos comunes (email, date, uri, etc)
addFormats(ajv);

// Agregar mensajes de error personalizados
addErrors(ajv);

/**
 * Schemas de validación
 */
const schemas = {
  // Login
  login: {
    type: 'object',
    properties: {
      username: { 
        type: 'string', 
        format: 'email',
        minLength: 5,
        maxLength: 100
      },
      password: { 
        type: 'string', 
        minLength: 8,
        maxLength: 100
      }
    },
    required: ['username', 'password'],
    additionalProperties: false,
    errorMessage: {
      properties: {
        username: 'Username must be a valid email address',
        password: 'Password must be at least 8 characters'
      }
    }
  },

  // Insertar Agenda (completo con todos los campos)
  insertarAgenda: {
    type: 'object',
    properties: {
      idAgenda: { 
        type: 'integer', 
        minimum: 1
      },
      idOccupant: { 
        type: 'integer', 
        minimum: 1,
        maximum: 99999
      },
      occupantName: {
        type: 'string',
        minLength: 1,
        maxLength: 200
      },
      idEspecialidad: {
        type: 'integer',
        minimum: 1
      },
      especialidadNombre: {
        type: 'string',
        minLength: 1
      },
      idSpace: { 
        type: 'integer', 
        minimum: 1,
        maximum: 9999
      },
      spaceName: {
        type: 'string',
        minLength: 1
      },
      idEstado: {
        type: 'integer',
        minimum: 1
      },
      estadoNombre: {
        type: 'string',
        minLength: 1
      },
      fecha: { 
        type: 'string', 
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'Fecha en formato YYYY-MM-DD'
      },
      horaInicio: { 
        type: 'string', 
        pattern: '^(HORA#)?([01]\\d|2[0-3]):[0-5]\\d$',
        description: 'Hora en formato HH:MM (24h) o HORA#HH:MM'
      },
      horaFin: { 
        type: 'string', 
        pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
        description: 'Hora en formato HH:MM (24h)'
      },
      tipoConsulta: {
        type: 'string',
        minLength: 1
      },
      grupo_id: {
        type: 'string',
        minLength: 1
      }
    },
    required: ['idAgenda', 'idOccupant', 'occupantName', 'idEspecialidad', 
               'especialidadNombre', 'idSpace', 'spaceName', 'idEstado', 
               'estadoNombre', 'fecha', 'horaInicio', 'horaFin', 'tipoConsulta', 'grupo_id'],
    additionalProperties: false,
    errorMessage: {
      properties: {
        fecha: 'Fecha must be in YYYY-MM-DD format',
        horaInicio: 'horaInicio must be in HH:MM format (24-hour)',
        horaFin: 'horaFin must be in HH:MM format (24-hour)'
      }
    }
  },

  // Actualizar Estado Agenda
  actualizarEstadoAgenda: {
    type: 'object',
    properties: {
      idAgenda: { 
        type: 'string', 
        minLength: 1,
        maxLength: 200
      },
      estado: { 
        type: 'string', 
        enum: ['disponible', 'ocupado', 'bloqueado', 'cancelado']
      }
    },
    required: ['idAgenda', 'estado'],
    additionalProperties: false
  },

  // Asignar Rol (permissions)
  assignRole: {
    type: 'object',
    properties: {
      userEmail: { 
        type: 'string', 
        format: 'email'
      },
      roleName: { 
        type: 'string',
        minLength: 1,
        maxLength: 50
      },
      permissions: {
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
        minItems: 0,
        maxItems: 100
      }
    },
    required: ['userEmail', 'roleName'],
    additionalProperties: false
  },

  // Update Personalization
  updatePersonalization: {
    type: 'object',
    properties: {
      theme: {
        type: 'string',
        enum: ['light', 'dark', 'auto']
      },
      language: {
        type: 'string',
        pattern: '^[a-z]{2}$',
        description: 'ISO 639-1 language code (2 letters)'
      },
      timezone: {
        type: 'string',
        minLength: 1,
        maxLength: 50
      },
      notifications_enabled: {
        type: 'boolean'
      }
    },
    additionalProperties: true, // Permitir otros parámetros de personalización
    minProperties: 1
  },

  // Consulta por fecha
  consultaPorFecha: {
    type: 'object',
    properties: {
      fecha: { 
        type: 'string', 
        pattern: '^\\d{4}-\\d{2}-\\d{2}$'
      }
    },
    required: ['fecha'],
    additionalProperties: false
  },

  // Consulta por médico
  consultaPorMedico: {
    type: 'object',
    properties: {
      medico_id: { 
        type: 'integer', 
        minimum: 1 
      }
    },
    required: ['medico_id'],
    additionalProperties: false
  }
};

// Compilar todos los schemas una sola vez (performance)
const validators = {};
for (const [name, schema] of Object.entries(schemas)) {
  validators[name] = ajv.compile(schema);
}

/**
 * Valida datos contra un schema
 * @param {object} data - Datos a validar
 * @param {string} schemaName - Nombre del schema
 * @returns {object} { valid: boolean, data?: object, errors?: array }
 */
function validate(data, schemaName) {
  const validator = validators[schemaName];
  
  if (!validator) {
    throw new Error(`Schema '${schemaName}' not found. Available: ${Object.keys(validators).join(', ')}`);
  }

  // Clonar data para evitar mutaciones
  const dataCopy = JSON.parse(JSON.stringify(data));
  
  const valid = validator(dataCopy);
  
  if (!valid) {
    return {
      valid: false,
      errors: validator.errors.map(err => ({
        field: err.instancePath.replace('/', '') || err.params.missingProperty,
        message: err.message,
        value: err.data,
        params: err.params
      }))
    };
  }

  return { 
    valid: true, 
    data: dataCopy  // Retorna datos limpios (sin campos extra)
  };
}

/**
 * Agrega un schema dinámicamente
 * @param {string} name - Nombre del schema
 * @param {object} schema - JSON Schema
 */
function addSchema(name, schema) {
  validators[name] = ajv.compile(schema);
}

/**
 * Obtiene la lista de schemas disponibles
 */
function getSchemaNames() {
  return Object.keys(validators);
}

module.exports = {
  validate,
  addSchema,
  getSchemaNames,
  schemas,
  ajv
};
