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
  ESPACIO_MODIFICADO: 'ESPACIO_MODIFICADO',
  ESPACIO_ELIMINADO: 'ESPACIO_ELIMINADO',
  
  // Miembros
  MIEMBRO_INVITADO: 'MIEMBRO_INVITADO',
  INVITACION_ACEPTADA: 'INVITACION_ACEPTADA',
  MIEMBRO_REMOVIDO: 'MIEMBRO_REMOVIDO',
  
  // Roles
  ROL_CAMBIADO: 'ROL_CAMBIADO',
  
  // Recursos
  OCUPANTE_CREADO: 'OCUPANTE_CREADO',
  OCUPANTE_MODIFICADO: 'OCUPANTE_MODIFICADO',
  OCUPANTE_ELIMINADO: 'OCUPANTE_ELIMINADO',
  ESPECIALIDAD_CREADA: 'ESPECIALIDAD_CREADA',
  ESPECIALIDAD_MODIFICADA: 'ESPECIALIDAD_MODIFICADA',
  ESPECIALIDAD_ELIMINADA: 'ESPECIALIDAD_ELIMINADA',
  TIPO_INSTRUMENTO_CREADO: 'TIPO_INSTRUMENTO_CREADO',
  TIPO_INSTRUMENTO_MODIFICADO: 'TIPO_INSTRUMENTO_MODIFICADO',
  TIPO_INSTRUMENTO_ELIMINADO: 'TIPO_INSTRUMENTO_ELIMINADO',
  INSTRUMENTO_CREADO: 'INSTRUMENTO_CREADO',
  INSTRUMENTO_MODIFICADO: 'INSTRUMENTO_MODIFICADO',
  INSTRUMENTO_ELIMINADO: 'INSTRUMENTO_ELIMINADO'
};

/**
 * Categorías de notificaciones
 */
const NOTIFICATION_CATEGORIES = {
  CONFIGURACION: 'CONFIGURACION',
  ESPACIOS: 'ESPACIOS',
  GRUPO: 'GRUPO',
  PERMISOS: 'PERMISOS',
  RECURSOS: 'RECURSOS'
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
 * Crea notificación para espacio modificado
 */
async function notifyEspacioModificado({
  userSubs,
  grupoId,
  createdBy,
  espacioId,
  espacioNombre,
  espacioTipo,
  cambios
}) {
  // Generar mensaje descriptivo de los cambios
  let mensajeCambios = '';
  if (cambios && Object.keys(cambios).length > 0) {
    const cambiosTexto = Object.keys(cambios).map(campo => {
      const camposTexto = {
        nombre: 'Nombre',
        capacidad: 'Capacidad',
        descripcion: 'Descripción',
        estado: 'Estado'
      };
      const nombreCampo = camposTexto[campo] || campo;
      return `${nombreCampo}: "${cambios[campo].old}" → "${cambios[campo].new}"`;
    }).join(', ');
    mensajeCambios = ` - Cambios: ${cambiosTexto}`;
  }

  await notifyGroupMembers({
    userSubs,
    grupoId,
    tipo: NOTIFICATION_TYPES.ESPACIO_MODIFICADO,
    categoria: NOTIFICATION_CATEGORIES.ESPACIOS,
    titulo: 'Espacio modificado',
    mensaje: `Se ha modificado el espacio "${espacioNombre}"${mensajeCambios}`,
    createdBy,
    entidadAfectada: {
      tipo: 'ESPACIO',
      id: espacioId,
      nombre: espacioNombre
    },
    detalles: { tipo_espacio: espacioTipo, cambios },
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

/**
 * Notifica la creación de un ocupante
 */
async function notifyOcupanteCreado({
  userSubs,
  grupoId,
  createdBy,
  ocupanteNombre,
  especialidadNombre,
  tipoOcupante = 'Ocupante'
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.OCUPANTE_CREADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Nuevo ${tipoOcupante.toLowerCase()} agregado: ${ocupanteNombre}`,
    detalle: {
      ocupante_nombre: ocupanteNombre,
      especialidad: especialidadNombre,
      tipo: tipoOcupante
    },
    entidadAfectada: {
      tipo: 'OCUPANTE',
      nombre: ocupanteNombre,
      especialidad: especialidadNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la modificación de un ocupante
 */
async function notifyOcupanteModificado({
  userSubs,
  grupoId,
  createdBy,
  ocupanteNombre,
  especialidadNombre,
  cambios = {},
  tipoOcupante = 'Ocupante'
}) {
  let mensajeCambios = '';
  if (cambios.nombre) {
    mensajeCambios = ` (nombre cambiado de "${cambios.nombre.old}" a "${cambios.nombre.new}")`;
  } else if (cambios.especialidad) {
    mensajeCambios = ` (especialidad cambiada a "${cambios.especialidad.new}")`;
  }

  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.OCUPANTE_MODIFICADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `${tipoOcupante} modificado: ${ocupanteNombre}${mensajeCambios}`,
    detalle: {
      ocupante_nombre: ocupanteNombre,
      especialidad: especialidadNombre,
      cambios,
      tipo: tipoOcupante
    },
    entidadAfectada: {
      tipo: 'OCUPANTE',
      nombre: ocupanteNombre,
      especialidad: especialidadNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la eliminación de un ocupante
 */
async function notifyOcupanteEliminado({
  userSubs,
  grupoId,
  createdBy,
  ocupanteNombre,
  especialidadNombre,
  tipoOcupante = 'Ocupante'
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.OCUPANTE_ELIMINADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `${tipoOcupante} eliminado: ${ocupanteNombre}`,
    detalle: {
      ocupante_nombre: ocupanteNombre,
      especialidad: especialidadNombre,
      tipo: tipoOcupante
    },
    entidadAfectada: {
      tipo: 'OCUPANTE',
      nombre: ocupanteNombre,
      especialidad: especialidadNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la creación de una especialidad
 */
async function notifyEspecialidadCreada({
  userSubs,
  grupoId,
  createdBy,
  especialidadNombre,
  tipoEspecialidad = 'Especialidad'
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.ESPECIALIDAD_CREADA,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Nueva ${tipoEspecialidad.toLowerCase()} creada: ${especialidadNombre}`,
    detalle: {
      especialidad_nombre: especialidadNombre,
      tipo: tipoEspecialidad
    },
    entidadAfectada: {
      tipo: 'ESPECIALIDAD',
      nombre: especialidadNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la modificación de una especialidad
 */
async function notifyEspecialidadModificada({
  userSubs,
  grupoId,
  createdBy,
  especialidadNombre,
  nombreAnterior,
  tipoEspecialidad = 'Especialidad'
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.ESPECIALIDAD_MODIFICADA,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `${tipoEspecialidad} modificada: "${nombreAnterior}" → "${especialidadNombre}"`,
    detalle: {
      especialidad_nombre: especialidadNombre,
      nombre_anterior: nombreAnterior,
      tipo: tipoEspecialidad
    },
    entidadAfectada: {
      tipo: 'ESPECIALIDAD',
      nombre: especialidadNombre,
      nombre_anterior: nombreAnterior
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la eliminación de una especialidad
 */
async function notifyEspecialidadEliminada({
  userSubs,
  grupoId,
  createdBy,
  especialidadNombre,
  tipoEspecialidad = 'Especialidad'
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.ESPECIALIDAD_ELIMINADA,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `${tipoEspecialidad} eliminada: ${especialidadNombre}`,
    detalle: {
      especialidad_nombre: especialidadNombre,
      tipo: tipoEspecialidad
    },
    entidadAfectada: {
      tipo: 'ESPECIALIDAD',
      nombre: especialidadNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la creación de un tipo de instrumento
 */
async function notifyTipoInstrumentoCreado({
  userSubs,
  grupoId,
  createdBy,
  tipoNombre
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.TIPO_INSTRUMENTO_CREADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Nuevo tipo de instrumento creado: ${tipoNombre}`,
    detalle: {
      tipo_nombre: tipoNombre
    },
    entidadAfectada: {
      tipo: 'TIPO_INSTRUMENTO',
      nombre: tipoNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la modificación de un tipo de instrumento
 */
async function notifyTipoInstrumentoModificado({
  userSubs,
  grupoId,
  createdBy,
  tipoNombre,
  nombreAnterior
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.TIPO_INSTRUMENTO_MODIFICADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Tipo de instrumento modificado: "${nombreAnterior}" → "${tipoNombre}"`,
    detalle: {
      tipo_nombre: tipoNombre,
      nombre_anterior: nombreAnterior
    },
    entidadAfectada: {
      tipo: 'TIPO_INSTRUMENTO',
      nombre: tipoNombre,
      nombre_anterior: nombreAnterior
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la eliminación de un tipo de instrumento
 */
async function notifyTipoInstrumentoEliminado({
  userSubs,
  grupoId,
  createdBy,
  tipoNombre,
  instrumentosAfectados = 0
}) {
  let mensaje = `Tipo de instrumento eliminado: ${tipoNombre}`;
  if (instrumentosAfectados > 0) {
    mensaje += ` (${instrumentosAfectados} instrumentos afectados)`;
  }

  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.TIPO_INSTRUMENTO_ELIMINADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje,
    detalle: {
      tipo_nombre: tipoNombre,
      instrumentos_afectados: instrumentosAfectados
    },
    entidadAfectada: {
      tipo: 'TIPO_INSTRUMENTO',
      nombre: tipoNombre
    },
    prioridad: instrumentosAfectados > 0 ? NOTIFICATION_PRIORITIES.NORMAL : NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la creación de un instrumento
 */
async function notifyInstrumentoCreado({
  userSubs,
  grupoId,
  createdBy,
  instrumentoNombre,
  tipoNombre
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.INSTRUMENTO_CREADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Nuevo instrumento agregado: ${instrumentoNombre} (${tipoNombre})`,
    detalle: {
      instrumento_nombre: instrumentoNombre,
      tipo_instrumento: tipoNombre
    },
    entidadAfectada: {
      tipo: 'INSTRUMENTO',
      nombre: instrumentoNombre,
      tipo_instrumento: tipoNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la modificación de un instrumento
 */
async function notifyInstrumentoModificado({
  userSubs,
  grupoId,
  createdBy,
  instrumentoNombre,
  tipoNombre,
  cambios = {}
}) {
  let mensajeCambios = '';
  if (cambios.nombre) {
    mensajeCambios = ` (nombre: "${cambios.nombre.old}" → "${cambios.nombre.new}")`;
  } else if (cambios.tipo) {
    mensajeCambios = ` (tipo: "${cambios.tipo.old}" → "${cambios.tipo.new}")`;
  }

  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.INSTRUMENTO_MODIFICADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Instrumento modificado: ${instrumentoNombre}${mensajeCambios}`,
    detalle: {
      instrumento_nombre: instrumentoNombre,
      tipo_instrumento: tipoNombre,
      cambios
    },
    entidadAfectada: {
      tipo: 'INSTRUMENTO',
      nombre: instrumentoNombre,
      tipo_instrumento: tipoNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
  });
}

/**
 * Notifica la eliminación de un instrumento
 */
async function notifyInstrumentoEliminado({
  userSubs,
  grupoId,
  createdBy,
  instrumentoNombre,
  tipoNombre
}) {
  return await notifyGroupMembers({
    userSubs,
    grupoId,
    createdBy,
    tipo: NOTIFICATION_TYPES.INSTRUMENTO_ELIMINADO,
    categoria: NOTIFICATION_CATEGORIES.RECURSOS,
    mensaje: `Instrumento eliminado: ${instrumentoNombre} (${tipoNombre})`,
    detalle: {
      instrumento_nombre: instrumentoNombre,
      tipo_instrumento: tipoNombre
    },
    entidadAfectada: {
      tipo: 'INSTRUMENTO',
      nombre: instrumentoNombre,
      tipo_instrumento: tipoNombre
    },
    prioridad: NOTIFICATION_PRIORITIES.BAJA
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
  notifyEspacioModificado,
  notifyEspacioEliminado,
  notifyMiembroInvitado,
  notifyInvitacionAceptada,
  notifyMiembroRemovido,
  notifyRolCambiado,
  notifyOcupanteCreado,
  notifyOcupanteModificado,
  notifyOcupanteEliminado,
  notifyEspecialidadCreada,
  notifyEspecialidadModificada,
  notifyEspecialidadEliminada,
  notifyTipoInstrumentoCreado,
  notifyTipoInstrumentoModificado,
  notifyTipoInstrumentoEliminado,
  notifyInstrumentoCreado,
  notifyInstrumentoModificado,
  notifyInstrumentoEliminado
};
