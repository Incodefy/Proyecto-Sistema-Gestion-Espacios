// src/user.js
// Script para crear usuarios en Cognito y asignarles roles en DynamoDB

require("dotenv").config();

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  UserNotFoundFault
} = require("@aws-sdk/client-cognito-identity-provider");

const fetch = require("node-fetch");
const https = require("https");

const USER_POOL_ID = 'us-east-2_VGnJ3QB3M';
const API_BASE_URL = 'https://lqkt2hy861.execute-api.us-east-2.amazonaws.com';

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'Admin123!';

// Crear agente HTTPS con configuración permisiva para desarrollo
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // Permitir certificados autofirmados (solo dev)
});

// Validaciones iniciales
if (!USER_POOL_ID) {
  console.error("❌ ERROR: USER_POOL_ID no está definido");
  process.exit(1);
}

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("❌ ERROR: Debes definir ADMIN_EMAIL y ADMIN_PASSWORD en .env o como variables de entorno");
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-2' });

/**
 * Realiza login y obtiene tokens
 */
async function login(username, password) {
  try {
    const url = `${API_BASE_URL}/auth/login`;
    console.log(`   📡 Conectando a: ${url}`);
    
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
      agent: httpsAgent,
      timeout: 15000
    });

    console.log(`   ✅ Respuesta HTTP ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`   📄 Contenido de error: ${errorText.substring(0, 200)}`);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    
    if (!data.ok) {
      throw new Error(`Respuesta API: ${data.error || 'Error desconocido'}`);
    }

    return data;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`CONEXIÓN RECHAZADA - API no está disponible en ${API_BASE_URL}`);
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`DOMINIO NO ENCONTRADO - Verifica la URL: ${API_BASE_URL}`);
    }
    if (err.code === 'ETIMEDOUT') {
      throw new Error(`TIMEOUT - API tardó demasiado en responder`);
    }
    throw new Error(`Login fallido para ${username}: ${err.message}`);
  }
}

/**
 * Verifica si el usuario ya existe en Cognito
 */
async function userExists(email) {
  try {
    await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email
    }));
    return true;
  } catch (err) {
    if (err.name === 'UserNotFoundException') {
      return false;
    }
    throw err;
  }
}

/**
 * Crea un nuevo usuario en Cognito
 */
async function createUser(email, password) {
  try {
    console.log(`📌 Creando usuario ${email}...`);
    
    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" }
      ],
      MessageAction: "SUPPRESS",
      TemporaryPassword: password
    }));

    console.log("✅ Usuario creado en Cognito");

    // Asignar contraseña permanente
    console.log("🔐 Asignando contraseña permanente...");
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    }));

    console.log("✅ Contraseña asignada correctamente");

  } catch (err) {
    throw new Error(`Error creando usuario: ${err.message}`);
  }
}

/**
 * Asigna un rol a un usuario
 */
async function assignRole(userEmail, role, adminToken, isBootstrap = false) {
  try {
    console.log(`📌 Asignando rol '${role}' a ${userEmail}...`);

    const url = `${API_BASE_URL}/admin/assign-role`;
    console.log(`   📡 Conectando a: ${url}`);

    const headers = {
      "content-type": "application/json"
    };

    // Agregar header según el modo
    if (isBootstrap) {
      headers["x-bootstrap-email"] = userEmail;
      console.log(`   🚀 Usando bootstrap mode para primer admin`);
    } else if (adminToken) {
      headers["Authorization"] = adminToken;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_email: userEmail, role }),
      agent: httpsAgent,
      timeout: 15000
    });

    console.log(`   ✅ Respuesta HTTP ${res.status}`);

    // Validar status HTTP
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`   📄 Contenido de error: ${errorText.substring(0, 300)}`);
      throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText.substring(0, 100)}`);
    }

    const result = await res.json();

    // Debug: mostrar respuesta completa si hay error
    if (!result.ok) {
      console.error("Respuesta completa del API:", JSON.stringify(result, null, 2));
      throw new Error(result.error || 'Error desconocido al asignar rol');
    }

    console.log("✅ Rol asignado correctamente");
    
    // Mostrar permisos de forma segura
    if (result.permissions && Array.isArray(result.permissions)) {
      console.log(`   Permisos (${result.permissions.length}): ${result.permissions.join(', ')}`);
    } else {
      console.log(`   Permisos: ${JSON.stringify(result.permissions)}`);
    }

    return result;

  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      throw new Error(`CONEXIÓN RECHAZADA - API no está disponible en ${API_BASE_URL}`);
    }
    if (err.code === 'ENOTFOUND') {
      throw new Error(`DOMINIO NO ENCONTRADO - Verifica la URL: ${API_BASE_URL}`);
    }
    if (err.code === 'ETIMEDOUT') {
      throw new Error(`TIMEOUT - API tardó demasiado en responder`);
    }
    throw new Error(`Error asignando rol: ${err.message}`);
  }
}

/**
 * Script principal
 */
async function run() {
  const email = process.argv[2];
  const password = process.argv[3];
  const role = process.argv[4];

  // Validar argumentos
  if (!email || !password || !role) {
    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║  CREAR USUARIO Y ASIGNAR ROL                       ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    console.log("Uso:");
    console.log("  node user.js <email> <password> <role>\n");
    console.log("Roles disponibles:");
    console.log("  - admin");
    console.log("  - gestor");
    console.log("  - operador");
    console.log("  - medico");
    console.log("  - consulta\n");
    console.log("Ejemplo:");
    console.log("  node user.js usuario@hospital.com 'Pass123!' operador\n");
    return;
  }

  // Validar formato de email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("❌ Error: El email no tiene un formato válido");
    process.exit(1);
  }

  // Validar contraseña
  if (password.length < 8) {
    console.error("❌ Error: La contraseña debe tener al menos 8 caracteres");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║  CREAR USUARIO Y ASIGNAR ROL                       ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  try {
    // === PASO 1: VERIFICAR SI EXISTE ===
    console.log("🔍 Verificando si el usuario ya existe...");
    const exists = await userExists(email);

    if (exists) {
      console.log("ℹ️  Usuario ya existe en Cognito, continuando con asignación de rol...\n");
    } else {
      console.log("ℹ️  Usuario no existe, creando...\n");
      await createUser(email, password);
      console.log("");
    }

    // === PASO 2: LOGIN DEL ADMIN (o el usuario si es primer admin) ===
    console.log("🔑 Obteniendo credenciales para asignar rol...");
    
    let adminLogin;
    let adminEmail = ADMIN_EMAIL;
    let adminPassword = ADMIN_PASSWORD;
    let isBootstrap = false;
    
    // Si es el primer admin, intentar con sus propias credenciales
    if (role === "admin" && email === ADMIN_EMAIL) {
      console.log("   ℹ️  Intentando crear el primer admin (bootstrap mode)...\n");
      isBootstrap = true;
      adminEmail = email;
      adminPassword = password;
    }
    
    try {
      adminLogin = await login(adminEmail, adminPassword);
    } catch (err) {
      // Si es bootstrap y falla el login, probablemente es porque el usuario acaba de ser creado
      if (isBootstrap && (err.message.includes("Login fallido") || err.message.includes("Respuesta API"))) {
        console.log("   ⚠️  No se pudo autenticar (es normal en bootstrap)...\n");
        console.log("   🚀 Usando modo bootstrap con header especial...\n");
        // En bootstrap mode, NO usamos Bearer token
        // Usaremos un header especial que el Lambda reconoce
        adminLogin = null;
      } else {
        throw new Error(`No se pudo autenticar como admin: ${err.message}`);
      }
    }

    let adminToken = null;
    if (adminLogin) {
      adminToken = `Bearer ${adminLogin.idToken}`;
      console.log("✅ Admin autenticado correctamente\n");
    } else {
      console.log("✅ Modo bootstrap activado\n");
    }

    // === PASO 3: ASIGNAR ROL ===
    const result = await assignRole(email, role, adminToken, isBootstrap);
    console.log("");

    // === RESUMEN FINAL ===
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║  ✅ OPERACIÓN COMPLETADA CON ÉXITO                ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    console.log("Detalles del usuario:");
    console.log(`  Email: ${email}`);
    console.log(`  Rol: ${role}`);
    
    if (result.permissions && Array.isArray(result.permissions)) {
      console.log(`  Permisos (${result.permissions.length}): ${result.permissions.join(', ')}`);
    } else {
      console.log(`  Permisos: ${JSON.stringify(result.permissions)}`);
    }
    
    console.log(`  Asignado por: ${result.assigned_by || 'No disponible'}`);
    console.log(`  Fecha: ${result.assigned_at || 'No disponible'}`);
    console.log(`  Trace ID: ${result.trace_id || 'No disponible'}\n`);

  } catch (err) {
    console.error("\n╔════════════════════════════════════════════════════╗");
    console.error("║  ❌ ERROR DURANTE LA OPERACIÓN                     ║");
    console.error("╚════════════════════════════════════════════════════╝\n");
    console.error(`Tipo de error: ${err.constructor.name}`);
    console.error(`Mensaje: ${err.message}`);
    console.error("");

    // Detalles adicionales según el tipo de error
    if (err.message.includes("CONEXIÓN RECHAZADA")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. Verifica que la API Lambda está desplegada");
      console.error("  2. Ejecuta: serverless deploy --stage dev");
      console.error("  3. Verifica que la URL es correcta en .env");
      console.error(`     URL: ${API_BASE_URL}`);
    } else if (err.message.includes("DOMINIO NO ENCONTRADO")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. Verifica la URL en .env");
      console.error("  2. Verifica tu conexión a internet");
      console.error(`     URL: ${API_BASE_URL}`);
    } else if (err.message.includes("TIMEOUT")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. La API está lenta o no responde");
      console.error("  2. Intenta nuevamente en unos momentos");
      console.error("  3. Verifica que el Lambda está funcionando");
    } else if (err.message.includes("HTTP")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. Problema de conectividad con la API");
      console.error(`  2. Verifica que la URL sea correcta: ${API_BASE_URL}`);
      console.error("  3. Intenta: curl -v " + API_BASE_URL + "/auth/login");
    } else if (err.message.includes("Login fallido")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. Credenciales del admin incorrectas");
      console.error(`  2. ADMIN_EMAIL: ${ADMIN_EMAIL}`);
      console.error("  3. Verifica ADMIN_PASSWORD en .env");
      console.error("  4. El usuario debe existir en Cognito");
    } else if (err.message.includes("UserNotFound")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. El usuario no existe después de crearlo");
      console.error("  2. Problema con Cognito - verifica credenciales AWS");
    } else if (err.message.includes("permiso") || err.message.includes("admin")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. Asegúrate de que el usuario admin ya tiene el rol 'admin' asignado");
      console.error("  2. O intenta crear el primer admin del sistema");
      console.error("  3. Verifica que las credenciales del admin son correctas");
    } else if (err.message.includes("rol")) {
      console.error("🔧 SOLUCIONES:");
      console.error("  1. El rol especificado no existe");
      console.error("  2. Roles válidos: admin, gestor, operador, medico, consulta");
    }

    console.error("");
    process.exit(1);
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  run();
}

module.exports = { login, userExists, createUser, assignRole };
