// test-forgot-password.js
// Script para probar las rutas de forgot-password localmente

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`)
};

async function testForgotPasswordEndpoint() {
  log.info('Probando POST /auth/forgot-password...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/forgot-password`, {
      correo: 'test@ejemplo.com' // Cambia esto por un email real de tu Cognito
    });
    
    if (response.data.success) {
      log.success('Código enviado correctamente');
      log.info(`Respuesta: ${JSON.stringify(response.data)}`);
    } else {
      log.error('Respuesta inesperada');
      log.info(`Respuesta: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    if (error.response) {
      log.error(`Error ${error.response.status}: ${error.response.data.error}`);
    } else {
      log.error(`Error: ${error.message}`);
    }
  }
}

async function testResetPasswordEndpoint() {
  log.info('Probando POST /auth/reset-password...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/reset-password`, {
      correo: 'test@ejemplo.com',
      codigo: '123456', // Código que recibiste por email
      password: 'NuevaPassword123!'
    });
    
    if (response.data.success) {
      log.success('Contraseña restablecida correctamente');
      log.info(`Respuesta: ${JSON.stringify(response.data)}`);
    } else {
      log.error('Respuesta inesperada');
      log.info(`Respuesta: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    if (error.response) {
      log.error(`Error ${error.response.status}: ${error.response.data.error}`);
    } else {
      log.error(`Error: ${error.message}`);
    }
  }
}

async function testGetForgotPasswordPage() {
  log.info('Probando GET /auth/forgot-password...');
  
  try {
    const response = await axios.get(`${BASE_URL}/auth/forgot-password`);
    
    if (response.status === 200 && response.data.includes('Recuperar Contraseña')) {
      log.success('Página cargada correctamente');
    } else {
      log.warning('Página cargada pero contenido inesperado');
    }
  } catch (error) {
    log.error(`Error al cargar página: ${error.message}`);
  }
}

async function runTests() {
  console.log('\n=== 🧪 Pruebas de Forgot Password ===\n');
  
  // Test 1: Verificar que la página carga
  await testGetForgotPasswordPage();
  console.log('');
  
  // Test 2: Solicitar código (requiere email válido en Cognito)
  log.warning('NOTA: Cambia el email en el script por uno real de tu Cognito');
  await testForgotPasswordEndpoint();
  console.log('');
  
  // Test 3: Restablecer contraseña (requiere código válido)
  log.warning('NOTA: Ingresa el código que recibiste por email');
  log.info('Descomenta la siguiente línea si tienes un código válido:');
  console.log('// await testResetPasswordEndpoint();');
  
  console.log('\n=== ✅ Pruebas completadas ===\n');
}

// Ejecutar pruebas
runTests().catch(error => {
  log.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
