// test-permissions.js - Script para probar el sistema de permisos
require('dotenv').config({ path: './incodefy/.env' });
const fetch = require('node-fetch');

// Configuración
const API_BASE_URL = process.env.API_BASE_URL || 'https://owgdeiu0z8.execute-api.us-east-2.amazonaws.com';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '7325v6nu1ifgpuqd6etq8n3q0a';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-2_t1Juz0V3j';

// Credenciales de prueba (CAMBIAR ESTAS)
const TEST_USER = {
  email: 'admin@gmail.com',  // ← CAMBIAR ESTO
  password: 'Admin123!'        // ← CAMBIAR ESTO
};

// Grupo y permiso a probar
const TEST_GROUP_ID = 'grp_976290a5-9831-497a-983d-acb389622059';  // ← CAMBIAR ESTO si quieres probar otro grupo
const TEST_PERMISSION = 'dashboard.read';  // ← CAMBIAR ESTO para probar otro permiso

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  PASO ${step}: ${message}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);
}

function logError(error, context) {
  console.error(`\n${colors.red}❌ ERROR en ${context}:${colors.reset}`);
  console.error(`${colors.red}   Mensaje: ${error.message}${colors.reset}`);
  if (error.stack) {
    console.error(`${colors.red}   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}${colors.reset}`);
  }
}

async function testPermissions() {
  let tokens = null;
  let userSub = null;

  console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║   PRUEBA DE SISTEMA DE PERMISOS                                ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  log('🔧', `API Base URL: ${API_BASE_URL}`, colors.blue);
  log('🔧', `Cognito Client ID: ${COGNITO_CLIENT_ID}`, colors.blue);
  log('👤', `Usuario de prueba: ${TEST_USER.email}`, colors.blue);
  log('🔐', `Permiso a verificar: ${TEST_PERMISSION}`, colors.blue);
  log('📦', `Grupo a verificar: ${TEST_GROUP_ID}`, colors.blue);

  try {
    // ═══════════════════════════════════════════════════════════════
    // PASO 1: LOGIN
    // ═══════════════════════════════════════════════════════════════
    logStep(1, 'Intentando hacer login');
    
    log('📡', 'Enviando petición de login...', colors.yellow);
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: TEST_USER.email,  // El endpoint espera 'username' no 'email'
        password: TEST_USER.password
      })
    });

    log('📊', `Status de respuesta: ${loginResponse.status}`, colors.yellow);
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`Login falló con status ${loginResponse.status}: ${errorText}`);
    }

    const loginData = await loginResponse.json();
    log('✅', 'Login exitoso', colors.green);
    
    // Debug: mostrar la estructura completa de la respuesta
    console.log('\n📋 ESTRUCTURA DE LOGIN DATA:');
    console.log(JSON.stringify(loginData, null, 2));
    
    // La respuesta tiene estructura: { success: true, data: { idToken, accessToken, refreshToken } }
    const tokenData = loginData.data || loginData;
    tokens = {
      IdToken: tokenData.idToken,
      AccessToken: tokenData.accessToken,
      RefreshToken: tokenData.refreshToken
    };
    
    // Decodificar el ID Token para obtener el sub
    if (tokens.IdToken) {
      const payload = JSON.parse(Buffer.from(tokens.IdToken.split('.')[1], 'base64').toString());
      userSub = payload.sub;
    }
    
    log('🎫', `Access Token (primeros 50 chars): ${tokens.AccessToken?.substring(0, 50)}...`, colors.cyan);
    log('🎫', `ID Token (primeros 50 chars): ${tokens.IdToken?.substring(0, 50)}...`, colors.cyan);
    log('👤', `User Sub: ${userSub}`, colors.cyan);
    
    // Validar que tenemos los tokens
    if (!tokens.IdToken) {
      throw new Error('No se pudo obtener el IdToken del login. Revisa la estructura de la respuesta arriba.');
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO 2: OBTENER MEMBRESÍAS
    // ═══════════════════════════════════════════════════════════════
    logStep(2, 'Obteniendo membresías del usuario');
    
    log('📡', 'Enviando petición a /my-permissions...', colors.yellow);
    const permissionsResponse = await fetch(`${API_BASE_URL}/my-permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.IdToken}`,
        'Content-Type': 'application/json'
      }
    });

    log('📊', `Status de respuesta: ${permissionsResponse.status}`, colors.yellow);
    
    if (!permissionsResponse.ok) {
      const errorText = await permissionsResponse.text();
      throw new Error(`getMyPermissions falló con status ${permissionsResponse.status}: ${errorText}`);
    }

    const permissionsData = await permissionsResponse.json();
    log('✅', 'Membresías obtenidas exitosamente', colors.green);
    
    console.log('\n📋 DATOS DE RESPUESTA:');
    console.log(JSON.stringify(permissionsData, null, 2));
    
    // Extraer los datos del wrapper
    const membershipData = permissionsData.data || permissionsData;
    
    log('📊', `Número de grupos: ${membershipData.groups?.length || 0}`, colors.cyan);
    log('🔐', `Tiene permisos admin: ${membershipData.has_admin_permissions}`, colors.cyan);
    
    // Recopilar todos los permisos únicos del usuario
    const allUserPermissions = new Set();
    const PREDEFINED_ROLES = {
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
      ],
      "owner": [
        "admin.users", "admin.roles", "admin.permissions", "admin.db", "admin.system",
        "dashboard.read", "dashboard.write", "agenda.read", "agenda.write",
        "box.read", "box.write", "box.detalle.read", "box.detalle.write",
        "data.import", "data.export", "medicos.read",
        "notificaciones.read", "notificaciones.historial"
      ]
    };
    
    if (membershipData.groups && membershipData.groups.length > 0) {
      console.log('\n📂 GRUPOS DEL USUARIO:');
      membershipData.groups.forEach((group, index) => {
        const role = group.role || 'consulta';
        const rolePermissions = PREDEFINED_ROLES[role] || [];
        
        console.log(`\n   ${colors.bright}${index + 1}. Grupo: ${colors.cyan}${group.group_id}${colors.reset}`);
        console.log(`      Rol: ${colors.green}${role}${colors.reset}`);
        console.log(`      Permisos (${rolePermissions.length}):`);
        
        // Agregar permisos al set total
        rolePermissions.forEach(perm => {
          allUserPermissions.add(perm);
          console.log(`         • ${colors.yellow}${perm}${colors.reset}`);
        });
      });
      
      // Mostrar resumen de todos los permisos únicos
      console.log(`\n${colors.bright}${colors.magenta}════════════════════════════════════════════════════════${colors.reset}`);
      console.log(`${colors.bright}${colors.magenta}  RESUMEN: TODOS LOS PERMISOS DEL USUARIO${colors.reset}`);
      console.log(`${colors.bright}${colors.magenta}════════════════════════════════════════════════════════${colors.reset}`);
      console.log(`\n${colors.bright}Total de permisos únicos: ${colors.green}${allUserPermissions.size}${colors.reset}\n`);
      
      // Agrupar permisos por categoría
      const permissionsByCategory = {
        'Dashboard': [],
        'Agenda': [],
        'Box': [],
        'Box Detalle': [],
        'Datos': [],
        'Médicos': [],
        'Notificaciones': [],
        'Administración': []
      };
      
      Array.from(allUserPermissions).sort().forEach(perm => {
        if (perm.startsWith('dashboard.')) permissionsByCategory['Dashboard'].push(perm);
        else if (perm.startsWith('agenda.')) permissionsByCategory['Agenda'].push(perm);
        else if (perm.startsWith('box.detalle.')) permissionsByCategory['Box Detalle'].push(perm);
        else if (perm.startsWith('box.')) permissionsByCategory['Box'].push(perm);
        else if (perm.startsWith('data.')) permissionsByCategory['Datos'].push(perm);
        else if (perm.startsWith('medicos.')) permissionsByCategory['Médicos'].push(perm);
        else if (perm.startsWith('notificaciones.')) permissionsByCategory['Notificaciones'].push(perm);
        else if (perm.startsWith('admin.')) permissionsByCategory['Administración'].push(perm);
      });
      
      Object.entries(permissionsByCategory).forEach(([category, perms]) => {
        if (perms.length > 0) {
          console.log(`${colors.bright}${colors.blue}${category}:${colors.reset}`);
          perms.forEach(perm => {
            console.log(`   ✓ ${colors.green}${perm}${colors.reset}`);
          });
          console.log('');
        }
      });
      
    } else {
      log('⚠️', 'Usuario no pertenece a ningún grupo', colors.yellow);
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO 3: VERIFICAR PERMISO ESPECÍFICO
    // ═══════════════════════════════════════════════════════════════
    logStep(3, 'Verificando permiso específico');
    
    log('📡', `Verificando permiso "${TEST_PERMISSION}" en grupo "${TEST_GROUP_ID}"...`, colors.yellow);
    const checkResponse = await fetch(`${API_BASE_URL}/check-permission`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.IdToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        permission: TEST_PERMISSION,
        group_id: TEST_GROUP_ID
      })
    });

    log('📊', `Status de respuesta: ${checkResponse.status}`, colors.yellow);
    
    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      throw new Error(`checkPermission falló con status ${checkResponse.status}: ${errorText}`);
    }

    const checkData = await checkResponse.json();
    
    // Extraer los datos del wrapper
    const checkResult = checkData.data || checkData;
    
    console.log('\n📋 RESULTADO DE VERIFICACIÓN:');
    console.log(JSON.stringify(checkData, null, 2));
    
    if (checkResult.has_access) {
      log('✅', `ACCESO CONCEDIDO - El usuario TIENE el permiso "${TEST_PERMISSION}"`, colors.green);
    } else {
      log('❌', `ACCESO DENEGADO - El usuario NO TIENE el permiso "${TEST_PERMISSION}"`, colors.red);
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO 4: LISTAR PERMISOS DISPONIBLES
    // ═══════════════════════════════════════════════════════════════
    logStep(4, 'Listando permisos disponibles del sistema');
    
    log('📡', 'Obteniendo lista de permisos disponibles...', colors.yellow);
    const availableResponse = await fetch(`${API_BASE_URL}/admin/available-permissions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokens.IdToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (availableResponse.ok) {
      const availableData = await availableResponse.json();
      const permissionsInfo = availableData.data || availableData;
      
      log('✅', 'Permisos disponibles obtenidos', colors.green);
      
      console.log(`\n📚 PERMISOS DISPONIBLES (${permissionsInfo.total_permissions || Object.keys(permissionsInfo.permissions || {}).length}):`);
      Object.entries(permissionsInfo.permissions || {}).forEach(([key, desc]) => {
        console.log(`   • ${colors.cyan}${key}${colors.reset}: ${desc}`);
      });
      
      console.log(`\n👥 ROLES DEFINIDOS:`);
      Object.entries(permissionsInfo.roles || {}).forEach(([role, perms]) => {
        console.log(`   • ${colors.green}${role}${colors.reset} (${perms.length} permisos)`);
      });
    } else {
      log('⚠️', 'No se pudieron obtener los permisos disponibles (puede requerir permisos admin)', colors.yellow);
    }

    // ═══════════════════════════════════════════════════════════════
    // RESUMEN FINAL
    // ═══════════════════════════════════════════════════════════════
    console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}║   RESUMEN DE LA PRUEBA                                         ║${colors.reset}`);
    console.log(`${colors.bright}${colors.magenta}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
    
    log('✅', 'Login exitoso', colors.green);
    log('✅', `Grupos encontrados: ${membershipData.groups?.length || 0}`, colors.green);
    log('✅', 'Verificación de permiso completada', colors.green);
    log(checkResult.has_access ? '✅' : '❌', 
        `Permiso "${TEST_PERMISSION}": ${checkResult.has_access ? 'CONCEDIDO' : 'DENEGADO'}`, 
        checkResult.has_access ? colors.green : colors.red);
    
    console.log(`\n${colors.bright}${colors.green}🎉 PRUEBA COMPLETADA EXITOSAMENTE${colors.reset}\n`);

  } catch (error) {
    logError(error, 'Ejecución de prueba');
    console.log(`\n${colors.bright}${colors.red}💥 LA PRUEBA FALLÓ${colors.reset}\n`);
    process.exit(1);
  }
}

// Ejecutar la prueba
console.log('\n');
testPermissions().catch(error => {
  logError(error, 'Script principal');
  process.exit(1);
});
