# 🔐 Sistema de Verificación de Permisos

Sistema completo para verificar permisos de usuarios en grupos. **Los permisos se cargan una sola vez al inicio de sesión** y se almacenan en la sesión para verificación instantánea sin consultas a la API.

## ⚡ Ventaja Principal

**Carga única al login**: Todos los permisos del usuario se obtienen al iniciar sesión y se almacenan en `req.session.user.permissions_by_group`. Las verificaciones son instantáneas ya que no requieren consultas a la base de datos.

## 📋 Tabla de Contenidos

- [Middleware Principal](#middleware-principal)
- [Funciones Helper](#funciones-helper)
- [Refrescar Permisos](#refrescar-permisos)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Logs y Debugging](#logs-y-debugging)

## 🛡️ Middleware Principal

### `checkPermission(permission)`

Middleware que verifica un permiso específico antes de permitir acceso a una ruta.

```javascript
const checkPermission = require('./middleware/checkPermission');

// Proteger una ruta con un permiso específico
router.get('/dashboard', 
  checkPermission('dashboard.read'), 
  (req, res) => {
    res.render('dashboard');
  }
);

router.post('/boxes/:id', 
  checkPermission('box.write'), 
  (req, res) => {
    // Crear/editar box
  }
);
```

### Flujo de Verificación

1. ✅ **Verifica autenticación** - Usuario debe tener sesión activa
2. ✅ **Verifica admin** - Si tiene `has_admin_permissions`, acceso directo
3. ✅ **Verifica grupo activo** - Usuario debe tener un grupo seleccionado
4. ✅ **Extrae grupo_id** - De `req.session.grupoActivo.grupo_id` (es un objeto)
5. ✅ **Consulta permisos en sesión** - Lee de `req.session.user.permissions_by_group[grupoId]`
6. ✅ **Decide acceso** - Verifica si el permiso está en el array de permisos del grupo

### ⚡ Rendimiento

**Antes**: Cada verificación hacía una petición POST a `/check-permission`
**Ahora**: Los permisos se cargan una sola vez al login y se leen de memoria

```javascript
// Estructura en sesión:
req.session.user = {
  idToken: "...",
  email: "admin@gmail.com",
  groups: [
    { group_id: "grp_xxx", role: "owner", added_at: "..." }
  ],
  has_admin_permissions: true,
  permissions_by_group: {
    "grp_xxx": {
      role: "owner",
      permissions: ["dashboard.read", "dashboard.write", ...],
      permissionsCount: 18
    }
  }
}
```

### ⚠️ Importante: Formato del Grupo Activo

`req.session.grupoActivo` es un **objeto**, no un string:
```javascript
req.session.grupoActivo = {
  grupo_id: "grp_976290a5-9831-497a-983d-acb389622059",
  nombre: "Mi Grupo",
  // ... otras propiedades
}
```

El middleware y las funciones helper extraen automáticamente el `grupo_id` cuando es necesario.

## 🔧 Funciones Helper

### Helpers de Sesión (Recomendado)

Estas funciones trabajan directamente con los permisos almacenados en sesión:

#### `hasPermission(req, permission)`

Verifica si el usuario tiene un permiso específico en el grupo activo.

```javascript
const { hasPermission } = require('./utils/refreshPermissions');

router.get('/dashboard', (req, res) => {
  // Verificar permiso programáticamente
  if (hasPermission(req, 'dashboard.write')) {
    // Mostrar botones de edición
  }
  
  res.render('dashboard', {
    canEdit: hasPermission(req, 'dashboard.write'),
    canExport: hasPermission(req, 'data.export')
  });
});
```

#### `hasAllPermissions(req, ...permissions)`

Verifica si el usuario tiene TODOS los permisos especificados (AND lógico).

```javascript
const { hasAllPermissions } = require('./utils/refreshPermissions');

router.post('/admin/importar-datos', (req, res) => {
  if (!hasAllPermissions(req, 'data.import', 'admin.users')) {
    return res.status(403).json({ error: 'Permisos insuficientes' });
  }
  
  // Procesar importación
});
```

#### `hasAnyPermission(req, ...permissions)`

Verifica si el usuario tiene AL MENOS UNO de los permisos (OR lógico).

```javascript
const { hasAnyPermission } = require('./utils/refreshPermissions');

router.get('/consultas', (req, res) => {
  if (!hasAnyPermission(req, 'agenda.read', 'box.read', 'consultas.read')) {
    return res.status(403).render('403');
  }
  
  res.render('consultas');
});
```

#### `getCurrentGroupPermissions(req)`

Obtiene todos los permisos del usuario en el grupo activo.

```javascript
const { getCurrentGroupPermissions } = require('./utils/refreshPermissions');

router.get('/perfil', (req, res) => {
  const permisos = getCurrentGroupPermissions(req);
  
  res.render('perfil', {
    usuario: req.session.user,
    permisos: permisos,
    totalPermisos: permisos.length
  });
});
```

### Funciones de API (Para casos especiales)

Estas funciones consultan la API directamente. Úsalas solo cuando necesites verificar permisos sin sesión o actualizar información.

## 🔄 Refrescar Permisos

### `refreshUserPermissions(req)`

Refresca los permisos del usuario consultando la API y actualizando la sesión.

```javascript
const { refreshUserPermissions } = require('./utils/refreshPermissions');

router.post('/cambiar-rol', async (req, res) => {
  // Después de cambiar el rol del usuario
  await updateUserRole(req.body.userId, req.body.newRole);
  
  // Refrescar permisos en sesión
  const result = await refreshUserPermissions(req);
  
  if (result.success) {
    res.json({ success: true, message: 'Rol actualizado y permisos refrescados' });
  } else {
    res.json({ success: false, error: result.message });
  }
});
```

### `refreshPermissionsMiddleware()`

Middleware que refresca permisos automáticamente antes de continuar.

```javascript
const { refreshPermissionsMiddleware } = require('./utils/refreshPermissions');

// Refrescar permisos después de cambiar de grupo
router.post('/cambiar-grupo', 
  refreshPermissionsMiddleware(),
  (req, res) => {
    res.json({ success: true });
  }
);
```

## 📝 Ejemplos de Uso

### Ejemplo 1: Verificación en Vistas con Helpers

```javascript
const { hasPermission, hasAllPermissions } = require('./utils/refreshPermissions');

router.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    canEdit: hasPermission(req, 'dashboard.write'),
    canEditBoxes: hasPermission(req, 'box.write'),
    canExport: hasPermission(req, 'data.export'),
    canImportAndManage: hasAllPermissions(req, 'data.import', 'admin.users')
  });
});
```

```ejs
<!-- En la vista dashboard.ejs -->
<% if (canEdit) { %>
  <button class="btn-edit">Editar Dashboard</button>
<% } %>

<% if (canEditBoxes) { %>
  <a href="/boxes/new">Crear Nuevo Box</a>
<% } %>

<% if (canExport) { %>
  <button class="btn-export">Exportar Datos</button>
<% } %>
```

### Ejemplo 2: Proteger Rutas Simples

```javascript
const express = require('express');
const router = express.Router();
const checkPermission = require('./middleware/checkPermission');

// Solo lectura
router.get('/agenda', 
  checkPermission('agenda.read'), 
  (req, res) => {
    res.render('agenda');
  }
);

// Requiere escritura
router.post('/agenda', 
  checkPermission('agenda.write'), 
  async (req, res) => {
    // Crear nueva cita
  }
);

// Admin only
router.get('/admin', 
  checkPermission('admin.users'), 
  (req, res) => {
    res.render('admin');
  }
);
```

### Ejemplo 3: Verificación en API Endpoints

```javascript
const { hasPermission } = require('./utils/refreshPermissions');

router.post('/api/boxes/:id/update', async (req, res) => {
  try {
    // Verificar permiso antes de procesar
    if (!hasPermission(req, 'box.write')) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para editar boxes'
      });
    }

    // Procesar actualización
    const box = await updateBox(req.params.id, req.body);
    
    res.json({ success: true, data: box });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Ejemplo 4: Mostrar Permisos del Usuario

```javascript
const { getCurrentGroupPermissions } = require('./utils/refreshPermissions');

router.get('/mi-perfil', (req, res) => {
  const permisos = getCurrentGroupPermissions(req);
  const grupoActivo = req.session.grupoActivo;
  const permsByGroup = req.session.user.permissions_by_group[grupoActivo.grupo_id];
  
  res.render('perfil', {
    usuario: req.session.user,
    grupoActivo: grupoActivo,
    rol: permsByGroup?.role,
    permisos: permisos,
    totalPermisos: permisos.length
  });
});
```

Verifica un permiso específico de forma programática.

```javascript
const { checkUserPermission } = require('./utils/permissionChecker');

// En un controlador o route handler
// Puedes pasar el grupo_id como string o el objeto completo
const result = await checkUserPermission(
  req.session.user.idToken,
  req.session.grupoActivo, // Puede ser objeto o string
  'agenda.write'
);

if (result.hasAccess) {
  console.log('✅ Usuario puede editar la agenda');
} else {
  console.log('❌ Usuario no puede editar la agenda');
}

// También funciona con el ID directo:
const result2 = await checkUserPermission(
  req.session.user.idToken,
  'grp_976290a5-9831-497a-983d-acb389622059',
  'agenda.write'
);

// Respuesta: { hasAccess: true/false, message: string, details: object }
```

### `checkMultiplePermissions(idToken, groupId, permissions)`

Verifica múltiples permisos simultáneamente (en paralelo).

```javascript
const { checkMultiplePermissions } = require('./utils/permissionChecker');

// Acepta tanto el objeto grupoActivo como solo el grupo_id
const permissions = await checkMultiplePermissions(
  req.session.user.idToken,
  req.session.grupoActivo, // Automáticamente extrae grupo_id
  ['dashboard.read', 'dashboard.write', 'box.read', 'box.write']
);

console.log(permissions);
// {
//   'dashboard.read': true,
//   'dashboard.write': false,
//   'box.read': true,
//   'box.write': false
// }

// Usar en lógica condicional
if (permissions['dashboard.write']) {
  // Mostrar botones de edición
}
```

### `getUserMemberships(idToken)`

Obtiene todos los grupos del usuario y su información de permisos.

```javascript
const { getUserMemberships } = require('./utils/permissionChecker');

const memberships = await getUserMemberships(req.session.user.idToken);

console.log(memberships);
// {
//   groups: [
//     { group_id: 'grp_xxx', role: 'owner', added_at: '...' },
//     { group_id: 'grp_yyy', role: 'gestor', added_at: '...' }
//   ],
//   hasAdminPermissions: true,
//   userSub: '413bf5c0-0041-707f-75da-971181f6433e'
// }
```

### `checkAnyPermission(...permissions)`

Middleware que verifica si el usuario tiene **AL MENOS UNO** de los permisos (OR lógico).

```javascript
const { checkAnyPermission } = require('./utils/permissionChecker');

// Usuario necesita dashboard.read O dashboard.write
router.get('/dashboard', 
  checkAnyPermission('dashboard.read', 'dashboard.write'),
  (req, res) => {
    res.render('dashboard');
  }
);
```

### `checkAllPermissions(...permissions)`

Middleware que verifica si el usuario tiene **TODOS** los permisos (AND lógico).

```javascript
const { checkAllPermissions } = require('./utils/permissionChecker');

// Usuario necesita TANTO agenda.read COMO box.read
router.get('/calendario-boxes', 
  checkAllPermissions('agenda.read', 'box.read'),
  (req, res) => {
    res.render('calendario-boxes');
  }
);
```

## 📝 Ejemplos de Uso

### Ejemplo 1: Proteger Rutas Simples

```javascript
const express = require('express');
const router = express.Router();
const checkPermission = require('./middleware/checkPermission');

// Solo lectura
router.get('/agenda', 
  checkPermission('agenda.read'), 
  (req, res) => {
    res.render('agenda');
  }
);

// Requiere escritura
router.post('/agenda', 
  checkPermission('agenda.write'), 
  async (req, res) => {
    // Crear nueva cita
  }
);

// Admin only
router.get('/admin', 
  checkPermission('admin.users'), 
  (req, res) => {
    res.render('admin');
  }
);
```

### Ejemplo 2: Verificación Condicional en Vistas

```javascript
const { checkMultiplePermissions } = require('./utils/permissionChecker');

router.get('/dashboard', async (req, res) => {
  // Verificar varios permisos para mostrar elementos condicionales
  const perms = await checkMultiplePermissions(
    req.session.user.idToken,
    req.session.grupoActivo,
    ['dashboard.write', 'box.write', 'data.export']
  );

  res.render('dashboard', {
    canEdit: perms['dashboard.write'],
    canEditBoxes: perms['box.write'],
    canExport: perms['data.export']
  });
});
```

```ejs
<!-- En la vista dashboard.ejs -->
<% if (canEdit) { %>
  <button class="btn-edit">Editar Dashboard</button>
<% } %>

<% if (canEditBoxes) { %>
  <a href="/boxes/new">Crear Nuevo Box</a>
<% } %>

<% if (canExport) { %>
  <button class="btn-export">Exportar Datos</button>
<% } %>
```

### Ejemplo 3: Verificación en API Endpoints

```javascript
const { checkUserPermission } = require('./utils/permissionChecker');

router.post('/api/boxes/:id/update', async (req, res) => {
  try {
    // Verificar permiso antes de procesar
    const result = await checkUserPermission(
      req.session.user.idToken,
      req.session.grupoActivo,
      'box.write'
    );

    if (!result.hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para editar boxes',
        message: result.message
      });
    }

    // Procesar actualización
    const box = await updateBox(req.params.id, req.body);
    
    res.json({ success: true, data: box });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Ejemplo 4: Protección con Múltiples Opciones

```javascript
const { checkAnyPermission } = require('./utils/permissionChecker');

// Usuario puede acceder si tiene CUALQUIERA de estos permisos
router.get('/consultas', 
  checkAnyPermission('agenda.read', 'box.read', 'consultas.read'),
  (req, res) => {
    res.render('consultas');
  }
);
```

### Ejemplo 5: Protección Estricta

```javascript
const { checkAllPermissions } = require('./utils/permissionChecker');

// Usuario DEBE tener TODOS estos permisos
router.get('/admin/importar-datos', 
  checkAllPermissions('data.import', 'admin.users'),
  (req, res) => {
    res.render('importar-datos');
  }
);
```

## 📊 Logs y Debugging

El sistema genera logs detallados en cada verificación. Con el nuevo sistema de sesión, los logs son más rápidos y eficientes:

### Verificación con Permisos en Sesión (Normal)

```
[CheckPerm-1732156235123] ═══════════════════════════════════════════════════════
[CheckPerm-1732156235123] 🔐 Verificando permiso: "dashboard.read"
[CheckPerm-1732156235123] 📍 Ruta solicitada: /dashboard
[CheckPerm-1732156235123] 👤 Usuario: admin@gmail.com
[CheckPerm-1732156235123] 📊 Tiene permisos admin: false
[CheckPerm-1732156235123] 📦 Grupo activo ID: grp_976290a5-9831-497a-983d-acb389622059
[CheckPerm-1732156235123] 📋 Rol en grupo: owner
[CheckPerm-1732156235123] 📋 Total permisos: 18
[CheckPerm-1732156235123] 🔍 Permiso "dashboard.read": ✅ TIENE
[CheckPerm-1732156235123] ✅ ACCESO CONCEDIDO - Permiso verificado desde sesión
[CheckPerm-1732156235123] ═══════════════════════════════════════════════════════
```

### Verificación con Admin (Bypass)

```
[CheckPerm-1732156235456] ═══════════════════════════════════════════════════════
[CheckPerm-1732156235456] 🔐 Verificando permiso: "dashboard.write"
[CheckPerm-1732156235456] 📍 Ruta solicitada: /dashboard/edit
[CheckPerm-1732156235456] 👤 Usuario: superadmin@gmail.com
[CheckPerm-1732156235456] 📊 Tiene permisos admin: true
[CheckPerm-1732156235456] ✅ ACCESO CONCEDIDO - Usuario tiene permisos de admin
[CheckPerm-1732156235456] ═══════════════════════════════════════════════════════
```

### Carga de Permisos al Login

```
🔍 Verificando grupo activo del usuario...
📡 Obteniendo todos los permisos del usuario...
✅ Permisos cargados: 2 grupos
🔐 Permisos admin: true
  📋 grp_976290a5-9831-497a-983d-acb389622059: 18 permisos (owner)
  📋 grp_abc123def456: 13 permisos (gestor)
✅ Grupo activo encontrado: grp_976290a5-9831-497a-983d-acb389622059, redirigiendo a dashboard
```

### Refresco de Permisos

```
[RefreshPerms-1732156270000] 🔄 Refrescando permisos para: admin@gmail.com
[RefreshPerms-1732156270000] ✅ Permisos actualizados: 2 grupos
[RefreshPerms-1732156270000] 🔐 Permisos admin: true
[RefreshPerms-1732156270000]   📋 grp_xxx: 18 permisos (owner)
[RefreshPerms-1732156270000]   📋 grp_yyy: 13 permisos (gestor)
```

## 🎯 Permisos Disponibles

### Dashboard
- `dashboard.read` - Ver dashboard
- `dashboard.write` - Modificar dashboard

### Agenda
- `agenda.read` - Ver agenda
- `agenda.write` - Gestionar agenda

### Box
- `box.read` - Ver boxes
- `box.write` - Gestionar boxes
- `box.detalle.read` - Ver detalles de box
- `box.detalle.write` - Modificar detalles de box

### Datos
- `data.import` - Importar datos
- `data.export` - Exportar datos

### Médicos
- `medicos.read` - Ver médicos

### Notificaciones
- `notificaciones.read` - Ver notificaciones
- `notificaciones.historial` - Ver historial de notificaciones

### Administración
- `admin.users` - Administrar sistema y usuarios
- `admin.roles` - Administrar roles
- `admin.permissions` - Administrar permisos
- `admin.db` - Administrar bases de datos
- `admin.system` - Acceso de sistema

## 🔑 Roles Predefinidos

| Rol | Permisos | Descripción |
|-----|----------|-------------|
| **consulta** | 7 permisos | Solo lectura |
| **operador** | 8 permisos | Lectura + escritura básica |
| **gestor** | 13 permisos | Permisos avanzados + importar/exportar |
| **medico** | 5 permisos | Vista específica para médicos |
| **admin** | 18 permisos | Permisos administrativos completos |
| **owner** | 18 permisos | Propietario del grupo (todos los permisos) |

## 🚀 Ventajas del Sistema

✅ **Carga única al login** - Todos los permisos se obtienen una sola vez al iniciar sesión  
✅ **Verificación instantánea** - No requiere consultas a la base de datos en cada verificación  
✅ **Rendimiento mejorado** - Reduce latencia y carga en la API  
✅ **Actualizaciones bajo demanda** - Función de refresco cuando se necesita actualizar  
✅ **Escalable** - No importa cuántos permisos o grupos tenga el usuario  
✅ **Auditable** - Cada verificación queda registrada en logs detallados  
✅ **Flexible** - Múltiples formas de verificar permisos según la necesidad  
✅ **Fallback automático** - Si no hay permisos en sesión, consulta la API como respaldo  

### Comparación de Rendimiento

| Operación | Antes | Ahora |
|-----------|-------|-------|
| Verificar 1 permiso | ~100-200ms (API call) | <1ms (memoria) |
| Verificar 10 permisos | ~1-2s (10 API calls) | <1ms (memoria) |
| Login inicial | ~500ms | ~700ms (incluye carga de permisos) |
| Cambio de página | ~100-200ms/permiso | <1ms/permiso |

**Ahorro**: En una sesión típica con 50 verificaciones de permisos, el usuario ahorra ~5-10 segundos de tiempo de carga total.
