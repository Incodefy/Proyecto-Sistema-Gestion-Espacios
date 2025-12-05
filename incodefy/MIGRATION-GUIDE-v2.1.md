# 🔄 Guía de Migración: apiClient.js → apiClientV2.js

## 📋 Resumen

Esta guía explica cómo migrar tu aplicación Express.js para usar el nuevo **ApiClientV2** que incluye soporte para las mejoras de seguridad v2.1 del backend serverless.

---

## 🆕 Nuevas Características de ApiClientV2

### 1. **Correlation IDs**
- Tracking end-to-end de requests
- Facilita debugging entre frontend y backend
- Se genera automáticamente o se puede proporcionar

### 2. **Rate Limiting Headers**
- Lee headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Permite mostrar quota al usuario
- Metadata disponible en `response.metadata.rateLimitHeaders`

### 3. **Retry Automático**
- Retry con exponential backoff para errores 500/502/503
- Retry automático para 429 (Rate Limit) respetando `Retry-After`
- Retry para network errors (timeout, conexión fallida)
- Configurable: `maxRetries` y `retryDelay`

### 4. **Mejor Error Handling**
- Errors enriquecidos con `error.apiError` (status, code, message, correlationId)
- Detección automática de token expirado (`error.isAuthError = true`)
- Logging estructurado con correlation IDs

### 5. **Request/Response Metadata**
- Duración de cada request en ms
- Correlation ID del backend
- Rate limit info
- Disponible en `response.metadata`

---

## 🚀 Pasos de Migración

### Paso 1: Instalar Dependencias (ya están)

```bash
# No se requieren nuevas dependencias
# axios, crypto (nativo), dotenv ya están instaladas
```

### Paso 2: Actualizar `.env`

Agregar nuevas variables al archivo `.env` (ver `.env.example`):

```bash
# Retry configuration para ApiClientV2
API_MAX_RETRIES=3
API_RETRY_DELAY=1000

# Email del administrador (opcional)
ADMIN_EMAIL=admin@hospital.com
```

### Paso 3: Agregar Middleware de Correlation ID

En `server.js`, **antes** de los routers:

```javascript
// ============================================
// NUEVO: Correlation ID Middleware
// ============================================
const { correlationIdMiddleware } = require('./middleware/correlationId');
app.use(correlationIdMiddleware); // <-- AGREGAR ANTES DE LOS ROUTERS
```

### Paso 4: Actualizar Middleware de ApiClient

Tienes **dos opciones**:

#### Opción A: Migración Gradual (RECOMENDADO)

Usa el nuevo `apiClientV2.js` middleware solo en rutas específicas:

```javascript
// En server.js o en rutas individuales
const attachApiClientV2 = require('./middleware/apiClientV2');

// Ejemplo: Aplicar solo a nuevas rutas
app.use('/api/v2', attachApiClientV2, nuevasRutasRouter);

// O en rutas individuales:
const onboardingEspaciosRoutes = require('./routes/onboarding-espacios');
app.use('/onboarding-espacios', 
  requireAuth, 
  attachApiClientV2,  // <-- NUEVO (reemplaza attachApiClient)
  checkGrupoActivo, 
  nomenclaturaMiddleware, 
  onboardingEspaciosRoutes
);
```

#### Opción B: Migración Completa

Reemplazar **todos** los usos de `attachApiClient` por `attachApiClientV2`:

```javascript
// ANTES:
const attachApiClient = require('./middleware/apiClient');
app.use('/gestion-grupo', requireAuth, attachApiClient, ...);

// DESPUÉS:
const attachApiClientV2 = require('./middleware/apiClientV2');
app.use('/gestion-grupo', requireAuth, attachApiClientV2, ...);
```

### Paso 5: Actualizar Rutas (NO NECESARIO - Compatible)

El **ApiClientV2 es 100% compatible** con el código existente. Todos los métodos del `ApiClient` original siguen funcionando:

```javascript
// ✅ Código existente sigue funcionando sin cambios
router.get('/grupos', async (req, res) => {
  const grupos = await req.apiClient.listarGruposUsuario();
  res.json(grupos);
});

// ✅ Nuevas features opcionales
router.get('/grupos-v2', async (req, res) => {
  try {
    const response = await req.apiClient.client.get('/groups');
    
    // Acceder a metadata
    console.log('Duración:', response.metadata.duration, 'ms');
    console.log('Correlation ID:', response.metadata.correlationId);
    console.log('Rate Limit:', response.metadata.rateLimitHeaders.remaining);
    
    res.json(response.data);
  } catch (error) {
    // Error handling mejorado
    if (error.isAuthError) {
      return res.status(401).json({ error: 'Token expirado' });
    }
    
    console.error('Error:', error.apiError);
    res.status(500).json({ 
      error: error.apiError?.message || 'Error del servidor' 
    });
  }
});
```

---

## 🔍 Verificación de Migración

### 1. Verificar Correlation IDs

En development, deberías ver logs como:

```
🔵 [req-1703123456789-a1b2c3d4e5f6g7h8] GET /api/grupos
🟢 [req-1703123456789-a1b2c3d4e5f6g7h8] 200 (245ms)
📊 Rate Limit: 95/100
```

### 2. Verificar Retry Automático

Simular un error de backend (ej. apagar temporalmente el servicio) y verificar que se hacen retries:

```
🔴 [req-...] Error 503 (1024ms) Service Unavailable
🔄 Server error - Retry 1/3 en 1000ms
🔴 [req-...] Error 503 (1052ms) Service Unavailable
🔄 Server error - Retry 2/3 en 2000ms
🟢 [req-...] 200 (876ms)
```

### 3. Verificar Rate Limiting

Si se excede el rate limit (100 req/min por user, 200 req/min por IP):

```
🔴 [req-...] Error 429 (123ms) Too Many Requests
⏱️ Rate limit exceeded - Retry after 45s
🔄 Retry automático en 45000ms...
```

### 4. Test de Integración

```javascript
// test/apiClientV2.test.js
const ApiClientV2 = require('../apiClientV2');

describe('ApiClientV2', () => {
  it('should add correlation ID to requests', async () => {
    const client = new ApiClientV2('fake-token', { correlationId: 'test-123' });
    expect(client.correlationId).toBe('test-123');
  });

  it('should retry on 503 errors', async () => {
    // Mock axios para simular 503 → 503 → 200
    // Verificar que se hagan exactamente 2 retries
  });
});
```

---

## 📊 Comparación de Features

| Feature                     | apiClient (Original) | ApiClientV2 (Nuevo) |
|-----------------------------|----------------------|---------------------|
| Authorization header        | ✅                    | ✅                   |
| Error logging               | ✅ Básico            | ✅ Mejorado          |
| Fallback a arrays vacíos    | ✅                    | ✅                   |
| **Correlation IDs**         | ❌                    | ✅                   |
| **Rate Limit headers**      | ❌                    | ✅                   |
| **Retry automático**        | ❌                    | ✅                   |
| **Request metadata**        | ❌                    | ✅ (duration, etc.)  |
| **Exponential backoff**     | ❌                    | ✅                   |
| **429 retry con Retry-After**| ❌                   | ✅                   |
| **Token expiration flag**   | ❌                    | ✅ (error.isAuthError)|
| **Structured error info**   | ❌                    | ✅ (error.apiError)  |

---

## 🎯 Casos de Uso Comunes

### 1. Mostrar Rate Limit al Usuario

```javascript
router.get('/dashboard', async (req, res) => {
  try {
    const response = await req.apiClient.client.get('/groups');
    const { rateLimitHeaders } = response.metadata;
    
    res.render('dashboard', {
      grupos: response.data,
      rateLimit: {
        remaining: rateLimitHeaders.remaining,
        total: rateLimitHeaders.limit,
        resetTime: rateLimitHeaders.reset
      }
    });
  } catch (error) {
    // Error handling...
  }
});
```

### 2. Tracking de Requests con Correlation ID

```javascript
router.post('/grupos', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const response = await req.apiClient.crearGrupo(req.body.nombre);
    
    console.log(`✅ [${req.correlationId}] Grupo creado en ${Date.now() - startTime}ms`);
    res.json(response);
  } catch (error) {
    console.error(`❌ [${req.correlationId}] Error creando grupo:`, error.apiError);
    res.status(500).json({ error: 'Error creando grupo' });
  }
});
```

### 3. Handling de Token Expirado

```javascript
router.get('/perfil', async (req, res) => {
  try {
    const perfil = await req.apiClient.obtenerPersonalizacion();
    res.json(perfil);
  } catch (error) {
    if (error.isAuthError) {
      // Redirigir a login o refrescar token
      return res.status(401).json({ 
        error: 'Token expirado',
        redirect: '/login'
      });
    }
    res.status(500).json({ error: 'Error del servidor' });
  }
});
```

---

## ⚠️ Consideraciones Importantes

### 1. Compatibilidad con Backend v2.1

El backend debe tener implementadas las siguientes mejoras:

- ✅ `requestLogger.js` (Correlation IDs en responses)
- ✅ `rateLimiter.js` (Headers `X-RateLimit-*`)
- ✅ Error responses sanitizados

### 2. Encriptación de PII

Si el backend retorna datos **encriptados** (PII como email, teléfono, DNI):

**Opción 1: Backend desencripta antes de response** (RECOMENDADO)
```javascript
// En handlers del backend (Lambda)
const decryptedOcupante = await decryptPII(ocupante);
return createAPIResponse(200, decryptedOcupante);
```

**Opción 2: Frontend desencripta** (si el backend envía datos encriptados)
- Requiere implementar `utils/encryption.js` en frontend
- Requiere `KMS_KEY_ID` en `.env`
- Menos recomendado (expone KMS al frontend)

### 3. Session Secret Rotation

Cuando el backend rote `SESSION_SECRET` (cada 30 días), **coordinación manual requerida**:

1. Obtener nuevo secret de AWS Secrets Manager
2. Actualizar `.env` en servidor Express.js
3. Reiniciar servidor

**Alternativa futura**: Implementar endpoint `/api/health` que retorne hash del secret, y reiniciar automáticamente si cambia.

---

## 📝 Checklist de Migración

- [ ] Actualizar `.env` con nuevas variables
- [ ] Agregar `correlationIdMiddleware` en `server.js` (antes de routers)
- [ ] Reemplazar `attachApiClient` por `attachApiClientV2` en rutas
- [ ] Verificar logs de correlation IDs en development
- [ ] Probar retry automático (simular error 503)
- [ ] Probar rate limiting (hacer 100+ requests en 1 minuto)
- [ ] Actualizar tests si existen
- [ ] Documentar nuevos headers en README.md
- [ ] Deploy a staging y verificar integración end-to-end
- [ ] Monitorear CloudWatch Logs para correlation IDs

---

## 🆘 Troubleshooting

### Error: "No correlation ID in response"

**Causa**: El backend no tiene implementado `requestLogger.js`

**Solución**: Verificar que el backend serverless tenga las mejoras v2.1 desplegadas:

```bash
cd aws/
serverless deploy --stage production
```

### Error: "Rate limit headers undefined"

**Causa**: El backend no retorna headers `X-RateLimit-*`

**Solución**: Verificar que `rateLimiter.js` esté integrado en los handlers del backend

### Error: "Retry loop infinito"

**Causa**: `maxRetries` configurado muy alto o backend siempre retorna 503

**Solución**: 
1. Reducir `API_MAX_RETRIES` en `.env` (recomendado: 3)
2. Verificar health del backend en CloudWatch Logs

### Frontend no recibe datos desencriptados

**Causa**: El backend retorna PII encriptada y el frontend no desencripta

**Solución**: Modificar handlers del backend para llamar `decryptPII()` antes de retornar:

```javascript
// En aws/src/handlers/ocupantes/getOcupante.js
const ocupante = await getOcupanteFromDB(id);
const decryptedOcupante = await decryptPII(ocupante); // <-- AGREGAR
return createAPIResponse(200, decryptedOcupante);
```

---

## 📚 Recursos Adicionales

- **Backend v2.1 Documentation**: `aws/SECURITY-IMPROVEMENTS-v2.1.md`
- **Executive Summary**: `aws/EXECUTIVE-SUMMARY-v2.1.md`
- **Example Handler**: `aws/src/handlers/examples/secureOcupante.example.js`
- **Correlation ID RFC**: https://www.w3.org/TR/trace-context/

---

## 🎉 Resultado Final

Después de la migración, tendrás:

✅ **Trazabilidad end-to-end** con correlation IDs  
✅ **Resiliencia mejorada** con retry automático  
✅ **Visibilidad de quotas** con rate limit headers  
✅ **Mejor debugging** con metadata de requests  
✅ **Error handling robusto** con información estructurada  
✅ **100% compatible** con código existente  

---

**Última actualización**: 2024-12-19  
**Versión**: 2.1.0
