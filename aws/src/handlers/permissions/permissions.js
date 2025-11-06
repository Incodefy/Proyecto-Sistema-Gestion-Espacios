// src/handlers/permissions.js
const config = require('../../config/config');

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const fs = require('fs');
const path = require('path');
const { retryWithJitter } = require("../../utils/retry");
const { createCircuitBreaker } = require("../../utils/circuitBreaker");
const { wasAlreadyProcessed, markAsProcessed } = require("../../utils/idempotency");

const dynamoBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 20000 });

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// === Cargar la configuración de permisos desde el archivo JSON definido en config.js ===
const permissionsPath = path.resolve(config.roles.available_permissions_path);
if (!fs.existsSync(permissionsPath)) {
  throw new Error(`Archivo de permisos no encontrado: ${permissionsPath}`);
}
const permissionsData = JSON.parse(fs.readFileSync(permissionsPath, 'utf-8'));
const { AVAILABLE_PERMISSIONS, PREDEFINED_ROLES } = permissionsData;

/**
 * Verifica si un usuario tiene un permiso específico
 * (renombrada desde checkPermission para evitar colisión de exports)
 */
async function verifyPermission(userEmail, requiredPermission) {
  try {
    if (!dynamoBreaker.shouldAllow()) {
      console.warn("[Permissions] Circuit breaker activo (lectura DynamoDB).");
      throw new Error("CircuitBreakerOpen");
    }

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

    if (!result.Item) return false;
    const userPermissions = result.Item.permissions || [];

    if (userPermissions.includes("admin.users")) return true;
    return userPermissions.includes(requiredPermission);
  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Permissions] Error verificando permiso:", err);
    return false;
  }
}

/**
 * POST /assign-role
 * Asigna un rol a un usuario con idempotencia y resiliencia
 */
module.exports.assignRole = async (event) => {
  try {
    const { user_email, role } = JSON.parse(event.body || "{}");

    if (!user_email || !role) {
      return response(400, { ok: false, error: "user_email y role son obligatorios" });
    }

    if (!PREDEFINED_ROLES[role]) {
      return response(400, {
        ok: false,
        error: "Rol no válido",
        available_roles: Object.keys(PREDEFINED_ROLES),
      });
    }

    const idempotencyKey = `assignRole-${user_email}-${role}`;
    if (await wasAlreadyProcessed(idempotencyKey)) {
      console.log(`[Permissions] ⏭️ Asignación ya procesada: ${idempotencyKey}`);
      return response(200, { ok: true, message: "Rol ya estaba asignado" });
    }

    const permissions = PREDEFINED_ROLES[role];
    const item = {
      user_email,
      role,
      permissions,
      assigned_at: new Date().toISOString(),
    };

    if (!dynamoBreaker.shouldAllow()) {
      console.warn("[Permissions] Circuit breaker activo (DynamoDB). Operación pausada.");
      throw new Error("CircuitBreakerOpen");
    }

    await retryWithJitter(
      async () => {
        await docClient.send(new PutCommand({
          TableName: process.env.USER_ROLES_TABLE,
          Item: item,
        }));
        dynamoBreaker.reportSuccess();
      },
      { maxAttempts: 3, baseDelayMs: 400 }
    );

    await markAsProcessed(idempotencyKey);
    console.log(`[Permissions] Rol asignado correctamente a ${user_email}: ${role}`);

    return response(200, {
      ok: true,
      message: "Rol asignado correctamente",
      user_email,
      role,
      permissions,
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Permissions] ❌ Error asignando rol:", err.message);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * DELETE /remove-role
 * Remueve un rol de usuario con retry + breaker
 */
module.exports.removeRole = async (event) => {
  try {
    const adminEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    const { user_email } = JSON.parse(event.body || "{}");

    if (!user_email) {
      return response(400, { ok: false, error: "user_email es obligatorio" });
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
      return response(404, { ok: false, error: "Usuario no tiene rol asignado" });
    }

    if (user_email === adminEmail) {
      return response(403, { ok: false, error: "No puedes eliminar tu propio rol" });
    }

    const removedRole = userCheck.Item.role;
    const removedPermissions = userCheck.Item.permissions;

    if (!dynamoBreaker.shouldAllow()) {
      console.warn("[Permissions] Circuit breaker activo (DynamoDB). Eliminación pausada.");
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

    console.log(`[Permissions] Rol eliminado de ${user_email}: ${removedRole}`);

    return response(200, {
      ok: true,
      message: "Rol removido correctamente",
      user_email,
      removed_role: removedRole,
      removed_permissions: removedPermissions,
      removed_by: adminEmail,
      removed_at: new Date().toISOString()
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Permissions] Error removiendo rol:", err);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * GET /my-permissions
 * Obtiene los permisos del usuario autenticado
 */
module.exports.getMyPermissions = async (event) => {
  try {
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    if (!userEmail) return response(401, { ok: false, error: "Usuario no autenticado" });

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

    const userPermissions = result.Item || { user_email: userEmail, role: "none", permissions: [] };
    const uiConfig = generateUIConfig(userPermissions.permissions || []);

    return response(200, { ok: true, ...userPermissions, ui_config: uiConfig });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Permissions] Error obteniendo permisos:", err);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * POST /check-permission
 * Verifica si el usuario tiene un permiso
 */
module.exports.checkPermission = async (event) => {
  try {
    const { permission } = JSON.parse(event.body || "{}");
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;

    if (!permission) return response(400, { ok: false, error: "permission es obligatorio" });
    if (!userEmail) return response(401, { ok: false, error: "Usuario no autenticado" });

    const hasAccess = await verifyPermission(userEmail, permission);

    return response(200, {
      ok: true,
      user_email: userEmail,
      permission,
      has_access: hasAccess,
      message: hasAccess ? "Acceso permitido" : "Acceso denegado - Principio del mínimo permiso"
    });

  } catch (err) {
    console.error("[Permissions] Error verificando permiso:", err);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * GET /admin/available-permissions
 * Lista los permisos disponibles
 */
module.exports.listAvailablePermissions = async () => {
  try {
    return response(200, {
      ok: true,
      permissions: AVAILABLE_PERMISSIONS,
      roles: PREDEFINED_ROLES,
      total_permissions: Object.keys(AVAILABLE_PERMISSIONS).length
    });
  } catch (err) {
    console.error("[Permissions] Error listando permisos:", err);
    return response(500, { ok: false, error: "Error interno del servidor" });
  }
};

/**
 * GET /users-with-roles
 * Lista usuarios con un rol específico
 */
module.exports.listUsersWithRoles = async (event) => {
  try {
    const adminEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    const role = event.queryStringParameters?.role;
    if (!role) return response(400, { ok: false, error: "Debe especificar un rol para consultar" });

    if (!dynamoBreaker.shouldAllow()) {
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

    return response(200, { ok: true, role, users, total: users.length, requested_by: adminEmail });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error("[Permissions] Error listando usuarios con roles:", err);
    return response(500, { ok: false, error: "Error interno del servidor", details: err.message });
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

/**
 * Estructura estándar de respuesta
 */
function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}
