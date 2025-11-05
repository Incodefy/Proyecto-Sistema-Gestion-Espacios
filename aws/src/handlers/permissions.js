// src/handlers/permissions.js
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Repositorio de permisos disponibles (cumple requisito: Define repositorio de permisos)
const AVAILABLE_PERMISSIONS = {
  // Dashboard
  'dashboard.read': 'Ver Dashboard',
  'dashboard.write': 'Modificar Dashboard',
  
  // Agenda
  'agenda.read': 'Ver Agenda', 
  'agenda.write': 'Gestionar Agenda',
  
  // Box
  'box.read': 'Ver Box',
  'box.write': 'Gestionar Box',
  'box.detalle.read': 'Ver Detalle de Box',
  'box.detalle.write': 'Modificar Detalle de Box',
  
  // Datos (Import/Export)
  'data.import': 'Importar Datos',
  'data.export': 'Exportar Datos', 
  
  // Médicos (solo lectura - parece ser consulta)
  'medicos.read': 'Ver Médicos',
  
  // Notificaciones
  'notificaciones.read': 'Ver Notificaciones',
  'notificaciones.historial': 'Ver Historial de Notificaciones',
  
  // Administración
  'admin.users': 'Administrar Sistema'
};

// Roles predefinidos (cumple requisito: Permite diseño gestión de roles)
const PREDEFINED_ROLES = {
  'consulta': [
    'dashboard.read', 'agenda.read', 'box.read', 'box.detalle.read',
    'medicos.read', 'notificaciones.read', 'notificaciones.historial'
  ],
  'operador': [
    'dashboard.read', 'agenda.read', 'agenda.write', 'box.read', 'box.write',
    'box.detalle.read', 'medicos.read', 'notificaciones.read'
  ],
  'gestor': [
    'dashboard.read', 'dashboard.write', 'agenda.read', 'agenda.write',
    'box.read', 'box.write', 'box.detalle.read', 'box.detalle.write',
    'data.import', 'data.export', 'medicos.read', 
    'notificaciones.read', 'notificaciones.historial'
  ],
  'medico': [
    'dashboard.read', 'agenda.read', 'medicos.read', 
    'notificaciones.read', 'notificaciones.historial'
  ],
  'admin': ['admin.users']
};

/**
 * Función para verificar permisos (Circuit Breaker)
 * Aplica concepto del mínimo permiso
 */
const checkPermission = async (userEmail, requiredPermission) => {
  try {
    // Obtener permisos del usuario
    const result = await docClient.send(new GetCommand({
      TableName: process.env.USER_ROLES_TABLE,
      Key: { user_email: userEmail }
    }));

    if (!result.Item) {
      return false; // Usuario sin permisos asignados
    }

    const userPermissions = result.Item.permissions || [];
    
    // Si tiene admin.users, puede todo
    if (userPermissions.includes('admin.users')) {
      return true;
    }

    // Verificar permiso específico (principio del mínimo permiso)
    return userPermissions.includes(requiredPermission);

  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
};

/**
 * POST /admin/assign-role
 * Asignar rol a usuario
 */
module.exports.assignRole = async (event) => {
  try {
    const { user_email, role } = JSON.parse(event.body || '{}');
    
    if (!user_email || !role) {
      return response(400, { ok: false, error: 'user_email y role son obligatorios' });
    }

    // Verificar que el rol existe
    if (!PREDEFINED_ROLES[role]) {
      return response(400, { 
        ok: false, 
        error: 'Rol no válido',
        available_roles: Object.keys(PREDEFINED_ROLES)
      });
    }

    // Asignar permisos del rol al usuario
    const permissions = PREDEFINED_ROLES[role];

    await docClient.send(new PutCommand({
      TableName: process.env.USER_ROLES_TABLE,
      Item: {
        user_email,
        role,
        permissions,
        assigned_at: new Date().toISOString()
      }
    }));

    return response(200, {
      ok: true,
      message: 'Rol asignado correctamente',
      user_email,
      role,
      permissions
    });

  } catch (err) {
    console.error('Error assigning role:', err);
    return response(500, { ok: false, error: 'Error interno del servidor' });
  }
};

/**
 * GET /my-permissions
 * Obtener permisos del usuario autenticado
 */
module.exports.getMyPermissions = async (event) => {
  try {
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!userEmail) {
      return response(401, { ok: false, error: 'Usuario no autenticado' });
    }

    const result = await docClient.send(new GetCommand({
      TableName: process.env.USER_ROLES_TABLE,
      Key: { user_email: userEmail }
    }));

    const userPermissions = result.Item || { 
      user_email: userEmail, 
      role: 'none', 
      permissions: [] 
    };

    // Generar configuración UI basada en permisos
    const uiConfig = generateUIConfig(userPermissions.permissions || []);

    return response(200, {
      ok: true,
      ...userPermissions,
      ui_config: uiConfig
    });

  } catch (err) {
    console.error('Error getting permissions:', err);
    return response(500, { ok: false, error: 'Error interno del servidor' });
  }
};

/**
 * POST /check-permission
 * Verificar un permiso específico (usado como Circuit Breaker)
 */
module.exports.checkPermission = async (event) => {
  try {
    const { permission } = JSON.parse(event.body || '{}');
    const userEmail = event.requestContext?.authorizer?.jwt?.claims?.email;
    
    if (!permission) {
      return response(400, { ok: false, error: 'permission es obligatorio' });
    }

    if (!userEmail) {
      return response(401, { ok: false, error: 'Usuario no autenticado' });
    }

    const hasAccess = await checkPermission(userEmail, permission);

    return response(200, {
      ok: true,
      user_email: userEmail,
      permission,
      has_access: hasAccess,
      message: hasAccess ? 'Acceso permitido' : 'Acceso denegado - Principio del mínimo permiso'
    });

  } catch (err) {
    console.error('Error verifying permission:', err);
    return response(500, { ok: false, error: 'Error interno del servidor' });
  }
};

/**
 * GET /admin/available-permissions
 * Listar permisos disponibles en el sistema
 */
module.exports.listAvailablePermissions = async (event) => {
  try {
    return response(200, {
      ok: true,
      permissions: AVAILABLE_PERMISSIONS,
      roles: PREDEFINED_ROLES,
      total_permissions: Object.keys(AVAILABLE_PERMISSIONS).length
    });
  } catch (err) {
    console.error('Error listing permissions:', err);
    return response(500, { ok: false, error: 'Error interno del servidor' });
  }
};

/**
 * Generar configuración de UI basada en permisos
 */
function generateUIConfig(permissions) {
  const config = {
    can_view_dashboard: permissions.includes('dashboard.read') || permissions.includes('admin.users'),
    can_admin_dashboard: permissions.includes('dashboard.admin') || permissions.includes('admin.users'),
    can_view_agenda: permissions.includes('agenda.read') || permissions.includes('admin.users'),
    can_edit_agenda: permissions.includes('agenda.write') || permissions.includes('admin.users'),
    can_view_box: permissions.includes('box.read') || permissions.includes('admin.users'),
    can_edit_box: permissions.includes('box.write') || permissions.includes('admin.users'),
    can_view_consultas: permissions.includes('consultas.read') || permissions.includes('admin.users'),
    can_edit_consultas: permissions.includes('consultas.write') || permissions.includes('admin.users'),
    is_admin: permissions.includes('admin.users')
  };

  return config;
}

// Exportar función para usar en otras lambdas
module.exports.checkPermission = checkPermission;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}