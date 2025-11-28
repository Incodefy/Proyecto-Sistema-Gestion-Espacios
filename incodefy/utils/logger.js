// utils/logger.js - Sistema de logging optimizado con niveles

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Configurar nivel según entorno
const currentLevel = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] 
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG);

class Logger {
  constructor(context = 'APP') {
    this.context = context;
  }

  /**
   * Log de depuración - solo en desarrollo
   * Incluye detalles técnicos, dumps de objetos, flujo de ejecución
   */
  debug(...args) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG][${this.context}]`, ...args);
    }
  }

  /**
   * Log informativo - eventos importantes del sistema
   * Inicio/fin de operaciones, métricas, estados
   */
  info(...args) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(`[INFO][${this.context}]`, ...args);
    }
  }

  /**
   * Advertencias - problemas no críticos
   * Cache miss, fallbacks, validaciones que pasan pero son sospechosas
   */
  warn(...args) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(`[WARN][${this.context}]`, ...args);
    }
  }

  /**
   * Errores - fallos críticos
   * Excepciones, errores de API, fallos de base de datos
   */
  error(...args) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(`[ERROR][${this.context}]`, ...args);
    }
  }

  /**
   * Crear un logger hijo con contexto específico
   */
  child(childContext) {
    return new Logger(`${this.context}:${childContext}`);
  }
}

// Instancia global
const logger = new Logger();

module.exports = {
  Logger,
  logger,
  LOG_LEVELS
};
