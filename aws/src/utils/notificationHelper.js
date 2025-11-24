const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require('crypto');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE;

/**
 * Tipos de notificaciones soportados
 */
const NOTIFICATION_TYPES = {
  // Nomenclatura
  NOMENCLATURA_ACTUALIZADA: 'NOMENCLATURA_ACTUALIZADA',
  
  // Espacios
  ESPACIO_CREADO: 'ESPACIO_CREADO',
  ESPACIO_ELIMINADO: 'ESPACIO_ELIMINADO',
  
  // Miembros
  MIEMBRO_INVITADO: 'MIEMBRO_INVITADO',
  INVITACION_ACEPTADA: 'INVITACION_ACEPTADA',
  MIEMBRO_REMOVIDO: 'MIEMBRO_REMOVIDO',
  
  // Roles
  ROL_CAMBIADO: 'ROL_CAMBIADO'
};

/**
 * Categorías de notificaciones
 */
const NOTIFICATION_CATEGORIES = {
  CONFIGURACION: 'CONFIGURACION',
  ESPACIOS: 'ESPACIOS',
  GRUPO: 'GRUPO',
  PERMISOS: 'PERMISOS'
};

/**
 * Prioridades
 */
const NOTIFICATION_PRIORITIES = {
  BAJA: 'BAJA',
  NORMAL: 'NORMAL',
  ALTA: 'ALTA'
};

/**
 * Crea una notificación en DynamoDB
 * @param {Object} params
 * @param {string} params.userSub - Sub del usuario que recibirá la notificación
 * @param {string} params.grupoId - ID del grupo relacionado
 * @param {string} params.tipo - Tipo de notificación (usar NOTIFICATION_TYPES)
 * @param {string} params.categoria - Categoría (usar NOTIFICATION_CATEGORIES)
 * @param {string} params.titulo - Título de la notificación
 * @param {string} params.mensaje - Mensaje descriptivo
 * @param {Object} [params.detalles] - Detalles adicionales (opcional)
 * @param {string} [params.prioridad='NORMAL'] - Prioridad
 * @param {boolean} [params.accionRequerida=false] - Si requiere acción del usuario
 * @param {string} params.createdBy - Sub del usuario que generó la acción
 * @param {Object} [params.entidadAfectada] - Entidad afectada (opcional)
 * @param {number} [params.ttlDays=90] - Días antes de auto-eliminar
 */
async function createNotification({
  userSub,
  grupoId,
  tipo,
  categoria,
  titulo,
  mensaje,
  detalles = {},
  prioridad = NOTIFICATION_PRIORITIES.NORMAL,
  accionRequerida = false,
  createdBy,
  entidadAfectada = null,
  ttlDays = 90
}) {
  const now = new Date();
  const timestamp = now.toISOString();
  const uuid = crypto.randomUUID();
  
  // TTL en formato epoch (segundos desde 1970)
  const ttl = Math.floor(now.getTime() / 1000) + (ttlDays * 24 * 60 * 60);

  const notification = {
    PK: `USER#${userSub}`,
    SK: `NOTIFICATION#${timestamp}#${uuid}`,
    GSI1PK: `GROUP#${grupoId}`,
    GSI1SK: `NOTIFICATION#${timestamp}`,
    
    notification_id: uuid,
    tipo,
    categoria,
    titulo,
    mensaje,
    
    leida: false,
    prioridad,
    accion_requerida: accionRequerida,
    
    grupo_id: grupoId,
    entidad_afectada: entidadAfectada,
    
    created_at: timestamp,
    created_by: createdBy,
    
    detalles,
    ttl
  };

  await db.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item: notification
  }));

  console.log(`✅ Notificación creada: ${tipo} para usuario ${userSub}`);
  
  return notification;
}

/**
 * Crea notificaciones para múltiples usuarios (batch)
 * @param {Array<Object>} notifications - Array de parámetros de notificación
 */
async function createBatchNotifications(notifications) {
  const items = notifications.map(params => {
    const now = new Date();
    const timestamp = now.toISOString();
    const uuid = crypto.randomUUID();
    const ttl = Math.floor(now.getTime() / 1000) + ((params.ttlDays || 90) * 24 * 60 * 60);

    return {
      PutRequest: {
        Item: {
          PK: `USER#${params.userSub}`,
          SK: `NOTIFICATION#${timestamp}#${uuid}`,
          GSI1PK: `GROUP#${params.grupoId}`,
          GSI1SK: `NOTIFICATION#${timestamp}`,
          
          notification_id: uuid,
          tipo: params.tipo,
          categoria: params.categoria,
          titulo: params.titulo,
          mensaje: params.mensaje,
          
          leida: false,
          prioridad: params.prioridad || NOTIFICATION_PRIORITIES.NORMAL,
          accion_requerida: params.accionRequerida || false,
          
          grupo_id: params.grupoId,
          entidad_afectada: params.entidadAfectada || null,
          
          created_at: timestamp,
          created_by: params.createdBy,
          
          detalles: params.detalles || {},
          ttl
        }
      }
    };
  });

  // DynamoDB permite máximo 25 items por batch
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  for (const batch of batches) {
    await db.send(new BatchWriteCommand({
      RequestItems: {
        [NOTIFICATIONS_TABLE]: batch
      }
    }));
  }

  console.log(`✅ ${notifications.length} notificaciones creadas en batch`);
}

/**
 * Notifica a todos los miembros de un grupo
 * @param {Object} params
 * @param {Array<string>} params.userSubs - Array de user_subs a notificar
 * @param {string} params.grupoId - ID del grupo
 * @param {string} params.tipo - Tipo de notificación
 * @param {string} params.categoria - Categoría
 * @param {string} params.titulo - Título
 * @param {string} params.mensaje - Mensaje
 * @param {string} params.createdBy - Quién generó la acción
 * @param {Object} [params.detalles] - Detalles adicionales
 * @param {Object} [params.entidadAfectada] - Entidad afectada
 */
async function notifyGroupMembers({
  userSubs,
  grupoId,
  tipo,
  categoria,
  titulo,
  mensaje,
  createdBy,
  detalles = {},
  entidadAfectada = null,
  prioridad = NOTIFICATION_PRIORITIES.NORMAL
}) {
  const notifications = userSubs.map(userSub => ({
    userSub,
    grupoId,
    tipo,
    categoria,
    titulo,
    mensaje,
    createdBy,
    detalles,
    entidadAfectada,
    prioridad
  }));

  await createBatchNotifications(notifications);
}

// ============ HELPERS ESPECÍFICOS POR TIPO ============

/**
 * Crea notificación para cambio de nomenclatura
 */
async function notifyNomenclaturaActualizada({
  userSubs,
  grupoId,
  createdBy,
  cambios,
  grupoNombre = 'el grupo'
}) {
  // Generar mensaje descriptivo según los cambios
  let mensaje = 'Se actualizó la nomenclatura del grupo';
  
  if (cambios && cambios.length > 0) {
    const camposTexto = {
      general: 'Espacio General',
      especifico: 'Espacio Específico',
      ocupante: 'Ocupante',
      especialidad: 'Especialidad',
      instrumento: 'Instrumento'
    };
    
    const cambiosDescripcion = cambios.map(c => 
      `${camposTexto[c.campo] || c.campo}: "${c.valor_anterior}" → "${c.valor_nuevo}"`
    ).join(', ');
    
    mensaje = `Se actualizó la nomenclatura: ${cambiosDescripcion}`;
  }

  await notifyGroupMembers({
    userSubs,
    grupoId,
    tipo: NOTIFICATION_TYPES.NOMENCLATURA_ACTUALIZADA,
    categoria: NOTIFICATION_CATEGORIES.CONFIGURACION,
    titulo: 'Nomenclatura actualizada',
    mensaje,
    createdBy,
    detalles: { 
      cambios,
      grupo_nombre: grupoNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Crea notificación para espacio creado
 */
async function notifyEspacioCreado({
  userSubs,
  grupoId,
  createdBy,
  espacioId,
  espacioNombre,
  espacioTipo
}) {
  await notifyGroupMembers({
    userSubs,
    grupoId,
    tipo: NOTIFICATION_TYPES.ESPACIO_CREADO,
    categoria: NOTIFICATION_CATEGORIES.ESPACIOS,
    titulo: 'Nuevo espacio creado',
    mensaje: `Se ha creado el espacio "${espacioNombre}"`,
    createdBy,
    entidadAfectada: {
      tipo: 'ESPACIO',
      id: espacioId,
      nombre: espacioNombre
    },
    detalles: { tipo_espacio: espacioTipo },
    prioridad: NOTIFICATION_PRIORITIES.NORMAL
  });
}

/**
 * Crea notificación para espacio eliminado
 */
async function notifyEspacioEliminado({
  userSubs,
  grupoId,
  createdBy,
  espacioId,
  espacioNombre,
  espacioTipo
}) {
  await notifyGroupMembers({
    userSubs,
    grupoId,
    tipo: NOTIFICATION_TYPES.ESPACIO_ELIMINADO,
    categoria: NOTIFICATION_CATEGORIES.ESPACIOS,
    titulo: 'Espacio eliminado',
    mensaje: `Se ha eliminado el espacio "${espacioNombre}"`,
    createdBy,
    entidadAfectada: {
      tipo: 'ESPACIO',
      id: espacioId,
      nombre: espacioNombre
    },
    detalles: { tipo_espacio: espacioTipo },
    prioridad: NOTIFICATION_PRIORITIES.ALTA
  });
}

/**
 * Crea notificación para invitación enviada (solo al invitado)
 */
async function notifyMiembroInvitado({
  invitedUserSub,
  grupoId,
  grupoNombre,
  createdBy,
  rol,
  invitedEmail
}) {
  await createNotification({
    userSub: invitedUserSub,
    grupoId,
    tipo: NOTIFICATION_TYPES.MIEMBRO_INVITADO,
    categoria: NOTIFICATION_CATEGORIES.GRUPO,
    titulo: 'Invitación a grupo',
    mensaje: `Has sido invitado al grupo "${grupoNombre}" con rol de ${rol}`,
    createdBy,
    detalles: {
      rol,
      invited_email: invitedEmail
    },
    accionRequerida: true,
    prioridad: NOTIFICATION_PRIORITIES.ALTA
  });
}

/**
 * Crea notificación cuando alguien acepta una invitación (para admins)
 */
async function notifyInvitacionAceptada({
  userSubs,
  grupoId,
  newMemberSub,
  newMemberName,
  newMemberEmail,
  rol
}) {
  await notifyGroupMembers({
    userSubs: userSubs.filter(sub => sub !== newMemberSub), // No notificar al nuevo miembro
    grupoId,
    tipo: NOTIFICATION_TYPES.INVITACION_ACEPTADA,
    categoria: NOTIFICATION_CATEGORIES.GRUPO,
    titulo: 'Nuevo miembro en el grupo',
    mensaje: `${newMemberName} (${newMemberEmail}) se unió al grupo con rol de ${rol}`,
    createdBy: newMemberSub,
    entidadAfectada: {
      tipo: 'MIEMBRO',
      id: newMemberSub,
      nombre: newMemberName,
      email: newMemberEmail
    },
    detalles: { rol },
    prioridad: NOTIFICATION_PRIORITIES.NORMAL
  });
}

/**
 * Crea notificación cuando se remueve un miembro
 */
async function notifyMiembroRemovido({
  userSubs,
  grupoId,
  removedUserSub,
  removedUserName,
  removedUserEmail,
  createdBy,
  grupoNombre = 'sin nombre',
  isTargetUser = false
}) {
  if (isTargetUser) {
    // Notificación para el usuario que fue removido
    await createNotification({
      userSub: removedUserSub,
      grupoId,
      tipo: NOTIFICATION_TYPES.MIEMBRO_REMOVIDO,
      categoria: NOTIFICATION_CATEGORIES.GRUPO,
      titulo: 'Removido del grupo',
      mensaje: `Has sido removido del grupo "${grupoNombre}"`,
      createdBy,
      entidadAfectada: {
        tipo: 'GRUPO',
        id: grupoId,
        nombre: grupoNombre
      },
      prioridad: NOTIFICATION_PRIORITIES.ALTA,
      accionRequerida: false
    });
  } else {
    // Notificación para los demás miembros del grupo
    await notifyGroupMembers({
      userSubs: userSubs.filter(sub => sub !== removedUserSub), // No notificar al removido
      grupoId,
      tipo: NOTIFICATION_TYPES.MIEMBRO_REMOVIDO,
      categoria: NOTIFICATION_CATEGORIES.GRUPO,
      titulo: 'Miembro removido del grupo',
      mensaje: `${removedUserName} (${removedUserEmail}) fue removido del grupo`,
      createdBy,
      entidadAfectada: {
        tipo: 'MIEMBRO',
        id: removedUserSub,
        nombre: removedUserName,
        email: removedUserEmail
      },
      prioridad: NOTIFICATION_PRIORITIES.ALTA
    });
  }
}

/**
 * Crea notificación para cambio de rol
 */
async function notifyRolCambiado({
  userSubs,
  grupoId,
  targetUserSub,
  targetUserName,
  targetUserEmail,
  rolAnterior,
  rolNuevo,
  createdBy
}) {
  // Notificar al usuario afectado
  await createNotification({
    userSub: targetUserSub,
    grupoId,
    tipo: NOTIFICATION_TYPES.ROL_CAMBIADO,
    categoria: NOTIFICATION_CATEGORIES.PERMISOS,
    titulo: 'Tu rol ha cambiado',
    mensaje: `Tu rol en el grupo cambió de ${rolAnterior} a ${rolNuevo}`,
    createdBy,
    detalles: {
      rol_anterior: rolAnterior,
      rol_nuevo: rolNuevo
    },
    prioridad: NOTIFICATION_PRIORITIES.ALTA
  });

  // Notificar a los demás miembros
  await notifyGroupMembers({
    userSubs: userSubs.filter(sub => sub !== targetUserSub),
    grupoId,
    tipo: NOTIFICATION_TYPES.ROL_CAMBIADO,
    categoria: NOTIFICATION_CATEGORIES.PERMISOS,
    titulo: 'Cambio de rol en el grupo',
    mensaje: `El rol de ${targetUserName} cambió de ${rolAnterior} a ${rolNuevo}`,
    createdBy,
    entidadAfectada: {
      tipo: 'MIEMBRO',
      id: targetUserSub,
      nombre: targetUserName,
      email: targetUserEmail
    },
    detalles: {
      rol_anterior: rolAnterior,
      rol_nuevo: rolNuevo
    },
    prioridad: NOTIFICATION_PRIORITIES.NORMAL
  });
}

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  createNotification,
  createBatchNotifications,
  notifyGroupMembers,
  
  // Helpers específicos
  notifyNomenclaturaActualizada,
  notifyEspacioCreado,
  notifyEspacioEliminado,
  notifyMiembroInvitado,
  notifyInvitacionAceptada,
  notifyMiembroRemovido,
  notifyRolCambiado
};
