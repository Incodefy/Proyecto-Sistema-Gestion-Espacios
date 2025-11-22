// src/user.js
// Script para crear usuarios en Cognito

require("dotenv").config();

const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  UserNotFoundFault
} = require("@aws-sdk/client-cognito-identity-provider");

const USER_POOL_ID = 'us-east-2_xg4LKhGo3';

// Validaciones iniciales
if (!USER_POOL_ID) {
  console.error("❌ ERROR: USER_POOL_ID no está definido");
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-2' });

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
 * Script principal
 */
async function run() {
  const email = process.argv[2];
  const password = process.argv[3];

  // Validar argumentos
  if (!email || !password) {
    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║  CREAR USUARIO EN COGNITO                          ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    console.log("Uso:");
    console.log("  node user.js <email> <password>\n");
    console.log("Ejemplo:");
    console.log("  node user.js usuario@hospital.com 'Pass123!'\n");
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
  console.log("║  CREAR USUARIO EN COGNITO                          ║");
  console.log("╚════════════════════════════════════════════════════╝\n");

  try {
    // Verificar si el usuario ya existe
    console.log("🔍 Verificando si el usuario ya existe...");
    const exists = await userExists(email);

    if (exists) {
      console.log("⚠️  Usuario ya existe en Cognito\n");
      console.log("╔════════════════════════════════════════════════════╗");
      console.log("║  ℹ️  USUARIO YA EXISTE                             ║");
      console.log("╚════════════════════════════════════════════════════╝\n");
      console.log(`  Email: ${email}\n`);
      return;
    }

    // Crear el usuario
    console.log("ℹ️  Usuario no existe, creando...\n");
    await createUser(email, password);
    console.log("");

    // Resumen final
    console.log("╔════════════════════════════════════════════════════╗");
    console.log("║  ✅ USUARIO CREADO CON ÉXITO                       ║");
    console.log("╚════════════════════════════════════════════════════╝\n");
    console.log("Detalles del usuario:");
    console.log(`  Email: ${email}`);
    console.log(`  Estado: Activo`);
    console.log(`  Email verificado: Sí\n`);

  } catch (err) {
    console.error("\n╔════════════════════════════════════════════════════╗");
    console.error("║  ❌ ERROR DURANTE LA OPERACIÓN                     ║");
    console.error("╚════════════════════════════════════════════════════╝\n");
    console.error(`Tipo de error: ${err.constructor.name}`);
    console.error(`Mensaje: ${err.message}\n`);
    process.exit(1);
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  run();
}

module.exports = { userExists, createUser };
