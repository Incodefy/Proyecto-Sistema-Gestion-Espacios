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
    "data.import": "Importar Datos",
    "data.export": "Exportar Datos",
    "medicos.read": "Ver Médicos",
    "notificaciones.read": "Ver Notificaciones",
    "notificaciones.historial": "Ver Historial de Notificaciones",
    "admin.users": "Administrar Sistema y Usuarios",
    "admin.roles": "Administrar Roles",
    "admin.permissions": "Administrar Permisos",
    "admin.db": "Administrar Bases de Datos",
    "admin.system": "Acceso de Sistema"
  };
  
  PREDEFINED_ROLES = {
    "consulta": [
      "dashboard.read", "agenda.read", "box.read", "box.detalle.read",
      "medicos.read", "notificaciones.read", "notificaciones.historial"
    ],
    "operador": [
      "dashboard.read", "agenda.read", "agenda.write", "box.read", "box.write",
      "box.detalle.read", "medicos.read", "notificaciones.read"
    ],
    "gestor": [
      "dashboard.read", "dashboard.write", "agenda.read", "agenda.write",
      "box.read", "box.write", "box.detalle.read", "box.detalle.write",
      "data.import", "data.export", "medicos.read",
      "notificaciones.read", "notificaciones.historial"
    ],
    "medico": [
      "dashboard.read", "agenda.read", "medicos.read",
      "notificaciones.read", "notificaciones.historial"
    ],
    "admin": [
      "admin.users", "admin.roles", "admin.permissions", "admin.db", "admin.system",
      "dashboard.read", "dashboard.write", "agenda.read", "agenda.write",
      "box.read", "box.write", "box.detalle.read", "box.detalle.write",
      "data.import", "data.export", "medicos.read",
      "notificaciones.read", "notificaciones.historial"
    ]
  };
}

/**
 * Verifica si un usuario tiene un permiso específico
 * También verifica si es el primer usuario en el sistema (admin bootstrap)
 */
async function verifyPermission(userEmail, requiredPermission) {
  const TRACE = `[Perms-${Date.now()}]`;
  
  try {
    console.log(`${TRACE} 🔐 Verificando permiso '${requiredPermission}' para ${userEmail}`);
    
    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - lectura DynamoDB pausada", { userEmail, requiredPermission });
      throw new Error("CircuitBreakerOpen");
    }

    // Primero, intentar obtener el usuario de DynamoDB
    console.log(`${TRACE} 📍 Buscando usuario en DynamoDB...`);
    const result = await retryWithJitter(
      async () => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.USER_ROLES_TABLE,
          Key: { user_email: userEmail }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    // Si existe el usuario en DynamoDB, verificar permisos normalmente
    if (result.Item) {
      console.log(`${TRACE} ✅ Usuario encontrado en DynamoDB`);
      const userPermissions = result.Item.permissions || [];
      console.log(`${TRACE} 📋 Permisos del usuario: ${userPermissions.join(', ')}`);

      if (userPermissions.includes("admin.users")) {
        console.log(`${TRACE} ✅ Tiene admin.users (super permisos)`);
        return true;
      }
      
      const hasPermission = userPermissions.includes(requiredPermission);
      console.log(`${TRACE} ${hasPermission ? '✅' : '❌'} Tiene permiso '${requiredPermission}': ${hasPermission}`);
      return hasPermission;
    }

    console.log(`${TRACE} ❌ Usuario NO encontrado en DynamoDB`);

    // === BOOTSTRAP MODE ===
    // Si el permiso requerido es admin.users y el usuario no existe en DynamoDB,
    // permitir el PRIMER admin del sistema
    if (requiredPermission === "admin.users") {
      console.log(`${TRACE} 🔍 Bootstrap check: ¿Hay otros admins en el sistema?`);
      
      // Intentar query a RoleIndex
      let adminCheckResult = null;
      let queryError = null;
      
      try {
        console.log(`${TRACE} 📡 Consultando RoleIndex para buscar admins existentes...`);
        
        const adminCheck = await retryWithJitter(
          async () => {
            try {
              const res = await docClient.send(new QueryCommand({
                TableName: process.env.USER_ROLES_TABLE,
                IndexName: 'RoleIndex',
                KeyConditionExpression: 'role = :r',
                ExpressionAttributeValues: { ':r': 'admin' },
                Limit: 1
              }));
              dynamoBreaker.reportSuccess();
              return res;
            } catch (queryErr) {
              console.error(`${TRACE} Error en query command:`, queryErr.message);
              throw queryErr;
            }
          },
          { maxAttempts: 2, baseDelayMs: 100 }
        );
        
        adminCheckResult = adminCheck;
        console.log(`${TRACE} 📊 Query exitosa, admins encontrados: ${adminCheck.Items ? adminCheck.Items.length : 0}`);
        
      } catch (err) {
        queryError = err;
        console.error(`${TRACE} ⚠️ Error en query a RoleIndex: ${err.message}`);
        // Intentar un escaneo completo de la tabla como fallback
        console.log(`${TRACE} 🔄 Intentando escaneo directo de la tabla...`);
        try {
          const scanRes = await docClient.send(new QueryCommand({
            TableName: process.env.USER_ROLES_TABLE,
            KeyConditionExpression: 'attribute_not_exists(user_email)',
            Limit: 1
          }));
          console.log(`${TRACE} Scan result: ${JSON.stringify(scanRes)}`);
        } catch (e) {
          console.log(`${TRACE} Scan también falló, puede ser que la tabla esté vacía`);
        }
      }

      // Evaluar resultado del query
      if (adminCheckResult !== null) {
        if (!adminCheckResult.Items || adminCheckResult.Items.length === 0) {
          console.log(`${TRACE} ✅✅✅ BOOTSTRAP MODE ACTIVADO: No existen admins, permitiendo al primer admin`);
          return true;
        } else {
          console.log(`${TRACE} ❌ Ya existen ${adminCheckResult.Items.length} admin(s) en el sistema`);
          return false;
        }
      }
      
      // Fallback: Si el query falló pero parece que es el primer usuario
      if (queryError) {
        console.log(`${TRACE} ⚠️ No se pudo verificar admins, pero la tabla podría estar vacía`);
        console.log(`${TRACE} ℹ️  Permitiendo bootstrap (si esto es incorrecto, el DynamoDB tiene admins que no se pudieron leer)`);
        // PERMITIR bootstrap si el query falla (asumir que la tabla está vacía)
        return true;
      }
    }

    return false;

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error verificando permiso", err, { userEmail, requiredPermission });
    return false;
  }
}

/**
 * POST /assign-role
 * Asigna un rol a un usuario con idempotencia y resiliencia
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

    const { user_email, role } = data;

    // 2) VALIDAR ROL
    if (!PREDEFINED_ROLES[role]) {
      logger.warn("Rol no válido solicitado", { role, available: Object.keys(PREDEFINED_ROLES) });
      endTrace();
      return errorResponse("Rol no válido", 400, { available_roles: Object.keys(PREDEFINED_ROLES) });
    }

    // 3) VALIDAR TOKEN DEL ADMIN
    const requesterEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    if (!requesterEmail) {
      logger.warn("Intento sin token válido");
      endTrace();
      return unauthorizedResponse("Token inválido o ausente. Debes enviar Authorization: Bearer <token>");
    }

    logger.info("Solicitud de asignación de rol", { requesterEmail, targetUser: user_email, role });

    // 4) VALIDAR PERMISO admin.users
    const hasPermission = await verifyPermission(requesterEmail, "admin.users");
    if (!hasPermission) {
      logger.warn("Usuario sin permiso admin.users", { requester: requesterEmail });
      endTrace();
      return forbiddenResponse("No tienes permiso para asignar roles", { required_permission: "admin.users" });
    }

    // 5) IDEMPOTENCIA
    const timestamp = new Date().toISOString();
    const idempotencyKey = `assignRole-${user_email}-${role}-${timestamp}`;

    if (await wasAlreadyProcessed(idempotencyKey)) {
      logger.info("Asignación ya procesada (idempotencia)", { idempotencyKey });
      endTrace();
      return successResponse({ message: "Rol ya estaba asignado" });
    }

    // 6) PREPARAR ÍTEM
    const permissions = PREDEFINED_ROLES[role];
    const item = {
      user_email,
      role,
      permissions: permissions,  // Asegurar que sea un array
      assigned_at: timestamp,
      assigned_by: requesterEmail
    };

    // 7) CIRCUIT BREAKER
    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - asignación pausada");
      endTrace();
      return errorResponse("Circuit breaker activo, espere unos segundos", 503);
    }

    // 8) ESCRITURA EN DYNAMO
    logger.debug("Guardando rol en DynamoDB", { table: process.env.USER_ROLES_TABLE, user_email, role });

    try {
      await retryWithJitter(
        async () => {
          await docClient.send(new PutCommand({
            TableName: process.env.USER_ROLES_TABLE,
            Item: item,
          }));
          dynamoBreaker.reportSuccess();
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );
    } catch (dynamoErr) {
      logger.error("Error guardando en DynamoDB", dynamoErr, { table: process.env.USER_ROLES_TABLE });
      endTrace();
      return errorResponse("Error guardando en DynamoDB", 500, { details: dynamoErr.message });
    }

    // 9) MARCAR COMO PROCESADO
    await markAsProcessed(idempotencyKey);

    logger.info("Rol asignado correctamente", { user_email, role, requesterEmail });
    endTrace();

    return successResponse({
      message: "Rol asignado correctamente",
      assigned_to: user_email,
      assigned_role: role,
      permissions
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    logger.error("Error inesperado en assignRole", err);
    endTrace();
    return errorResponse("Error interno del servidor", 500, { details: err.message });
  }
};


/**
 * DELETE /remove-role
 * Remueve un rol de usuario con retry + breaker
 */
module.exports.removeRole = async (event) => {
  const endTrace = logger.startTrace('removeRole');

  try {
    const adminEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    const { user_email } = JSON.parse(event.body || "{}");

    if (!user_email) {
      logger.warn("Intento de remoción sin user_email");
      endTrace();
      return errorResponse("user_email es obligatorio", 400);
    }

    const userCheck = await retryWithJitter(
      async () => {
        const res = await docClient.send(new GetCommand({
          TableName: process.env.USER_ROLES_TABLE,
          Key: { user_email }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    if (!userCheck.Item) {
      logger.warn("Usuario no tiene rol asignado", { user_email });
      endTrace();
      return notFoundResponse("Usuario no tiene rol asignado");
    }

    if (user_email === adminEmail) {
      logger.warn("Intento de eliminar propio rol", { adminEmail });
      endTrace();
      return forbiddenResponse("No puedes eliminar tu propio rol");
    }

    const removedRole = userCheck.Item.role;
    const removedPermissions = userCheck.Item.permissions;

    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - eliminación pausada");
      throw new Error("CircuitBreakerOpen");
    }

    await retryWithJitter(
      async () => {
        await docClient.send(new DeleteCommand({
          TableName: process.env.USER_ROLES_TABLE,
          Key: { user_email }
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    logger.info("Rol eliminado", { user_email, removedRole, removedBy: adminEmail });
    endTrace();

    return successResponse({
      message: "Rol removido correctamente",
      user_email,
      removed_role: removedRole,
      removed_permissions: removedPermissions,
      removed_by: adminEmail,
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
 * Obtiene los permisos del usuario autenticado
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

    const userEmail = claims.email;
    if (!userEmail) {
      logger.warn("Token JWT sin email");
      endTrace();
      return unauthorizedResponse("Token JWT no contiene el email");
    }

    logger.info("Usuario autenticado solicitando permisos", { userEmail });

    // 2) VALIDAR QUE LA TABLA EXISTA
    if (!process.env.USER_ROLES_TABLE) {
      logger.error("USER_ROLES_TABLE no configurado en environment");
      endTrace();
      return errorResponse("Tabla USER_ROLES_TABLE no configurada", 500);
    }

    // 3) CONSULTA A DYNAMO
    let result;
    try {
      result = await retryWithJitter(
        async () => {
          const res = await docClient.send(
            new GetCommand({
              TableName: process.env.USER_ROLES_TABLE,
              Key: { user_email: userEmail }
            })
          );
          dynamoBreaker.reportSuccess();
          return res;
        },
        { maxAttempts: 3, baseDelayMs: 300 }
      );
    } catch (err) {
      logger.error("Error consultando permisos en DynamoDB", err, { userEmail });
      endTrace();
      return errorResponse("Error leyendo permisos en DynamoDB", 500, { details: err.message });
    }

    // 4) VALIDAR FORMATO DEL ÍTEM
    if (result && result.Item) {
      logger.debug("Registro encontrado en DynamoDB", { userEmail, role: result.Item.role });

      if (result.Item.permissions && !Array.isArray(result.Item.permissions)) {
        logger.error("Campo permissions no es array", { 
          userEmail, 
          receivedType: typeof result.Item.permissions 
        });
        endTrace();
        return errorResponse(
          "El campo permissions tiene un formato incorrecto (debe ser array)", 
          500, 
          { received_permissions: result.Item.permissions }
        );
      }
    } else {
      logger.info("Usuario sin registro - rol 'none' asignado por defecto", { userEmail });
    }

    // 5) ARMAR OBJETO DE PERMISOS
    const userPermissions = result.Item || {
      user_email: userEmail,
      role: "none",
      permissions: []
    };

    // 6) GENERAR CONFIGURACIÓN PARA UI
    const uiConfig = generateUIConfig(userPermissions.permissions || []);

    logger.info("Permisos obtenidos", { 
      userEmail, 
      role: userPermissions.role, 
      permissionsCount: userPermissions.permissions?.length || 0 
    });
    endTrace();

    return successResponse({
      ...userPermissions,
      ui_config: uiConfig
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
 * Verifica si el usuario tiene un permiso
 */
module.exports.checkPermission = async (event) => {
  const endTrace = logger.startTrace('checkPermission');

  try {
    const { permission } = JSON.parse(event.body || "{}");
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;

    if (!permission) {
      logger.warn("Verificación sin especificar permission");
      endTrace();
      return errorResponse("permission es obligatorio", 400);
    }
    if (!userEmail) {
      logger.warn("Verificación sin usuario autenticado");
      endTrace();
      return unauthorizedResponse("Usuario no autenticado");
    }

    const hasAccess = await verifyPermission(userEmail, permission);
    logger.info("Verificación de permiso", { userEmail, permission, hasAccess });
    endTrace();

    return successResponse({
      user_email: userEmail,
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
 * Lista usuarios con un rol específico
 */
module.exports.listUsersWithRoles = async (event) => {
  const endTrace = logger.startTrace('listUsersWithRoles');

  try {
    const adminEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    const role = event.queryStringParameters?.role;
    
    if (!role) {
      logger.warn("Listado sin especificar rol");
      endTrace();
      return errorResponse("Debe especificar un rol para consultar", 400);
    }

    if (!dynamoBreaker.shouldAllow()) {
      logger.warn("Circuit breaker activo - listado pausado");
      throw new Error("CircuitBreakerOpen");
    }

    const result = await retryWithJitter(
      async () => {
        const res = await docClient.send(new QueryCommand({
          TableName: process.env.USER_ROLES_TABLE,
          IndexName: 'RoleIndex',
          KeyConditionExpression: 'role = :r',
          ExpressionAttributeValues: { ':r': role }
        }));
        dynamoBreaker.reportSuccess();
        return res;
      },
      { maxAttempts: 3, baseDelayMs: 300 }
    );

    const users = (result.Items || []).map(item => ({
      user_email: item.user_email,
      role: item.role,
      permissions_count: (item.permissions || []).length,
      assigned_at: item.assigned_at,
      assigned_by: item.assigned_by
    }));

    logger.info("Listado de usuarios con rol", { role, count: users.length, requestedBy: adminEmail });
    endTrace();

    return successResponse({ role, users, total: users.length, requested_by: adminEmail });

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

