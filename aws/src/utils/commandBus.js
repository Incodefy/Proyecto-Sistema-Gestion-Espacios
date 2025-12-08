/**
 * Command Bus - Sistema de enrutamiento de comandos para CQRS
 * Separa la intención (command) de la ejecución (handler)
 * 
 * UPDATED: Integrado con OperationStore para Async Request-Reply Pattern
 * - Tracking de operaciones con operationId
 * - Status PENDING → PROCESSING → COMPLETED/FAILED
 * - Notificaciones WebSocket opcionales
 */

const { Logger } = require("./logger");
const { EventStore, EventTypes } = require("./eventStore");
const { getOperationStore } = require("./operationStore");
const crypto = require("crypto");

/**
 * Command Bus para ejecutar comandos y generar eventos
 */
class CommandBus {
  constructor() {
    this.handlers = new Map();
    this.middleware = [];
    this.logger = createLogger({ handler: 'CommandBus' });
    this.eventStore = new EventStore(this.logger);
    this.operationStore = getOperationStore(this.logger);
  }

  /**
   * Registrar handler para un comando
   * @param {string} commandName - Nombre del comando
   * @param {Function} handler - Handler del comando
   */
  register(commandName, handler) {
    if (this.handlers.has(commandName)) {
      throw new Error(`Handler already registered for command: ${commandName}`);
    }
    
    this.handlers.set(commandName, handler);
    this.logger.debug('Command handler registered', { commandName });
  }

  /**
   * Agregar middleware (validación, logging, etc)
   * @param {Function} middlewareFn - Función middleware
   */
  use(middlewareFn) {
    this.middleware.push(middlewareFn);
  }

  /**
   * Ejecutar un comando
   * 
   * UPDATED: Integrado con OperationStore
   * - Crea registro de operación con status PENDING
   * - Actualiza a PROCESSING durante ejecución
   * - Marca como COMPLETED con resultado o FAILED con error
   * - Retorna { operationId, result } para que el handler pueda retornar 202
   * 
   * @param {string} commandName - Nombre del comando
   * @param {Object} payload - Datos del comando
   * @param {Object} context - Contexto de ejecución
   * @param {string} [context.userId] - ID del usuario (requerido)
   * @param {string} [context.operationId] - ID de operación (opcional, se genera si no existe)
   * @param {string} [context.correlationId] - ID de correlación (opcional)
   * @param {string} [context.connectionId] - WebSocket connectionId (opcional)
   * @param {boolean} [context.trackOperation=true] - Si debe trackear la operación
   * @returns {Promise<Object>} - { operationId, result }
   */
  async execute(commandName, payload, context = {}) {
    const operationId = context.operationId || crypto.randomUUID();
    const trackOperation = context.trackOperation !== false;

    this.logger.info('Executing command', { 
      commandName, 
      operationId,
      trackOperation,
      userId: context.userId 
    });

    // Verificar que existe el handler
    const handler = this.handlers.get(commandName);
    if (!handler) {
      throw new Error(`No handler registered for command: ${commandName}`);
    }

    // 1. Crear registro de operación (si tracking habilitado)
    if (trackOperation && context.userId) {
      await this.operationStore.createOperation({
        operationId,
        type: commandName,
        userId: context.userId,
        correlationId: context.correlationId,
        connectionId: context.connectionId,
        metadata: {
          payload: this._sanitizePayload(payload)
        }
      });
    }

    // Ejecutar middleware
    let modifiedPayload = payload;
    for (const mw of this.middleware) {
      modifiedPayload = await mw(commandName, modifiedPayload, context);
    }

    // 2. Ejecutar handler con tracking
    try {
      // Marcar como PROCESSING
      if (trackOperation && context.userId) {
        await this.operationStore.updateOperation(operationId, {
          status: 'PROCESSING',
          progress: 10
        });
      }

      // Ejecutar handler
      const result = await handler(modifiedPayload, context, this.eventStore);
      
      // 3. Marcar como COMPLETED
      if (trackOperation && context.userId) {
        await this.operationStore.completeOperation(
          operationId, 
          result,
          result?.id || result?.appointmentId || result?.groupId, // resourceId
          result?.resourceUrl // resourceUrl
        );
      }

      this.logger.info('Command executed successfully', { 
        commandName,
        operationId,
        resultKeys: Object.keys(result || {})
      });

      return { operationId, result };

    } catch (error) {
      // 4. Marcar como FAILED
      if (trackOperation && context.userId) {
        await this.operationStore.failOperation(operationId, {
          code: error.code || error.name || 'COMMAND_EXECUTION_ERROR',
          message: error.message,
          retryable: error.retryable !== false
        });
      }

      this.logger.error('Command execution failed', error, { 
        commandName, 
        operationId 
      });
      
      throw error;
    }
  }

  /**
   * Sanitize payload para logging/metadata (remover datos sensibles)
   * @private
   */
  _sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;

    const sanitized = { ...payload };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'accessToken'];
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

/**
 * Command definitions
 */
const Commands = {
  // Appointments
  CREATE_APPOINTMENT: 'CreateAppointment',
  UPDATE_APPOINTMENT: 'UpdateAppointment',
  DELETE_APPOINTMENT: 'DeleteAppointment',
  COMPLETE_APPOINTMENT: 'CompleteAppointment',
  CANCEL_APPOINTMENT: 'CancelAppointment',

  // Groups
  CREATE_GROUP: 'CreateGroup',
  UPDATE_GROUP: 'UpdateGroup',
  DELETE_GROUP: 'DeleteGroup',
  INVITE_MEMBER: 'InviteMember',
  REMOVE_MEMBER: 'RemoveMember',
  UPDATE_MEMBER_ROLE: 'UpdateMemberRole',

  // Spaces
  CREATE_SPACE: 'CreateSpace',
  UPDATE_SPACE: 'UpdateSpace',
  DELETE_SPACE: 'DeleteSpace',

  // Occupants
  CREATE_OCCUPANT: 'CreateOccupant',
  UPDATE_OCCUPANT: 'UpdateOccupant',
  DELETE_OCCUPANT: 'DeleteOccupant',

  // Notifications
  MARK_NOTIFICATION_READ: 'MarkNotificationRead',
  DELETE_NOTIFICATION: 'DeleteNotification'
};

/**
 * Singleton instance
 */
let commandBusInstance = null;

function getCommandBus() {
  if (!commandBusInstance) {
    commandBusInstance = new CommandBus();
  }
  return commandBusInstance;
}

module.exports = {
  CommandBus,
  Commands,
  getCommandBus
};
