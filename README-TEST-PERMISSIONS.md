# 🧪 Test de Sistema de Permisos

Script para probar el sistema de permisos completo: login, obtención de membresías y verificación de permisos específicos.

## 📋 Requisitos

```bash
npm install node-fetch
```

## 🔧 Configuración

Edita `test-permissions.js` y cambia estas variables:

```javascript
// Línea 12-15: Credenciales de prueba
const TEST_USER = {
  email: 'tu-email@ejemplo.com',  // ← Tu email de Cognito
  password: 'tu-contraseña'        // ← Tu contraseña
};

// Línea 18: Grupo a probar (opcional)
const TEST_GROUP_ID = 'grp_21613a65-f0bb-43c2-986c-75e4c1221c43';

// Línea 19: Permiso a verificar (opcional)
const TEST_PERMISSION = 'dashboard.read';
```

## 🚀 Ejecución

```bash
node test-permissions.js
```

## 📊 Qué hace el script

### ✅ PASO 1: Login
- Hace POST a `/auth/login`
- Obtiene tokens de acceso e ID token
- Muestra el user_sub

### ✅ PASO 2: Obtener Membresías
- Hace GET a `/my-permissions`
- Lista todos los grupos del usuario
- Muestra roles en cada grupo
- Indica si tiene permisos admin

### ✅ PASO 3: Verificar Permiso Específico
- Hace POST a `/check-permission`
- Verifica si el usuario tiene un permiso específico en un grupo
- Devuelve `has_access: true/false`

### ✅ PASO 4: Listar Permisos Disponibles
- Hace GET a `/admin/available-permissions`
- Lista todos los permisos del sistema
- Muestra roles predefinidos

## 📝 Ejemplo de Salida

```
╔════════════════════════════════════════════════════════════════╗
║   PRUEBA DE SISTEMA DE PERMISOS                                ║
╚════════════════════════════════════════════════════════════════╝

🔧 API Base URL: https://owgdeiu0z8.execute-api.us-east-2.amazonaws.com
🔧 Cognito Client ID: 7325v6nu1ifgpuqd6etq8n3q0a
👤 Usuario de prueba: usuario@ejemplo.com
🔐 Permiso a verificar: dashboard.read
📦 Grupo a verificar: grp_21613a65-f0bb-43c2-986c-75e4c1221c43

═══════════════════════════════════════════════════════
  PASO 1: Intentando hacer login
═══════════════════════════════════════════════════════

📡 Enviando petición de login...
📊 Status de respuesta: 200
✅ Login exitoso
🎫 Access Token (primeros 50 chars): eyJraWQiOiJxd...
👤 User Sub: 413bf5c0-0041-707f-75da-97118f1643e

═══════════════════════════════════════════════════════
  PASO 2: Obteniendo membresías del usuario
═══════════════════════════════════════════════════════

📡 Enviando petición a /my-permissions...
📊 Status de respuesta: 200
✅ Membresías obtenidas exitosamente

📋 DATOS DE RESPUESTA:
{
  "user_sub": "413bf5c0-0041-707f-75da-97118f1643e",
  "groups": [
    {
      "group_id": "grp_21613a65-f0bb-43c2-986c-75e4c1221c43",
      "role": "owner",
      "added_at": "2025-11-20T23:08:905Z"
    }
  ],
  "has_admin_permissions": true
}

📂 GRUPOS DEL USUARIO:
   1. grp_21613a65-f0bb-43c2-986c-75e4c1221c43 - Rol: owner

═══════════════════════════════════════════════════════
  PASO 3: Verificando permiso específico
═══════════════════════════════════════════════════════

📡 Verificando permiso "dashboard.read" en grupo "grp_21613a65..."...
📊 Status de respuesta: 200

📋 RESULTADO DE VERIFICACIÓN:
{
  "user_sub": "413bf5c0-0041-707f-75da-97118f1643e",
  "group_id": "grp_21613a65-f0bb-43c2-986c-75e4c1221c43",
  "permission": "dashboard.read",
  "has_access": true,
  "message": "Acceso permitido"
}

✅ ACCESO CONCEDIDO - El usuario TIENE el permiso "dashboard.read"

╔════════════════════════════════════════════════════════════════╗
║   RESUMEN DE LA PRUEBA                                         ║
╚════════════════════════════════════════════════════════════════╝

✅ Login exitoso
✅ Grupos encontrados: 1
✅ Verificación de permiso completada
✅ Permiso "dashboard.read": CONCEDIDO

🎉 PRUEBA COMPLETADA EXITOSAMENTE
```

## 🎯 Casos de Uso

### Probar diferentes permisos

```javascript
const TEST_PERMISSION = 'admin.users';      // Permiso admin
const TEST_PERMISSION = 'box.write';        // Editar boxes
const TEST_PERMISSION = 'agenda.read';      // Ver agenda
```

### Probar con diferentes grupos

```javascript
const TEST_GROUP_ID = 'grp_otro-grupo-id';
```

### Ver qué pasa si no tienes el permiso

El script mostrará:
```
❌ ACCESO DENEGADO - El usuario NO TIENE el permiso "admin.db"
```

## 🐛 Troubleshooting

### Error: Login falló
- Verifica que el email y contraseña sean correctos
- Confirma que el usuario existe en Cognito

### Error: checkPermission falló
- Verifica que el `TEST_GROUP_ID` sea correcto
- Confirma que eres miembro de ese grupo

### Error: Cannot find module 'node-fetch'
```bash
npm install node-fetch
```

## 📚 Permisos Disponibles

- `dashboard.read` / `dashboard.write`
- `agenda.read` / `agenda.write`
- `box.read` / `box.write`
- `box.detalle.read` / `box.detalle.write`
- `data.import` / `data.export`
- `medicos.read`
- `notificaciones.read` / `notificaciones.historial`
- `admin.users` / `admin.roles` / `admin.permissions`
- `admin.db` / `admin.system`

## 👥 Roles Disponibles

- **consulta**: Solo lectura
- **operador**: Lectura + escritura básica
- **gestor**: Permisos avanzados + importar/exportar
- **medico**: Vista específica para médicos
- **admin**: Permisos administrativos completos
- **owner**: Propietario del grupo (todos los permisos)
