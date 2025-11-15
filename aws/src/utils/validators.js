/**
 * Esquemas de validación con Joi para AWS Lambda
 */

const Joi = require('joi');

// Esquemas de validación (igual que en incodefy)
const loginSchema = Joi.object({
  username: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const personalizationSchema = Joi.object({
  parameters: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())
  ).required()
});

const agendaSchema = Joi.object({
  idBox: Joi.number().integer().positive().required(),
  idMedico: Joi.number().integer().positive().required(),
  fecha: Joi.date().iso().min('now').required(),
  hora_inicio: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  hora_fin: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  observaciones: Joi.string().max(500).allow('').optional()
});

const assignRoleSchema = Joi.object({
  userSub: Joi.string().required(),
  roleName: Joi.string().valid('admin', 'medico', 'enfermera', 'recepcionista').required()
});

/**
 * Valida datos contra un esquema Joi
 * @param {Object} data - Datos a validar
 * @param {Joi.Schema} schema - Esquema de validación
 * @returns {Object} - { valid: boolean, data: Object, errors: Array }
 */
function validate(data, schema) {
  const result = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (result.error) {
    const errors = result.error.details.map(detail => ({
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
    data: result.value,
    errors: []
  };
}

/**
 * Helper para respuestas de error de validación
 * @param {Array} errors - Array de errores
 * @returns {Object} - Respuesta HTTP
 */
function validationErrorResponse(errors) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      ok: false,
      error: 'Errores de validación',
      details: errors
    })
  };
}

module.exports = {
  loginSchema,
  refreshTokenSchema,
  personalizationSchema,
  agendaSchema,
  assignRoleSchema,
  validate,
  validationErrorResponse
};
