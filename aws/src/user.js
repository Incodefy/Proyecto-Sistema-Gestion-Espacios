// src/scripts/createUserAndAssignRole.js
require("dotenv").config();

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");

const fetch = require("node-fetch");

const USER_POOL_ID = 'us-east-1_gBVHTKE9Z';
const API_BASE_URL = 'https://668yst99ml.execute-api.us-east-1.amazonaws.com';

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'Admin123!';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("❌ ERROR: Debes definir ADMIN_EMAIL y ADMIN_PASSWORD en .env");
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({});

// === LOGIN PARA OBTENER TOKEN ===
async function login(username, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data;
}

// === SCRIPT PRINCIPAL ===
async function run() {
  const email = process.argv[2];
  const password = process.argv[3];
  const role = process.argv[4];

  if (!email || !password || !role) {
    console.log("\nUso:");
    console.log("node createUserAndAssignRole.js email password role\n");
    return;
  }

  try {
    // === 1. VERIFICAR SI EXISTE ===
    let exists = true;
    try {
      await cognito.send(new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email
      }));
    } catch {
      exists = false;
    }

    // === 2. CREAR SI NO EXISTE ===
    if (!exists) {
      console.log(`📌 Creando usuario ${email}...`);
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
        MessageAction: "SUPPRESS"
      }));
      console.log("✅ Usuario creado");
    } else {
      console.log("✅ Usuario ya existe, continuando...");
    }

    // === 3. ASIGNAR CONTRASEÑA ===
    console.log("🔐 Asignando contraseña...");
    await cognito.send(new AdminSetUserPasswordCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true
    }));
    console.log("✅ Contraseña asignada");

    // === 4. LOGIN DEL USUARIO ===
    console.log("🔑 Login del usuario...");
    const userLogin = await login(email, password);
    console.log("✅ Token del usuario obtenido");

    // === 5. LOGIN AUTOMÁTICO DEL ADMIN ===
    console.log("🔑 Login del admin...");
    const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminToken = `Bearer ${adminLogin.idToken}`;
    console.log("✅ Token admin obtenido");

    // === 6. ASIGNAR ROL USANDO TOKEN ADMIN ===
    console.log(`📌 Asignando rol '${role}' a ${email}...`);

    const res = await fetch(`${API_BASE_URL}/admin/assign-role`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": adminToken
      },
      body: JSON.stringify({ user_email: email, role })
    });

    const result = await res.json();
    console.log("\n✅ Resultado:", result);

    console.log("\n✅ COMPLETADO: usuario creado, login y rol asignado automáticamente.\n");

  } catch (err) {
    console.error("\n❌ Error:", err.message);
  }
}

run();
