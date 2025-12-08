// utils/verificationCodes.js
/**
 * Sistema de gestión de códigos de verificación
 * Almacena códigos temporales en memoria (en producción usar Redis/DynamoDB)
 */

const crypto = require('crypto');

// Almacenamiento temporal de códigos (en memoria)
// En producción, usar Redis o DynamoDB
const verificationCodes = new Map();

// Configuración
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 15;

/**
 * Generar código de verificación numérico
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Crear y almacenar código de verificación para un email
 * @param {string} email - Email del usuario
 * @returns {string} Código generado
 */
function createVerificationCode(email) {
  const code = generateCode();
  const expiresAt = Date.now() + (CODE_EXPIRY_MINUTES * 60 * 1000);
  
  verificationCodes.set(email.toLowerCase(), {
    code,
    expiresAt,
    attempts: 0,
    createdAt: Date.now()
  });
  
  console.log(`🔑 Código generado para ${email}: ${code} (expira en ${CODE_EXPIRY_MINUTES} min)`);
  
  // Limpiar código expirado después del tiempo de expiración
  setTimeout(() => {
    verificationCodes.delete(email.toLowerCase());
    console.log(`🗑️  Código expirado y eliminado para ${email}`);
  }, CODE_EXPIRY_MINUTES * 60 * 1000);
  
  return code;
}

/**
 * Verificar código de verificación (NO lo elimina)
 * @param {string} email - Email del usuario
 * @param {string} code - Código a verificar
 * @param {boolean} consume - Si es true, elimina el código tras verificación exitosa
 * @returns {Object} { valid: boolean, error?: string }
 */
function verifyCode(email, code, consume = false) {
  const normalizedEmail = email.toLowerCase();
  const stored = verificationCodes.get(normalizedEmail);
  
  if (!stored) {
    return { valid: false, error: 'Code not found' };
  }
  
  // Verificar si expiró
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(normalizedEmail);
    return { valid: false, error: 'Code expired' };
  }
  
  // Incrementar intentos
  stored.attempts++;
  
  // Máximo 5 intentos
  if (stored.attempts > 5) {
    verificationCodes.delete(normalizedEmail);
    return { valid: false, error: 'Too many attempts' };
  }
  
  // Verificar código
  if (stored.code !== code) {
    return { valid: false, error: 'Invalid code' };
  }
  
  // Código válido
  console.log(`✅ Código verificado correctamente para ${email}`);
  
  // Si consume=true, eliminar el código (un solo uso)
  if (consume) {
    verificationCodes.delete(normalizedEmail);
    console.log(`🗑️  Código consumido y eliminado para ${email}`);
  }
  
  return { valid: true };
}

/**
 * Marcar código como usado (eliminarlo)
 * @param {string} email - Email del usuario
 */
function consumeCode(email) {
  verificationCodes.delete(email.toLowerCase());
  console.log(`🗑️  Código marcado como usado para ${email}`);
}

/**
 * Eliminar código de verificación
 * @param {string} email - Email del usuario
 */
function deleteCode(email) {
  verificationCodes.delete(email.toLowerCase());
}

/**
 * Verificar si existe un código para un email
 * @param {string} email - Email del usuario
 * @returns {boolean}
 */
function hasCode(email) {
  return verificationCodes.has(email.toLowerCase());
}

/**
 * Obtener estadísticas de códigos activos (para debugging)
 */
function getStats() {
  return {
    activeCodesCount: verificationCodes.size,
    codes: Array.from(verificationCodes.entries()).map(([email, data]) => ({
      email,
      expiresIn: Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000)),
      attempts: data.attempts
    }))
  };
}

module.exports = {
  createVerificationCode,
  verifyCode,
  consumeCode,
  deleteCode,
  hasCode,
  getStats,
  CODE_EXPIRY_MINUTES
};
