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
      console.warn(`${TRACE} Circuit breaker activo (lectura DynamoDB).`);
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
    console.error(`${TRACE} ❌ Error inesperado en verifyPermission:`, err);
    return false;
  }
}

/**
 * POST /assign-role
 * Asigna un rol a un usuario con idempotencia y resiliencia
 */
module.exports.assignRole = async (event) => {
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [AssignRole] Inicio asignación | ${TRACE_ID} ===`);

  try {
    console.log(`[${TRACE_ID}] 🔎 Validando entrada...`);

    // 0) VALIDAR QUE LA TABLA EXISTA
    if (!process.env.USER_ROLES_TABLE) {
      console.error(`[${TRACE_ID}] ❌ USER_ROLES_TABLE no está definido en environment`);
      return response(500, {
        ok: false,
        error: "Tabla USER_ROLES_TABLE no configurada",
        trace_id: TRACE_ID
      });
    }

    // 1) PARSEO DEL BODY
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (jsonErr) {
      console.error(`[${TRACE_ID}] ❌ Error parseando JSON`, jsonErr);
      return response(400, { ok: false, error: "JSON inválido en el body", trace_id: TRACE_ID });
    }

    const { user_email, role } = body;

    // 2) VALIDACIONES BÁSICAS
    if (!user_email || !role) {
      console.warn(`[${TRACE_ID}] ⚠️ Campos faltantes`);
      return response(400, {
        ok: false,
        error: "user_email y role son obligatorios",
        received: body,
        trace_id: TRACE_ID
      });
    }

    // 3) VALIDACIÓN FORMATO EMAIL
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      console.warn(`[${TRACE_ID}] ⚠️ Formato de email inválido`);
      return response(400, {
        ok: false,
        error: "Formato de email inválido",
        user_email,
        trace_id: TRACE_ID
      });
    }

    // 4) VALIDACIÓN DE ROL
    if (!PREDEFINED_ROLES[role]) {
      console.warn(`[${TRACE_ID}] ⚠️ Rol no encontrado en PREDEFINED_ROLES`);
      return response(400, {
        ok: false,
        error: "Rol no válido",
        available_roles: Object.keys(PREDEFINED_ROLES),
        trace_id: TRACE_ID
      });
    }

    // 5) VALIDAR TOKEN DEL ADMIN
    const requesterEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    if (!requesterEmail) {
      console.warn(`[${TRACE_ID}] ❌ No hay token válido en Authorization`);
      return response(401, {
        ok: false,
        error: "Token inválido o ausente. Debes enviar Authorization: Bearer <token>",
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 👤 Petición hecha por: ${requesterEmail}`);

    // 6) VALIDAR QUE EL ADMIN TENGA permiso admin.users
    const hasPermission = await verifyPermission(requesterEmail, "admin.users");
    if (!hasPermission) {
      console.warn(`[${TRACE_ID}] ❌ Usuario no tiene permiso admin.users`);
      console.warn(`[${TRACE_ID}] ℹ️ El usuario solo puede asignar roles si es admin o es el primer admin del sistema`);
      return response(403, {
        ok: false,
        error: "No tienes permiso para asignar roles. Solo administradores pueden asignar roles.",
        details: "Para que un usuario pueda asignar roles, debe tener el permiso 'admin.users'. El primer admin del sistema se puede crear automáticamente.",
        required_permission: "admin.users",
        requester: requesterEmail,
        trace_id: TRACE_ID
      });
    }

    // 7) IDEMPOTENCIA
    const timestamp = new Date().toISOString();
    const idempotencyKey = `assignRole-${user_email}-${role}-${timestamp}`;

    console.log(`[${TRACE_ID}] 🔁 Verificando idempotencia...`);
    if (await wasAlreadyProcessed(idempotencyKey)) {
      console.log(`[${TRACE_ID}] ⏭️ Asignación ya procesada`);
      return response(200, {
        ok: true,
        message: "Rol ya estaba asignado",
        trace_id: TRACE_ID
      });
    }

    // 8) PREPARAR ÍTEM PARA DYNAMO - PERMISOS COMO ARRAY
    const permissions = Array.isArray(PREDEFINED_ROLES[role]) 
      ? PREDEFINED_ROLES[role] 
      : Object.values(PREDEFINED_ROLES[role] || {});
    
    console.log(`[${TRACE_ID}] 📋 Permisos a asignar:`, permissions);

    const item = {
      user_email,
      role,
      permissions: permissions,  // Asegurar que sea un array
      assigned_at: timestamp,
      assigned_by: requesterEmail
    };

    // 9) BREAKER
    if (!dynamoBreaker.shouldAllow()) {
      console.warn(`[${TRACE_ID}] ⚠️ Circuit breaker activo`);
      return response(503, {
        ok: false,
        error: "Circuit breaker activo, espere unos segundos",
        trace_id: TRACE_ID
      });
    }

    // 10) ESCRITURA EN DYNAMO
    console.log(`[${TRACE_ID}] 💾 Guardando en Dynamo: ${process.env.USER_ROLES_TABLE}...`);

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
      console.error(`[${TRACE_ID}] ❌ Error al guardar en Dynamo`, dynamoErr);
      return response(500, {
        ok: false,
        error: "Error guardando en DynamoDB",
        details: dynamoErr.message,
        table: process.env.USER_ROLES_TABLE,
        trace_id: TRACE_ID
      });
    }

    // 11) MARCAR COMO PROCESADO
    await markAsProcessed(idempotencyKey);

    console.log(`[${TRACE_ID}] ✅ Rol asignado correctamente`);

    return response(200, {
      ok: true,
      message: "Rol asignado correctamente",
      assigned_to: user_email,
      assigned_role: role,
      permissions,
      trace_id: TRACE_ID
    });

  } catch (err) {
    dynamoBreaker.reportFailure();
    console.error(`[${TRACE_ID}] ❌ Error inesperado`, err);

    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
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
  const TRACE_ID = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`\n=== [getMyPermissions] Inicio | ${TRACE_ID} ===`);

  try {
    // 1) VALIDAR TOKEN
    console.log(`[${TRACE_ID}] 🔍 Validando token...`);

    const claims = event.requestContext?.authorizer?.jwt?.claims;
    if (!claims) {
      console.warn(`[${TRACE_ID}] ❌ No llegaron claims en el JWT (problema con authorizer Cognito)`);
      return response(401, {
        ok: false,
        error: "Token inválido o malformado",
        trace_id: TRACE_ID
      });
    }

    const userEmail = claims.email;
    if (!userEmail) {
      console.warn(`[${TRACE_ID}] ❌ El token no tiene email`);
      return response(401, {
        ok: false,
        error: "Token JWT no contiene el email",
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] ✅ Usuario autenticado: ${userEmail}`);

    // 2) VALIDAR QUE LA TABLA EXISTA
    if (!process.env.USER_ROLES_TABLE) {
      console.error(`[${TRACE_ID}] ❌ USER_ROLES_TABLE no está definido en environment`);
      return response(500, {
        ok: false,
        error: "Tabla USER_ROLES_TABLE no configurada",
        trace_id: TRACE_ID
      });
    }

    console.log(`[${TRACE_ID}] 📄 Consultando DynamoDB: ${process.env.USER_ROLES_TABLE}`);

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
      console.error(
        `[${TRACE_ID}] ❌ Error al consultar DynamoDB`,
        err.message
      );
      return response(500, {
        ok: false,
        error: "Error leyendo permisos en DynamoDB",
        details: err.message,
        trace_id: TRACE_ID
      });
    }

    // 4) VALIDAR QUE EL FORMATO DEL ÍTEM SEA CORRECTO
    if (result && result.Item) {
      console.log(`[${TRACE_ID}] ✅ Registro encontrado en DynamoDB`);

      if (result.Item.permissions && !Array.isArray(result.Item.permissions)) {
        console.error(
          `[${TRACE_ID}] ❌ El campo permissions NO es un array. Valor actual:`,
          result.Item.permissions
        );

        return response(500, {
          ok: false,
          error: "El campo permissions tiene un formato incorrecto (debe ser array)",
          received_permissions: result.Item.permissions,
          trace_id: TRACE_ID
        });
      }
    } else {
      console.warn(`[${TRACE_ID}] ⚠️ Usuario sin registro en la tabla, retornando rol 'none'`);
    }

    // 5) ARMAR OBJETO DE PERMISOS
    const userPermissions =
      result.Item || {
        user_email: userEmail,
        role: "none",
        permissions: []
      };

    console.log(
      `[${TRACE_ID}] 🎟️ Permisos obtenidos:`,
      userPermissions.permissions
    );

    // 6) GENERAR CONFIGURACIÓN PARA UI
    const uiConfig = generateUIConfig(userPermissions.permissions || []);

    console.log(`[${TRACE_ID}] ✅ Configuración UI generada`);

    return response(200, {
      ok: true,
      trace_id: TRACE_ID,
      ...userPermissions,
      ui_config: uiConfig
    });

  } catch (err) {
    dynamoBreaker.reportFailure();

    console.error(`[${TRACE_ID}] ❌ Error inesperado en getMyPermissions`, err);

    return response(500, {
      ok: false,
      error: "Error interno del servidor",
      details: err.message,
      trace_id: TRACE_ID
    });
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
