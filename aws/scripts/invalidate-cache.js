// Script para invalidar caché de especialidades
// Esto fuerza a Lambda a consultar DynamoDB de nuevo

const https = require('https');

const API_URL = 'https://izvc1mjvh2.execute-api.us-east-1.amazonaws.com';
const GRUPO_ID = 'grp_1534e25f-f7c3-46ac-a667-cabfc317c235';

// Nota: Este script requiere un token válido
// Por ahora, simplemente espera 5 minutos para que expire el caché
// O puedes hacer un request directo desde el navegador

console.log('⏰ El caché de Lambda expira automáticamente en 5 minutos (TTL: 300 segundos)');
console.log('\n💡 Opciones para invalidar el caché inmediatamente:');
console.log('1. Esperar 5 minutos');
console.log('2. Hacer un hard refresh en el navegador (Ctrl+Shift+F5)');
console.log('3. Reiniciar el servidor Express local');
console.log('\n🔧 O puedes modificar el código de Lambda para desactivar el caché temporalmente:');
console.log('   Editar: aws/src/handlers/especialidades/listEspecialidades.js');
console.log('   Cambiar: const especialidadesCache = new Cache({ ttl: 300, maxSize: 500 });');
console.log('   Por:     const especialidadesCache = new Cache({ ttl: 0, maxSize: 500 }); // Desactivar cache');
