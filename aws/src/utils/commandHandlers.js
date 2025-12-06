/**
 * Command Handlers - Implementaciones de comandos para CQRS
 * Los handlers reciben comandos, validan, generan eventos y los almacenan
 */

const { EventTypes } = require("../eventStore");
const { validate } = require("../validator");
const crypto = require("crypto");

/**
 * CreateAppointment Command Handler
 */
async function handleCreateAppointment(payload, context, eventStore) {
  const { grupo_id, fecha, hora_inicio, hora_fin, espacio, ocupante, especialidad, estado, tipo_consulta, notas } = payload;
  
  // Validación
  validate('createAppointment', payload);
  
  const appointmentId = `APPOINTMENT#${Date.now()}`;
  
  // Generar evento
  const event = {
    aggregateType: 'Appointment',
    aggregateId: appointmentId,
    eventType: EventTypes.APPOINTMENT_CREATED,
    data: {
      appointmentId,
      grupo_id,
      fecha,
      hora_inicio,
      hora_fin,
      espacio_id: espacio.id,
      espacio_nombre: espacio.nombre,
      ocupante_id: ocupante.id,
      ocupante_nombre: ocupante.nombre,
      especialidad_id: especialidad?.id,
      especialidad_nombre: especialidad?.nombre,
      estado: estado || 'CONFIRMADA',
      tipo_consulta,
      observaciones: notas
    },
    metadata: {
      userId: context.userId || context.userSub,
      userEmail: context.userEmail,
      correlationId: context.correlationId || crypto.randomUUID()
    }
  };
  
  // Guardar evento
  await eventStore.appendEvent(event);
  
  return {
    appointmentId,
    status: 'CREATED',
    message: 'Appointment creado. La proyección se completará en breve.'
  };
}

/**
 * UpdateAppointment Command Handler
 */
async function handleUpdateAppointment(payload, context, eventStore) {
  const { appointmentId, grupo_id, ...updates } = payload;
  
  // Validación
  validate('updateAppointment', payload);
  
  // Generar evento
  const event = {
    aggregateType: 'Appointment',
    aggregateId: appointmentId,
    eventType: EventTypes.APPOINTMENT_UPDATED,
    data: {
      grupo_id,
      ...updates
    },
    metadata: {
      userId: context.userId || context.userSub,
      correlationId: context.correlationId || crypto.randomUUID()
    }
  };
  
  await eventStore.appendEvent(event);
  
  return {
    appointmentId,
    status: 'UPDATED',
    message: 'Appointment actualizado. La proyección se completará en breve.'
  };
}

/**
 * DeleteAppointment Command Handler
 */
async function handleDeleteAppointment(payload, context, eventStore) {
  const { appointmentId, grupo_id } = payload;
  
  // Validación
  if (!appointmentId || !grupo_id) {
    throw new Error('appointmentId y grupo_id son requeridos');
  }
  
  // Generar evento
  const event = {
    aggregateType: 'Appointment',
    aggregateId: appointmentId,
    eventType: EventTypes.APPOINTMENT_DELETED,
    data: {
      grupo_id
    },
    metadata: {
      userId: context.userId || context.userSub,
      correlationId: context.correlationId || crypto.randomUUID()
    }
  };
  
  await eventStore.appendEvent(event);
  
  return {
    appointmentId,
    status: 'DELETED',
    message: 'Appointment eliminado. La proyección se completará en breve.'
  };
}

/**
 * CreateGroup Command Handler
 */
async function handleCreateGroup(payload, context, eventStore) {
  const { name, nomenclatura } = payload;
  
  // Validación
  validate('createGroup', payload);
  
  const groupId = `grp_${crypto.randomUUID()}`;
  
  // Generar evento
  const event = {
    aggregateType: 'Group',
    aggregateId: groupId,
    eventType: EventTypes.GROUP_CREATED,
    data: {
      nombre: name.trim(),
      nomenclatura: nomenclatura || {
        general: 'Pasillo',
        especifico: 'Box',
        ocupante: 'Médico',
        especialidad: 'Especialidad'
      }
    },
    metadata: {
      userId: context.userId || context.userSub,
      userEmail: context.userEmail,
      userName: context.userName,
      correlationId: context.correlationId || crypto.randomUUID()
    }
  };
  
  await eventStore.appendEvent(event);
  
  // También crear evento de member joined (owner)
  const memberEvent = {
    aggregateType: 'Group',
    aggregateId: groupId,
    eventType: EventTypes.MEMBER_JOINED,
    data: {
      group_id: groupId,
      user_sub: context.userId || context.userSub,
      user_email: context.userEmail,
      user_name: context.userName,
      role: 'owner'
    },
    metadata: {
      userId: context.userId || context.userSub,
      correlationId: context.correlationId || crypto.randomUUID()
    }
  };
  
  await eventStore.appendEvent(memberEvent);
  
  return {
    group_id: groupId,
    nombre: name,
    role: 'owner',
    status: 'CREATED',
    message: 'Grupo creado. La proyección se completará en breve.'
  };
}

/**
 * InviteMember Command Handler
 */
async function handleInviteMember(payload, context, eventStore) {
  const { grupo_id, email, rol, invitedUserSub } = payload;
  
  // Validación
  validate('inviteMember', payload);
  
  const invitationToken = crypto.randomUUID();
  
  // Generar evento
  const event = {
    aggregateType: 'Group',
    aggregateId: grupo_id,
    eventType: EventTypes.MEMBER_INVITED,
    data: {
      group_id: grupo_id,
      invited_email: email,
      invited_user_sub: invitedUserSub,
      role: rol,
      invitation_token: invitationToken
    },
    metadata: {
      userId: context.userId || context.userSub,
      userEmail: context.userEmail,
      correlationId: context.correlationId || crypto.randomUUID()
    }
  };
  
  await eventStore.appendEvent(event);
  
  return {
    invitation_token: invitationToken,
    email,
    rol,
    grupo_id,
    status: 'INVITED',
    message: 'Invitación enviada. La proyección se completará en breve.'
  };
}

module.exports = {
  handleCreateAppointment,
  handleUpdateAppointment,
  handleDeleteAppointment,
  handleCreateGroup,
  handleInviteMember
};
