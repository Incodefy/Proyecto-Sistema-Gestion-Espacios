/**
 * Esquemas de validación con Joi
 * Valida inputs de la aplicación
 */

const Joi = require('joi');

// ===== ESQUEMAS DE AUTENTICACIÓN =====

const loginSchema = Joi.object({
  username: Joi.string().email().required().messages({
    'string.email': 'El username debe ser un email válido',
    'any.required': 'El username es obligatorio'
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'La contraseña debe tener al menos 8 caracteres',
    'any.required': 'La contraseña es obligatoria'
  })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'El refresh token es obligatorio'
  })
});

// ===== ESQUEMAS DE PERSONALIZACIÓN =====

const personalizationSchema = Joi.object({
  parameters: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean()
    )
  ).required().messages({
    'any.required': 'Los parámetros son obligatorios'
  })
});

// ===== ESQUEMAS DE AGENDA =====

const agendaSchema = Joi.object({
  idBox: Joi.number().integer().positive().required().messages({
    'number.base': 'idBox debe ser un número',
    'number.positive': 'idBox debe ser positivo',
    'any.required': 'idBox es obligatorio'
  }),
  idMedico: Joi.number().integer().positive().required().messages({
    'number.base': 'idMedico debe ser un número',
    'number.positive': 'idMedico debe ser positivo',
    'any.required': 'idMedico es obligatorio'
  }),
  fecha: Joi.date().iso().min('now').required().messages({
    'date.base': 'fecha debe ser una fecha válida',
    'date.format': 'fecha debe estar en formato ISO (YYYY-MM-DD)',
    'date.min': 'fecha no puede ser en el pasado',
    'any.required': 'fecha es obligatoria'
  }),
  hora_inicio: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required().messages({
    'string.pattern.base': 'hora_inicio debe estar en formato HH:MM',
    'any.required': 'hora_inicio es obligatoria'
  }),
  hora_fin: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required().messages({
    'string.pattern.base': 'hora_fin debe estar en formato HH:MM',
    'any.required': 'hora_fin es obligatoria'
  }),
  observaciones: Joi.string().max(500).allow('').optional(),
  idEspecialidad: Joi.number().integer().positive().optional()
}).custom((value, helpers) => {
  // Validar que hora_fin sea posterior a hora_inicio
  const [horaInicioH, horaInicioM] = value.hora_inicio.split(':').map(Number);
  const [horaFinH, horaFinM] = value.hora_fin.split(':').map(Number);
  
  const inicioMinutos = horaInicioH * 60 + horaInicioM;
  const finMinutos = horaFinH * 60 + horaFinM;
  
  if (finMinutos <= inicioMinutos) {
    return helpers.error('any.invalid', {
      message: 'hora_fin debe ser posterior a hora_inicio'
    });
  }
  
  return value;
});

const eliminarAgendaSchema = Joi.object({
  idAgenda: Joi.number().integer().positive().required().messages({
    'number.base': 'idAgenda debe ser un número',
    'number.positive': 'idAgenda debe ser positivo',
    'any.required': 'idAgenda es obligatorio'
  })
});

// ===== ESQUEMAS DE ROLES Y PERMISOS =====

const assignRoleSchema = Joi.object({
  userSub: Joi.string().required().messages({
    'any.required': 'userSub es obligatorio'
  }),
  roleName: Joi.string().valid('admin', 'medico', 'enfermera', 'recepcionista').required().messages({
    'any.only': 'roleName debe ser uno de: admin, medico, enfermera, recepcionista',
    'any.required': 'roleName es obligatorio'
  })
});

const checkPermissionSchema = Joi.object({
  permission: Joi.string().pattern(/^[a-z]+\.[a-z]+$/).required().messages({
    'string.pattern.base': 'permission debe estar en formato "categoria.accion"',
    'any.required': 'permission es obligatorio'
  })
});

// ===== ESQUEMAS DE CATÁLOGO =====

const medicoSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  idEspecialidad: Joi.number().integer().positive().required(),
  activo: Joi.boolean().default(true)
});

const especialidadSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  descripcion: Joi.string().max(500).allow('').optional()
});

const boxSchema = Joi.object({
  nombre: Joi.string().min(1).max(50).required(),
  idPasillo: Joi.number().integer().positive().required(),
  activo: Joi.boolean().default(true)
});

// ===== FUNCIONES DE VALIDACIÓN =====

/**
 * Valida un objeto contra un esquema Joi
 * @param {Object} data - Datos a validar
 * @param {Joi.Schema} schema - Esquema de validación
 * @returns {Object} - { error, value }
 */
function validate(data, schema) {
  return schema.validate(data, {
    abortEarly: false, // Retornar todos los errores
    stripUnknown: true // Eliminar campos no definidos en el esquema
  });
}

/**
 * Middleware de validación para Express
 * @param {Joi.Schema} schema - Esquema a validar
 * @returns {Function} - Middleware
 */
function validateMiddleware(schema) {
  return (req, res, next) => {
    const { error, value } = validate(req.body, schema);
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        ok: false,
        error: 'Errores de validación',
        details: errors
      });
    }
    
    // Reemplazar body con el valor validado y sanitizado
    req.body = value;
    next();
  };
}

/**
 * Validación para Lambda
 * @param {Object} data - Datos a validar
 * @param {Joi.Schema} schema - Esquema a validar
 * @returns {Object} - { valid: boolean, data: Object, errors: Array }
 */
function validateLambda(data, schema) {
  const { error, value } = validate(data, schema);
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      valid: false,
      data: null,
      errors
    };
  }
  
  return {
    valid: true,
    data: value,
    errors: []
  };
}

module.exports = {
  // Esquemas
  loginSchema,
  refreshTokenSchema,
  personalizationSchema,
  agendaSchema,
  eliminarAgendaSchema,
  assignRoleSchema,
  checkPermissionSchema,
  medicoSchema,
  especialidadSchema,
  boxSchema,
  
  // Funciones
  validate,
  validateMiddleware,
  validateLambda
};
