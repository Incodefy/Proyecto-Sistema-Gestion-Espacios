// src/handlers/permissions.js
const config = require('../../config/config');

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const fs = require('fs');
const path = require('path');
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");
const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const { validate } = require("../../utils/validation");
const { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, validationErrorResponse } = require("../../utils/response");
const { createLogger } = require("../../utils/logger");

const logger = createLogger({ handler: 'permissions' });
const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// === Cargar la configuración de permisos desde el archivo JSON definido en config.js ===
let AVAILABLE_PERMISSIONS = {};
let PREDEFINED_ROLES = {};

try {
  // Intentar cargar desde path relativo
  const permissionsPath = path.resolve(config.roles.available_permissions_path);
  console.log(`[Init] Intentando cargar permisos desde: ${permissionsPath}`);
  
  if (!fs.existsSync(permissionsPath)) {
    console.warn(`[Init] ⚠️ Archivo no encontrado en: ${permissionsPath}`);
    throw new Error(`Archivo de permisos no encontrado: ${permissionsPath}`);
  }
  
  const permissionsData = JSON.parse(fs.readFileSync(permissionsPath, 'utf-8'));
  AVAILABLE_PERMISSIONS = permissionsData.AVAILABLE_PERMISSIONS;
  PREDEFINED_ROLES = permissionsData.PREDEFINED_ROLES;
  
  console.log(`[Init] ✅ Permisos cargados correctamente`);
  console.log(`[Init] Roles disponibles: ${Object.keys(PREDEFINED_ROLES).join(', ')}`);
  
} catch (err) {
  console.error(`[Init] ❌ Error cargando permisos:`, err);
  console.error(`[Init] Stack:`, err.stack);
  
  // Fallback: definir permisos por defecto en código
  console.warn(`[Init] ⚠️ Usando permisos por defecto codificados`);
  
  AVAILABLE_PERMISSIONS = {
    "dashboard.read": "Ver Dashboard",
    "dashboard.write": "Modificar Dashboard",
    "agenda.read": "Ver Agenda",
    "agenda.write": "Gestionar Agenda",
    "box.read": "Ver Box",
    "box.write": "Gestionar Box",
    "box.detalle.read": "Ver Detalle de Box",
    "box.detalle.write": "Modificar Detalle de Box",
    "consultas.read": "Ver Consultas",
    "consultas.write": "Gestionar Consultas",
    "data.import": "Importar Datos",
    "data.export": "Exportar Datos",
    "medicos.read": "Ver Médicos",
    "medicos.write": "Gestionar Médicos",
    "notificaciones.read": "Ver Notificaciones",
    "notificaciones.write": "Gestionar Notificaciones",
    "notificaciones.historial": "Ver Historial de Notificaciones",
    "grupo.read": "Ver Información del Grupo",
    "grupo.manage": "Gestionar Grupo (Espacios, Miembros, Roles)",
    "grupo.delete": "Eliminar Grupo",
    "admin.users": "Administrar Usuarios del Grupo",
    "admin.roles": "Administrar Roles del Grupo",
    "admin.permissions": "Administrar Permisos",
    "admin.system": "Acceso Total de Sistema"
  };
  
  PREDEFINED_ROLES = {
    // LECTOR - Solo lectura de todo
    "lector": [
      "dashboard.read",
      "agenda.read",
      "box.read",
      "box.detalle.read",
      "consultas.read",
      "medicos.read",
      "notificaciones.read",
      "notificaciones.historial",
      "grupo.read"
    ],
    
    // ESCRITOR - Lectura + escritura en todas las interfaces
    "escritor": [
      "dashboard.read", "dashboard.write",
      "agenda.read", "agenda.write",
      "box.read", "box.write",
      "box.detalle.read", "box.detalle.write",
      "consultas.read", "consultas.write",
      "medicos.read", "medicos.write",
      "notificaciones.read", "notificaciones.write",
      "notificaciones.historial",
      "data.import", "data.export",
      "grupo.read"
    ],
    
    // ADMIN - Todo lo de escritor + gestión del grupo (espacios, miembros, roles)
    "admin": [
      "dashboard.read", "dashboard.write",
      "agenda.read", "agenda.write",
      "box.read", "box.write",
      "box.detalle.read", "box.detalle.write",
      "consultas.read", "consultas.write",
      "medicos.read", "medicos.write",
      "notificaciones.read", "notificaciones.write",
      "notificaciones.historial",
      "data.import", "data.export",
      "grupo.read", "grupo.manage",
      "admin.users", "admin.roles", "admin.permissions"
    ],
    
    // OWNER - Acceso total (solo el creador del grupo)
    "owner": [
      "dashboard.read", "dashboard.write",
      "agenda.read", "agenda.write",
      "box.read", "box.write",
      "box.detalle.read", "box.detalle.write",
      "consultas.read", "consultas.write",
      "medicos.read", "medicos.write",
      "notificaciones.read", "notificaciones.write",
      "notificaciones.historial",
      "data.import", "data.export",
      "grupo.read", "grupo.manage", "grupo.delete",
      "admin.users", "admin.roles", "admin.permissions", "admin.system"
    ]
  };
}

/**
 * Verifica si un usuario tiene un permiso específico en un grupo
 * Ahora verifica en GROUP_MEMBERS_TABLE en lugar de USER_ROLES_TABLE
 */
async function verifyPermission(userSub, groupId, requiredPermission) {
  const TRACE = `[Perms-${Date.now()}]`;
  
  try {
    console.log(`${TRACE} 🔐 Verificando permiso '${requiredPermission}' para ${userSub} en grupo ${groupId}`);
    
    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - lectura DynamoDB pausada", { userSub, groupId, requiredPermission });
      throw new Error("CircuitBreakerOpen");
    }

    // Obtener el miembro del grupo de DynamoDB
    console.log(`${TRACE} 📍 Buscando miembro en GROUP_MEMBERS_TABLE...`);
    const result = await retryWithJitter(
      async () => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.GROUP_MEMBERS_TABLE,
          Key: { 
            group_id: groupId,
            user_sub: userSub 
          }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    // Si existe el miembro en el grupo, verificar permisos según su rol
    if (result.Item) {
      console.log(`${TRACE} ✅ Miembro encontrado en grupo`);
      const memberRole = result.Item.role || 'lector';
      const rolePermissions = PREDEFINED_ROLES[memberRole] || [];
      console.log(`${TRACE} 📋 Rol: ${memberRole}, Permisos: ${rolePermissions.join(', ')}`);

      // Owner y admin tienen todos los permisos
      if (memberRole === 'owner' || memberRole === 'admin' || rolePermissions.includes("admin.users")) {
        console.log(`${TRACE} ✅ Tiene rol privilegiado (${memberRole})`);
        return true;
      }
      
      const hasPermission = rolePermissions.includes(requiredPermission);
      console.log(`${TRACE} ${hasPermission ? '✅' : '❌'} Tiene permiso '${requiredPermission}': ${hasPermission}`);
      return hasPermission;
    }

    console.log(`${TRACE} ❌ Usuario NO es miembro del grupo`);
    return false;

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error verificando permiso", err, { userEmail, requiredPermission });
    return false;
  }
}

/**
 * POST /assign-role
 * Asigna un rol a un miembro de grupo con idempotencia y resiliencia
 */
module.exports.assignRole = async (event) => {
  const endTrace = logger.startTrace('assignRole');

  try {
    // 1) PARSEO Y VALIDACIÓN DEL BODY
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (jsonErr) {
      logger.error("Error parseando JSON", jsonErr);
      endTrace();
      return errorResponse("JSON inválido en el body", 400);
    }

    const { valid, data, errors } = validate(body, 'assignRole');
    if (!valid) {
      logger.warn("Validación fallida en assignRole", { errors });
      endTrace();
      return validationErrorResponse(errors);
    }

    const { userSub: user_sub, groupId: group_id, roleName: role } = data;

    // 2) VALIDAR ROL
    if (!PREDEFINED_ROLES[role]) {
      logger.warn("Rol no válido solicitado", { role, available: Object.keys(PREDEFINED_ROLES) });
      endTrace();
      return errorResponse("Rol no válido", 400, { available_roles: Object.keys(PREDEFINED_ROLES) });
    }

    // 3) VALIDAR TOKEN DEL SOLICITANTE
    const requesterSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!requesterSub) {
      logger.warn("Intento sin token válido");
      endTrace();
      return unauthorizedResponse("Token inválido o ausente. Debes enviar Authorization: Bearer <token>");
    }

    logger.info("Solicitud de asignación de rol", { requesterSub, targetUser: user_sub, group_id, role });

    // 4) VALIDAR PERMISO admin.users EN EL GRUPO
    const hasPermission = await verifyPermission(requesterSub, group_id, "admin.users");
    if (!hasPermission) {
      logger.warn("Usuario sin permiso admin.users en el grupo", { requester: requesterSub, group_id });
      endTrace();
      return forbiddenResponse("No tienes permiso para asignar roles en este grupo", { required_permission: "admin.users" });
    }

    // 5) IDEMPOTENCIA
    const timestamp = new Date().toISOString();
    const idempotencyKey = `assignRole-${group_id}-${user_sub}-${role}-${timestamp}`;

    if (await wasAlreadyProcessed(idempotencyKey)) {
      logger.info("Asignación ya procesada (idempotencia)", { idempotencyKey });
      endTrace();
      return successResponse({ message: "Rol ya estaba asignado" });
    }

    // 6) CIRCUIT BREAKER
    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - asignación pausada");
      endTrace();
      return errorResponse("Circuit breaker activo, espere unos segundos", 503);
    }

    // 7) ESCRITURA EN DYNAMO (GROUP_MEMBERS_TABLE)
    logger.debug("Actualizando rol de miembro en DynamoDB", { table: process.env.GROUP_MEMBERS_TABLE, group_id, user_sub, role });

    try {
      await retryWithJitter(
        async () => {
          await docClient.send(new PutCommand({
            TableName: process.env.GROUP_MEMBERS_TABLE,
            Item: {
              group_id,
              user_sub,
              role,
              added_at: timestamp,
              updated_by: requesterSub
            },
          }));
          dynamoBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );
    } catch (dynamoErr) {
      logger.error("Error guardando en DynamoDB", dynamoErr, { table: process.env.GROUP_MEMBERS_TABLE });
      endTrace();
      return errorResponse("Error guardando en DynamoDB", 500, { details: dynamoErr.message });
    }

    // 8) MARCAR COMO PROCESADO
    await markAsProcessed(idempotencyKey);

    const rolePermissions = PREDEFINED_ROLES[role];
    logger.info("Rol asignado correctamente", { group_id, user_sub, role, requesterSub });
    endTrace();

    return successResponse({
      message: "Rol asignado correctamente",
      group_id,
      assigned_to: user_sub,
      assigned_role: role,
      permissions: rolePermissions,
      assigned_by: requesterSub,
      assigned_at: timestamp
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error inesperado en assignRole", { error: err.message, stack: err.stack });
    endTrace();
    return errorResponse("Error interno del servidor", 500, { details: err.message });
  }
};


/**
 * DELETE /remove-role
 * Remueve un rol de miembro de grupo con retry + breaker
 */
module.exports.removeRole = async (event) => {
  const endTrace = logger.startTrace('removeRole');

  try {
    const requesterSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const { user_sub, group_id } = JSON.parse(event.body || "{}");

    if (!user_sub || !group_id) {
      logger.warn("Intento de remoción sin user_sub o group_id");
      endTrace();
      return errorResponse("user_sub y group_id son obligatorios", 400);
    }

    // Verificar permiso admin.users en el grupo
    const hasPermission = await verifyPermission(requesterSub, group_id, "admin.users");
    if (!hasPermission) {
      logger.warn("Usuario sin permiso para remover miembros", { requesterSub, group_id });
      endTrace();
      return forbiddenResponse("No tienes permiso para remover miembros en este grupo");
    }

    const userCheck = await retryWithJitter(
      async () => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.GROUP_MEMBERS_TABLE,
          Key: { group_id, user_sub }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    if (!userCheck.Item) {
      logger.warn("Usuario no es miembro del grupo", { user_sub, group_id });
      endTrace();
      return notFoundResponse("Usuario no es miembro del grupo");
    }

    if (user_sub === requesterSub) {
      logger.warn("Intento de eliminar propio rol", { requesterSub });
      endTrace();
      return forbiddenResponse("No puedes eliminar tu propio rol");
    }

    const removedRole = userCheck.Item.role;

    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - eliminación pausada");
      throw new Error("CircuitBreakerOpen");
    }

    await retryWithJitter(
      async () => {
        await docClient.send(new DeleteCommand({
          TableName: process.env.GROUP_MEMBERS_TABLE,
          Key: { group_id, user_sub }
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    logger.info("Rol eliminado", { group_id, user_sub, removedRole, removedBy: requesterSub });
    endTrace();

    return successResponse({
      message: "Rol removido correctamente",
      group_id,
      user_sub,
      removed_role: removedRole,
      removed_by: requesterSub,
      removed_at: new Date().toISOString()
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error removiendo rol", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500);
  }
};

/**
 * GET /my-permissions
 * Obtiene información básica de membresías del usuario (sin listar todos los permisos)
 * Para verificar permisos específicos, usar checkPermission
 */
module.exports.getMyPermissions = async (event) => {
  const endTrace = logger.startTrace('getMyPermissions');

  try {
    // 1) VALIDAR TOKEN
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    if (!claims) {
      logger.warn("No se recibieron claims en JWT");
      endTrace();
      return unauthorizedResponse("Token inválido o malformado");
    }

    const userSub = claims.sub;
    if (!userSub) {
      logger.warn("Token JWT sin sub");
      endTrace();
      return unauthorizedResponse("Token JWT no contiene el sub");
    }

    logger.info("Usuario autenticado solicitando información de membresías", { userSub });

    // 2) VALIDAR QUE LA TABLA EXISTA
    if (!process.env.GROUP_MEMBERS_TABLE) {
      logger.error("GROUP_MEMBERS_TABLE no configurado en environment");
      endTrace();
      return errorResponse("Tabla GROUP_MEMBERS_TABLE no configurada", 500);
    }

    // 3) CONSULTA A DYNAMO - Obtener todos los grupos del usuario
    let result;
    try {
      console.log(`🔍 Consultando GROUP_MEMBERS_TABLE para user_sub: ${userSub}`);
      console.log(`📋 Tabla: ${process.env.GROUP_MEMBERS_TABLE}`);
      console.log(`📋 Índice: UserGroupsIndex`);
      
      result = await retryWithJitter(
        async () => {
          const res = await docClient.send(
            new QueryCommand({
              TableName: process.env.GROUP_MEMBERS_TABLE,
              IndexName: 'UserGroupsIndex',
              KeyConditionExpression: 'user_sub = :sub',
              ExpressionAttributeValues: { ':sub': userSub }
            })
          );
          dynamoBreaker.reportSuccess();
          console.log(`✅ Query exitoso, Items encontrados: ${res.Items?.length || 0}`);
          if (res.Items && res.Items.length > 0) {
            console.log(`📊 Primer item:`, JSON.stringify(res.Items[0], null, 2));
          }
          return res;
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );
    } catch (err) {
      console.error("❌ Error consultando membresías en DynamoDB:", err);
      logger.error("Error consultando membresías en DynamoDB", err, { userSub });
      endTrace();
      return errorResponse("Error leyendo membresías en DynamoDB", 500, { details: err.message });
    }

    // 4) PROCESAR MEMBERSHIPS - Solo información básica
    const groups = [];
    let hasAdminPermissions = false;

    console.log(`🔄 Procesando ${result.Items?.length || 0} membresías...`);

    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        const role = item.role || 'lector';
        
        console.log(`  👤 Grupo: ${item.group_id}, Rol: ${role}`);
        
        groups.push({
          group_id: item.group_id,
          role,
          added_at: item.added_at
        });

        // Verificar si tiene rol privilegiado en algún grupo
        if (role === 'owner' || role === 'admin') {
          hasAdminPermissions = true;
        }
      }
    } else {
      console.log(`⚠️ Usuario no tiene membresías en ningún grupo`);
    }

    // 5) CALCULAR TODOS LOS PERMISOS POR GRUPO
    const permissionsByGroup = {};
    
    console.log(`🔄 Calculando permisos para cada grupo...`);
    
    for (const group of groups) {
      const role = group.role || 'lector';
      const permissions = PREDEFINED_ROLES[role] || [];
      
      permissionsByGroup[group.group_id] = {
        role,
        permissions,
        permissionsCount: permissions.length
      };
      
      console.log(`  📋 Grupo ${group.group_id}: ${permissions.length} permisos (rol: ${role})`);
    }

    console.log(`📦 Total de grupos: ${groups.length}`);
    console.log(`🔐 Tiene permisos de admin: ${hasAdminPermissions}`);

    logger.info("Membresías obtenidas", { 
      userSub, 
      groupsCount: groups.length,
      hasAdminPermissions
    });
    endTrace();

    return successResponse({
      user_sub: userSub,
      groups,
      has_admin_permissions: hasAdminPermissions,
      permissions_by_group: permissionsByGroup,
      message: "Permisos calculados para todos los grupos"
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error inesperado en getMyPermissions", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500, { details: err.message });
  }
};


/**
 * POST /check-permission
 * Verifica si el usuario tiene un permiso en un grupo específico
 */
module.exports.checkPermission = async (event) => {
  const endTrace = logger.startTrace('checkPermission');

  try {
    const { permission, group_id } = JSON.parse(event.body || "{}");
    const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;

    if (!permission || !group_id) {
      logger.warn("Verificación sin especificar permission o group_id");
      endTrace();
      return errorResponse("permission y group_id son obligatorios", 400);
    }
    if (!userSub) {
      logger.warn("Verificación sin usuario autenticado");
      endTrace();
      return unauthorizedResponse("Usuario no autenticado");
    }

    const hasAccess = await verifyPermission(userSub, group_id, permission);
    logger.info("Verificación de permiso", { userSub, group_id, permission, hasAccess });
    endTrace();

    return successResponse({
      user_sub: userSub,
      group_id,
      permission,
      has_access: hasAccess,
      message: hasAccess ? "Acceso permitido" : "Acceso denegado - Principio del mínimo permiso"
    });

  } catch (err) {
    logger.error("Error verificando permiso", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500);
  }
};

/**
 * GET /admin/available-permissions
 * Lista los permisos disponibles
 */
module.exports.listAvailablePermissions = async () => {
  const endTrace = logger.startTrace('listAvailablePermissions');

  try {
    logger.info("Listando permisos disponibles", { total: Object.keys(AVAILABLE_PERMISSIONS).length });
    endTrace();

    return successResponse({
      permissions: AVAILABLE_PERMISSIONS,
      roles: PREDEFINED_ROLES,
      total_permissions: Object.keys(AVAILABLE_PERMISSIONS).length
    });
  } catch (err) {
    logger.error("Error listando permisos", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500);
  }
};

/**
 * GET /users-with-roles
 * Lista miembros de un grupo con un rol específico
 */
module.exports.listUsersWithRoles = async (event) => {
  const endTrace = logger.startTrace('listUsersWithRoles');

  try {
    const requesterSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    const group_id = event.queryStringParameters?.group_id;
    const role = event.queryStringParameters?.role;
    
    if (!group_id) {
      logger.warn("Listado sin especificar group_id");
      endTrace();
      return errorResponse("Debe especificar un group_id para consultar", 400);
    }

    // Verificar que el usuario tiene permiso para ver miembros
    const hasPermission = await verifyPermission(requesterSub, group_id, "admin.users");
    if (!hasPermission) {
      logger.warn("Usuario sin permiso para listar miembros", { requesterSub, group_id });
      endTrace();
      return forbiddenResponse("No tienes permiso para listar miembros de este grupo");
    }

    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - listado pausado");
      throw new Error("CircuitBreakerOpen");
    }

    // Si se especifica rol, filtrar por rol
    let queryParams = {
      TableName: process.env.GROUP_MEMBERS_TABLE,
      KeyConditionExpression: 'group_id = :gid',
      ExpressionAttributeValues: { ':gid': group_id }
    };

    if (role) {
      queryParams.FilterExpression = 'role = :r';
      queryParams.ExpressionAttributeValues[':r'] = role;
    }

    const result = await retryWithJitter(
      async () => {
        const res = await docClient.send(new QueryCommand(queryParams));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const members = (result.Items || []).map(item => ({
      user_sub: item.user_sub,
      role: item.role,
      permissions: PREDEFINED_ROLES[item.role] || [],
      added_at: item.added_at,
      updated_by: item.updated_by
    }));

    logger.info("Listado de miembros", { group_id, role, count: members.length, requestedBy: requesterSub });
    endTrace();

    return successResponse({ group_id, role: role || 'all', members, total: members.length, requested_by: requesterSub });

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error listando usuarios con roles", err, { role: event.queryStringParameters?.role });
    endTrace();
    return errorResponse("Error interno del servidor", 500, { details: err.message });
  }
};

/**
 * Genera configuración de interfaz según permisos
 */
function generateUIConfig(permissions) {
  return {
    can_view_dashboard: permissions.includes("dashboard.read") || permissions.includes("admin.users"),
    can_admin_dashboard: permissions.includes("dashboard.admin") || permissions.includes("admin.users"),
    can_view_agenda: permissions.includes("agenda.read") || permissions.includes("admin.users"),
    can_edit_agenda: permissions.includes("agenda.write") || permissions.includes("admin.users"),
    can_view_box: permissions.includes("box.read") || permissions.includes("admin.users"),
    can_edit_box: permissions.includes("box.write") || permissions.includes("admin.users"),
    can_view_consultas: permissions.includes("consultas.read") || permissions.includes("admin.users"),
    can_edit_consultas: permissions.includes("consultas.write") || permissions.includes("admin.users"),
    is_admin: permissions.includes("admin.users")
  };
}

