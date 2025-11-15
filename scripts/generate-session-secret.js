#!/usr/bin/env node
/**
 * Script para generar SESSION_SECRET seguro
 * Uso: node generate-session-secret.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generador de SESSION_SECRET\n');
console.log('Genera una clave criptográficamente segura para tu aplicación.\n');

// Generar secret de 32 bytes (256 bits)
const secret = crypto.randomBytes(32).toString('hex');

console.log('Tu SESSION_SECRET generado:');
console.log('═'.repeat(70));
console.log(secret);
console.log('═'.repeat(70));

console.log('\n📝 Instrucciones:\n');
console.log('1. Copia el valor de arriba');
console.log('2. Agrégalo a tu archivo .env:');
console.log('   SESSION_SECRET=' + secret);
console.log('\n3. En producción, guárdalo en AWS Secrets Manager o Parameter Store:');
console.log('   aws ssm put-parameter \\');
console.log('     --name "/incodefy/prod/SESSION_SECRET" \\');
console.log('     --value "' + secret + '" \\');
console.log('     --type "SecureString"\n');

console.log('⚠️  IMPORTANTE: NO compartas este valor ni lo subas a Git\n');
