/**
 * Projections - Read Models para CQRS
 * Proyectan eventos del event store a modelos optimizados para lectura
 */

const { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { retryDB } = require("./retry");
const { Logger } = require("./logger");
const { encryptPII } = require("./encryption");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Base Projection class
 */
class Projection {
  constructor(readModelTable, logger) {
    this.readModelTable = readModelTable;
    this.logger = logger || Logger.create({ handler: 'Projection' });
  }

  /**
   * Apply event to read model
   * @param {Object} event - Event from event store
   */
  async apply(event) {
    const handlerMethod = `on${event.eventType}`;
    
    if (typeof this[handlerMethod] === 'function') {
      this.logger.debug('Applying event to projection', {
        eventType: event.eventType,
        aggregateId: event.aggregateId
      });
      
      await this[handlerMethod](event);
    } else {
      this.logger.debug('No handler for event type', { eventType: event.eventType });
    }
  }
}

/**
 * Appointments Read Model Projection
 */
class AppointmentsProjection extends Projection {
  constructor() {
    super(process.env.APPOINTMENTS_TABLE);
  }

  async onAppointmentCreated(event) {
    const { data, metadata, timestamp } = event;
    
    const appointment = {
      PK: data.grupo_id,
      SK: `APPOINTMENT#${data.appointmentId || event.aggregateId}`,
      appointment_id: data.appointmentId || event.aggregateId,
      
      // GSI keys
      GSI1PK: data.ocupante_id,
      GSI1SK: `${data.fecha}#${data.hora_inicio}`,
      GSI2PK: data.espacio_id,
      GSI2SK: `${data.fecha}#${data.hora_inicio}`,
      GSI3PK: data.grupo_id,
      GSI3SK: `${data.fecha}#${data.hora_inicio}`,
      
      // Data
      grupo_id: data.grupo_id,
      fecha: data.fecha,
      hora_inicio: data.hora_inicio,
      hora_fin: data.hora_fin,
      espacio_id: data.espacio_id,
      espacio_nombre: data.espacio_nombre,
      ocupante_id: data.ocupante_id,
      ocupante_nombre: data.ocupante_nombre,
      especialidad_id: data.especialidad_id,
      especialidad_nombre: data.especialidad_nombre,
      estado: data.estado || 'CONFIRMADA',
      tipo_consulta: data.tipo_consulta,
      observaciones: data.observaciones,
      
      // Metadata
      created_at: new Date(timestamp).toISOString(),
      created_by: metadata.userId,
      updated_at: new Date(timestamp).toISOString(),
      
      // Event sourcing metadata
      lastEventId: event.eventId,
      version: 1
    };

    // Encriptar PII
    const encryptedAppointment = await encryptPII(appointment);

    await retryDB(
      () => docClient.send(new PutCommand({
        TableName: this.readModelTable,
        Item: encryptedAppointment
      })),
      { operation: 'projectAppointmentCreated' }
    );

    this.logger.info('Appointment projection created', {
      appointmentId: appointment.appointment_id
    });
  }

  async onAppointmentUpdated(event) {
    const { data, metadata, timestamp, aggregateId } = event;
    
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Campos actualizables
    const fields = ['estado', 'hora_inicio', 'hora_fin', 'observaciones', 'tipo_consulta'];
    
    fields.forEach(field => {
      if (data[field] !== undefined) {
        updateExpression.push(`#${field} = :${field}`);
        expressionAttributeNames[`#${field}`] = field;
        expressionAttributeValues[`:${field}`] = data[field];
      }
    });
    
    // Siempre actualizar metadata
    updateExpression.push('#updated_at = :updated_at');
    updateExpression.push('#lastEventId = :lastEventId');
    updateExpression.push('#version = #version + :inc');
    
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeNames['#lastEventId'] = 'lastEventId';
    expressionAttributeNames['#version'] = 'version';
    
    expressionAttributeValues[':updated_at'] = new Date(timestamp).toISOString();
    expressionAttributeValues[':lastEventId'] = event.eventId;
    expressionAttributeValues[':inc'] = 1;

    await retryDB(
      () => docClient.send(new UpdateCommand({
        TableName: this.readModelTable,
        Key: {
          PK: data.grupo_id,
          SK: `APPOINTMENT#${aggregateId}`
        },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      })),
      { operation: 'projectAppointmentUpdated' }
    );

    this.logger.info('Appointment projection updated', { aggregateId });
  }

  async onAppointmentDeleted(event) {
    const { data, aggregateId } = event;

    await retryDB(
      () => docClient.send(new DeleteCommand({
        TableName: this.readModelTable,
        Key: {
          PK: data.grupo_id,
          SK: `APPOINTMENT#${aggregateId}`
        }
      })),
      { operation: 'projectAppointmentDeleted' }
    );

    this.logger.info('Appointment projection deleted', { aggregateId });
  }
}

/**
 * Groups Read Model Projection
 */
class GroupsProjection extends Projection {
  constructor() {
    super(process.env.GROUPS_TABLE);
  }

  async onGroupCreated(event) {
    const { data, metadata, timestamp, aggregateId } = event;
    
    const group = {
      group_id: aggregateId,
      nombre: data.nombre,
      owner_sub: metadata.userId,
      configured: false,
      nomenclatura: data.nomenclatura || {
        general: 'Pasillo',
        especifico: 'Box',
        ocupante: 'Médico',
        especialidad: 'Especialidad'
      },
      created_at: new Date(timestamp).toISOString(),
      updated_at: new Date(timestamp).toISOString(),
      lastEventId: event.eventId,
      version: 1
    };

    await retryDB(
      () => docClient.send(new PutCommand({
        TableName: this.readModelTable,
        Item: group
      })),
      { operation: 'projectGroupCreated' }
    );

    this.logger.info('Group projection created', { groupId: aggregateId });
  }

  async onGroupUpdated(event) {
    const { data, timestamp, aggregateId } = event;
    
    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    if (data.nombre) {
      updateExpression.push('#nombre = :nombre');
      expressionAttributeNames['#nombre'] = 'nombre';
      expressionAttributeValues[':nombre'] = data.nombre;
    }
    
    if (data.nomenclatura) {
      updateExpression.push('#nomenclatura = :nomenclatura');
      expressionAttributeNames['#nomenclatura'] = 'nomenclatura';
      expressionAttributeValues[':nomenclatura'] = data.nomenclatura;
    }
    
    updateExpression.push('#updated_at = :updated_at');
    updateExpression.push('#lastEventId = :lastEventId');
    updateExpression.push('#version = #version + :inc');
    
    expressionAttributeNames['#updated_at'] = 'updated_at';
    expressionAttributeNames['#lastEventId'] = 'lastEventId';
    expressionAttributeNames['#version'] = 'version';
    
    expressionAttributeValues[':updated_at'] = new Date(timestamp).toISOString();
    expressionAttributeValues[':lastEventId'] = event.eventId;
    expressionAttributeValues[':inc'] = 1;

    await retryDB(
      () => docClient.send(new UpdateCommand({
        TableName: this.readModelTable,
        Key: { group_id: aggregateId },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      })),
      { operation: 'projectGroupUpdated' }
    );

    this.logger.info('Group projection updated', { groupId: aggregateId });
  }
}

/**
 * Projection Manager - Coordina todas las proyecciones
 */
class ProjectionManager {
  constructor() {
    this.projections = new Map();
    this.logger = Logger.create({ handler: 'ProjectionManager' });
  }

  registerProjection(aggregateType, projection) {
    this.projections.set(aggregateType, projection);
    this.logger.debug('Projection registered', { aggregateType });
  }

  async projectEvent(event) {
    const projection = this.projections.get(event.aggregateType);
    
    if (projection) {
      await projection.apply(event);
    } else {
      this.logger.warn('No projection registered for aggregate type', {
        aggregateType: event.aggregateType
      });
    }
  }
}

// Singleton
let projectionManagerInstance = null;

function getProjectionManager() {
  if (!projectionManagerInstance) {
    projectionManagerInstance = new ProjectionManager();
    
    // Registrar proyecciones
    projectionManagerInstance.registerProjection('Appointment', new AppointmentsProjection());
    projectionManagerInstance.registerProjection('Group', new GroupsProjection());
  }
  
  return projectionManagerInstance;
}

module.exports = {
  Projection,
  AppointmentsProjection,
  GroupsProjection,
  ProjectionManager,
  getProjectionManager
};
