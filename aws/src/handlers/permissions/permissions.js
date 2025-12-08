// src/handlers/permissions.js
const config = require('../../config/config');

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const fs = require('fs');
const path = require('path');
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");
const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");
const { validate } = require("../../utils/validator");
const { successResponse, errorResponse } = require("../../utils/errorHandler");
const { Logger, createLogger } = require("../../utils/logger");
const { createAPIHandler } = require("../../middleware/interceptors");
const { AuthorizationError, ValidationError, NotFoundError } = require("../../utils/errorHandler");
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

async function verifyPermission(userSub, groupId, requiredPermission, logger = createLogger({ handler: 'verifyPermission' })) {
  try {
    logger.info('Verificando permiso', { requiredPermission, userSub, groupId });
    
    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo", { userSub, groupId, requiredPermission });
      throw new Error("CircuitBreakerOpen");
    }

    const result = await retryWithJitter(
      async () => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.GROUP_MEMBERS_TABLE,
          Key: { group_id: groupId, user_sub: userSub }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    if (result.Item) {
      const memberRole = result.Item.role || 'lector';
      const rolePermissions = PREDEFINED_ROLES[memberRole] || [];
      logger.debug('Rol encontrado', { memberRole, permissionsCount: rolePermissions.length });

      if (memberRole === 'owner' || memberRole === 'admin' || rolePermissions.includes("admin.users")) {
        logger.debug('Rol privilegiado detectado', { memberRole });
        return true;
      }
      
      const hasPermission = rolePermissions.includes(requiredPermission);
      logger.debug('Verificación de permiso', { hasPermission, requiredPermission });
      return hasPermission;
    }

    logger.debug('Usuario no es miembro del grupo');
    return false;

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error verificando permiso", err, { userSub, requiredPermission });
    return false;
  }
}

async function assignRoleHandler(event, context, logger) {
  const requesterSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!requesterSub) throw new AuthorizationError("Token inválido o ausente. Debes enviar Authorization: Bearer <token>");

  const body = JSON.parse(event.body || "{}");
  const { valid, data, errors } = validate(body, 'assignRole');
  if (!valid) throw new ValidationError("Validación fallida", { errors });

  const { userSub: user_sub, groupId: group_id, roleName: role } = data;

  if (!PREDEFINED_ROLES[role]) {
    throw new ValidationError("Rol no válido", { available_roles: Object.keys(PREDEFINED_ROLES) });
  }

  logger.info("Solicitud de asignación de rol", { requesterSub, targetUser: user_sub, group_id, role });

  const hasPermission = await verifyPermission(requesterSub, group_id, "admin.users", logger);
  if (!hasPermission) {
    throw new AuthorizationError("No tienes permiso para asignar roles en este grupo", { required_permission: "admin.users" });
  }

  const timestamp = new Date().toISOString();
  const idempotencyKey = `assignRole-${group_id}-${user_sub}-${role}-${timestamp}`;

  if (await wasAlreadyProcessed(idempotencyKey)) {
    logger.info("Asignación ya procesada (idempotencia)", { idempotencyKey });
    return successResponse({ message: "Rol ya estaba asignado" });
  }

  if (!dynamoBreaker.shouldAllow()) {
    logger.warn("Circuit breaker activo - asignación pausada");
    throw new Error("Circuit breaker activo, espere unos segundos");
  }

  logger.debug("Actualizando rol de miembro en DynamoDB", { table: process.env.GROUP_MEMBERS_TABLE, group_id, user_sub, role });

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

  await markAsProcessed(idempotencyKey);

  const rolePermissions = PREDEFINED_ROLES[role];
  logger.info("Rol asignado correctamente", { group_id, user_sub, role, requesterSub });

  return successResponse({
    message: "Rol asignado correctamente",
    group_id,
    assigned_to: user_sub,
    assigned_role: role,
    permissions: rolePermissions,
    assigned_by: requesterSub,
    assigned_at: timestamp
  });
}

module.exports.assignRole = createAPIHandler(assignRoleHandler, { rateLimit: { maxRequests: 30, windowSeconds: 60 } });


async function removeRoleHandler(event, context, logger) {
  const requesterSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const { user_sub, group_id } = JSON.parse(event.body || "{}");

  if (!user_sub || !group_id) {
    throw new ValidationError("user_sub y group_id son obligatorios");
  }

  // Verificar permiso admin.users en el grupo
  const hasPermission = await verifyPermission(requesterSub, group_id, "admin.users", logger);
  if (!hasPermission) {
    logger.warn("Usuario sin permiso para remover miembros", { requesterSub, group_id });
    throw new AuthorizationError("No tienes permiso para remover miembros en este grupo");
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
    throw new NotFoundError("Usuario no es miembro del grupo");
  }

  if (user_sub === requesterSub) {
    logger.warn("Intento de eliminar propio rol", { requesterSub });
    throw new AuthorizationError("No puedes eliminar tu propio rol");
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

  return successResponse({
    message: "Rol removido correctamente",
    group_id,
    user_sub,
    removed_role: removedRole,
    removed_by: requesterSub,
    removed_at: new Date().toISOString()
  });
}

module.exports.removeRole = createAPIHandler(removeRoleHandler, { rateLimit: { maxRequests: 20, windowSeconds: 60 } });

/**
 * GET /my-permissions
 * Obtiene información básica de membresías del usuario (sin listar todos los permisos)
 * Para verificar permisos específicos, usar checkPermission
 */
async function getMyPermissionsHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;

  if (!userSub) {
    throw new AuthorizationError("Token JWT no contiene el sub");
  }

  logger.info("Usuario autenticado solicitando información de membresías", { userSub });

  // VALIDAR QUE LA TABLA EXISTA
  if (!process.env.GROUP_MEMBERS_TABLE) {
    logger.error("GROUP_MEMBERS_TABLE no configurado en environment");
    throw new Error("Tabla GROUP_MEMBERS_TABLE no configurada");
  }

  // CONSULTA A DYNAMO - Obtener todos los grupos del usuario
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
    throw new Error("Error leyendo membresías en DynamoDB: " + err.message);
  }

  // PROCESAR MEMBERSHIPS - Solo información básica
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

  // CALCULAR TODOS LOS PERMISOS POR GRUPO
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

  return successResponse({
    user_sub: userSub,
    groups,
    has_admin_permissions: hasAdminPermissions,
    permissions_by_group: permissionsByGroup,
    message: "Permisos calculados para todos los grupos"
  });
}

module.exports.getMyPermissions = createAPIHandler(getMyPermissionsHandler, { rateLimit: { maxRequests: 200, windowSeconds: 60 } });


async function checkPermissionHandler(event, context, logger) {
  const userSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const { permission, group_id } = JSON.parse(event.body || "{}");

  if (!permission || !group_id) {
    throw new ValidationError("permission y group_id son obligatorios");
  }
  if (!userSub) {
    throw new AuthorizationError("Usuario no autenticado");
  }

  const hasAccess = await verifyPermission(userSub, group_id, permission, logger);
  logger.info("Verificación de permiso", { userSub, group_id, permission, hasAccess });

  return successResponse({
    user_sub: userSub,
    group_id,
    permission,
    has_access: hasAccess,
    message: hasAccess ? "Acceso permitido" : "Acceso denegado - Principio del mínimo permiso"
  });
}

module.exports.checkPermission = createAPIHandler(checkPermissionHandler, { rateLimit: { maxRequests: 500, windowSeconds: 60 } });

async function listAvailablePermissionsHandler(event, context, logger) {
  logger.info("Listando permisos disponibles", { total: Object.keys(AVAILABLE_PERMISSIONS).length });

  return successResponse({
    permissions: AVAILABLE_PERMISSIONS,
    roles: PREDEFINED_ROLES,
    total_permissions: Object.keys(AVAILABLE_PERMISSIONS).length
  });
}

module.exports.listAvailablePermissions = createAPIHandler(listAvailablePermissionsHandler, { rateLimit: { maxRequests: 150, windowSeconds: 60 } });

async function listUsersWithRolesHandler(event, context, logger) {
  const requesterSub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  const group_id = event.queryStringParameters?.group_id;
  const role = event.queryStringParameters?.role;

  if (!group_id) {
    throw new ValidationError("Debe especificar un group_id para consultar");
  }

  const hasPermission = await verifyPermission(requesterSub, group_id, "admin.users", logger);
  if (!hasPermission) {
    throw new AuthorizationError("No tienes permiso para listar miembros de este grupo");
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

  return successResponse({ 
    group_id, 
    role: role || 'all', 
    members, 
    total: members.length, 
    requested_by: requesterSub 
  });
}

module.exports.listUsersWithRoles = createAPIHandler(listUsersWithRolesHandler, { rateLimit: { maxRequests: 100, windowSeconds: 60 } });

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

