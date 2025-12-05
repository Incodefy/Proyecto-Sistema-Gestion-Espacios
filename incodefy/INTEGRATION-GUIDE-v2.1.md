# 🔗 Guía de Integración Frontend ↔ Backend (v2.1)

## 📋 Resumen

Esta guía documenta la integración entre:
- **Frontend**: Express.js 5.1.0 (`incodefy/`)
- **Backend**: AWS Lambda Serverless (`aws/`)

Con las **mejoras de seguridad v2.1** implementadas.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND (Express.js 5.1.0)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ server.js                                                 │   │
│  │  - Correlation ID Middleware                              │   │
│  │  - requireAuth (JWT validation)                           │   │
│  │  - attachApiClientV2                                      │   │
│  │  - checkGrupoActivo                                       │   │
│  │  - Routes (onboarding, gestion, notificaciones, etc.)     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐   │
│  │ apiClientV2.js                                            │   │
│  │  - axios HTTP client                                      │   │
│  │  - Authorization: Bearer {token}                          │   │
│  │  - X-Correlation-ID header                                │   │
│  │  - Retry automático (429, 503, network errors)            │   │
│  │  - Rate limit headers parsing                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│             AWS API GATEWAY                                      │
│  - CORS headers                                                  │
│  - Cognito Authorizer (JWT validation)                           │
│  - Request throttling                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│            AWS LAMBDA (Node.js 20.x)                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ requestLogger.js                                          │   │
│  │  - logRequest() - Sanitiza PII, agrega X-Correlation-ID   │   │
│  │  - logResponse() - Logs sanitizados                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ rateLimiter.js                                            │   │
│  │  - checkRateLimitDual() - User + IP rate limiting         │   │
│  │  - X-RateLimit-* headers                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ globalValidator.js                                        │   │
│  │  - Validación AJV de inputs                               │   │
│  │  - Sanitización de strings                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ encryption.js                                             │   │
│  │  - encryptPII() antes de DynamoDB                         │   │
│  │  - decryptPII() antes de response                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Handler (ej. getOcupante.js)                              │   │
│  │  1. Rate limit check                                      │   │
│  │  2. Input validation                                      │   │
│  │  3. Query DynamoDB                                        │   │
│  │  4. decryptPII()                                          │   │
│  │  5. logAuditAction() si aplica                            │   │
│  │  6. return response con headers                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS DynamoDB                                  │
│  - Datos encriptados en reposo (KMS)                             │
│  - PII fields encriptados en tránsito (AES-256-GCM)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Flujo de Autenticación

### 1. Login de Usuario

```
1. Usuario ingresa email/password en frontend
   ↓
2. Frontend → AWS Cognito (API directa)
   POST https://cognito-idp.us-east-1.amazonaws.com/
   Body: { AuthFlow: "USER_PASSWORD_AUTH", ... }
   ↓
3. Cognito valida credenciales
   ↓
4. Cognito retorna JWT tokens:
   - IdToken (identidad del usuario)
   - AccessToken (autorización)
   - RefreshToken (renovación)
   ↓
5. Frontend guarda tokens en session:
   req.session.user = {
     token: IdToken,
     sub: user.sub,
     email: user.email,
     groups: user['cognito:groups']
   }
   ↓
6. Frontend redirige a /onboarding o /dashboard
```

### 2. Requests Autenticados

```
1. Usuario navega a ruta protegida (ej. /gestion-grupo)
   ↓
2. Middleware: requireAuth
   - Verifica req.session.user existe
   - Si no, redirige a /login
   ↓
3. Middleware: validateJWT (jwtValidator.js)
   - Extrae Authorization header del session
   - Valida firma con JWKS de Cognito
   - Verifica issuer, audience, expiration
   - Agrega req.user = { sub, email, groups }
   ↓
4. Middleware: correlationIdMiddleware
   - Genera req.correlationId
   - Agrega X-Correlation-ID a response
   ↓
5. Middleware: attachApiClientV2
   - Crea req.apiClient con token del usuario
   - Configura correlation ID
   ↓
6. Route handler
   - Usa req.apiClient.{metodo}()
   ↓
7. ApiClientV2 → Lambda
   - Agrega Authorization: Bearer {IdToken}
   - Agrega X-Correlation-ID
   ↓
8. API Gateway
   - Valida JWT con Cognito Authorizer
   - Extrae claims (sub, email, groups)
   - Pasa a Lambda con event.requestContext.authorizer.claims
   ↓
9. Lambda handler
   - Procesa request
   - Retorna response con headers (X-Correlation-ID, X-RateLimit-*)
   ↓
10. ApiClientV2 recibe response
    - Extrae metadata (duration, correlationId, rateLimitHeaders)
    - Retry si error 503/429
    ↓
11. Frontend renderiza vista
```

---

## 📡 Headers y Metadata

### Headers enviados por Frontend (ApiClientV2)

| Header                | Valor                          | Propósito                         |
|-----------------------|--------------------------------|-----------------------------------|
| `Authorization`       | `Bearer {IdToken}`             | Autenticación JWT                 |
| `X-Correlation-ID`    | `req-{timestamp}-{random}`     | Tracking de request               |
| `Content-Type`        | `application/json`             | Tipo de contenido                 |
| `X-Client-Version`    | `2.1.0`                        | Versión del cliente               |

### Headers recibidos del Backend (Lambda)

| Header                 | Ejemplo                        | Propósito                         |
|------------------------|--------------------------------|-----------------------------------|
| `X-Correlation-ID`     | `req-1703123456-a1b2c3d4`      | Mismo ID para tracking            |
| `X-RateLimit-Limit`    | `100`                          | Límite de requests (user)         |
| `X-RateLimit-Remaining`| `87`                           | Requests restantes                |
| `X-RateLimit-Reset`    | `1703123700000`                | Timestamp de reset (ms)           |
| `Retry-After`          | `45` (segundos)                | Cuándo reintentar (si 429)        |
| `Access-Control-Allow-Origin` | `http://localhost:3000` | CORS                              |

---

## 🔄 Flujo de Request con Mejoras v2.1

### Ejemplo: Crear un Ocupante

#### Frontend Code

```javascript
// routes/onboarding-espacios.js
router.post('/crear-ocupante', async (req, res) => {
  try {
    // req.apiClient ya está adjunto por attachApiClientV2 middleware
    const nuevoOcupante = await req.apiClient.client.post('/ocupantes', {
      nombre: req.body.nombre,
      email: req.body.email,     // ← PII - será encriptado en backend
      telefono: req.body.telefono, // ← PII - será encriptado
      dni: req.body.dni,          // ← PII - será encriptado
      grupo_id: req.session.grupo_activo.grupo_id
    });

    // Metadata disponible
    console.log('Duración:', nuevoOcupante.metadata.duration, 'ms');
    console.log('Correlation ID:', nuevoOcupante.metadata.correlationId);
    console.log('Rate Limit:', nuevoOcupante.metadata.rateLimitHeaders);

    res.json({ ok: true, data: nuevoOcupante.data });
  } catch (error) {
    // Error handling mejorado
    if (error.isAuthError) {
      return res.status(401).json({ error: 'Token expirado' });
    }

    console.error(`[${req.correlationId}] Error:`, error.apiError);
    res.status(500).json({ error: error.apiError?.message || 'Error del servidor' });
  }
});
```

#### Backend Code (Lambda Handler)

```javascript
// aws/src/handlers/ocupantes/createOcupante.js
const { createValidatedAPIHandler } = require('../../utils/globalValidator');
const { requestResponseLogger, logAuditAction } = require('../../middleware/requestLogger');
const { checkRateLimitDual } = require('../../middleware/rateLimiter');
const { encryptPII, decryptPII } = require('../../utils/encryption');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

const handler = async (event) => {
  const userSub = event.requestContext.authorizer.claims.sub;
  const correlationId = event.headers['X-Correlation-ID'] || 'unknown';

  // 1. Rate Limit Check (100 req/min user, 200 req/min IP)
  const rateLimitResult = await checkRateLimitDual(event, userSub);
  if (!rateLimitResult.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Retry-After': rateLimitResult.retryAfter || '60',
        'X-Correlation-ID': correlationId
      },
      body: JSON.stringify({ error: 'Rate limit exceeded' })
    };
  }

  // 2. Parse body (ya validado por globalValidator)
  const body = JSON.parse(event.body);

  // 3. Encriptar PII antes de guardar
  const encryptedData = await encryptPII({
    nombre: body.nombre,
    email: body.email,       // ← Se encripta
    telefono: body.telefono, // ← Se encripta
    dni: body.dni,           // ← Se encripta
    grupo_id: body.grupo_id,
    created_by: userSub,
    created_at: new Date().toISOString()
  });

  // 4. Guardar en DynamoDB
  const client = new DynamoDBClient();
  await client.send(new PutItemCommand({
    TableName: process.env.OCUPANTES_TABLE,
    Item: encryptedData
  }));

  // 5. Audit log
  await logAuditAction({
    userId: userSub,
    action: 'CREATE_OCUPANTE',
    resource: 'ocupantes',
    resourceId: encryptedData.id,
    correlationId
  });

  // 6. Desencriptar antes de retornar (para que frontend reciba datos legibles)
  const decryptedData = await decryptPII(encryptedData);

  // 7. Response con headers
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      'X-RateLimit-Limit': String(rateLimitResult.limit),
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(rateLimitResult.resetTime)
    },
    body: JSON.stringify({
      ok: true,
      data: decryptedData
    })
  };
};

module.exports.handler = createValidatedAPIHandler(handler, {
  requiredFields: ['nombre', 'email', 'grupo_id'],
  schema: {
    type: 'object',
    properties: {
      nombre: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      telefono: { type: 'string', pattern: '^\\+?[0-9]{8,15}$' },
      dni: { type: 'string', pattern: '^[0-9]{7,9}$' },
      grupo_id: { type: 'string', minLength: 1 }
    },
    required: ['nombre', 'email', 'grupo_id']
  }
});

// Wrapping con logging
module.exports.handler = requestResponseLogger(module.exports.handler);
```

#### DynamoDB (Datos encriptados)

```json
{
  "id": "ocp-12345",
  "nombre": "Juan Pérez",
  "email": "iv:authTag:ciphertext",  // ← Encriptado
  "telefono": "iv:authTag:ciphertext", // ← Encriptado
  "dni": "iv:authTag:ciphertext",     // ← Encriptado
  "grupo_id": "grp-67890",
  "created_by": "user-sub-123",
  "created_at": "2024-12-19T10:30:00Z"
}
```

#### CloudWatch Logs

```
[requestLogger] 🔵 POST /ocupantes
  Correlation ID: req-1703123456-a1b2c3d4
  User: user-sub-123
  IP: 192.168.1.100
  Body: { nombre: "Juan Pérez", email: "ju***@hospital.com", ... }  // ← PII sanitizado

[rateLimiter] ✅ Rate limit check passed
  User: 34/100 requests
  IP: 127/200 requests

[encryption] 🔐 Encrypted 3 PII fields (email, telefono, dni)

[DynamoDB] ✅ PutItem success

[audit] 📝 Audit log: CREATE_OCUPANTE by user-sub-123

[encryption] 🔓 Decrypted 3 PII fields for response

[requestLogger] 🟢 201 Created (342ms)
  Correlation ID: req-1703123456-a1b2c3d4
  Response: { ok: true, data: { nombre: "Juan Pérez", email: "juan@ho***", ... } }
```

---

## 🛡️ Integración de Seguridad v2.1

### 1. Input Validation

**Frontend**: Validación básica en forms (HTML5, JavaScript)
```html
<input type="email" required pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$">
```

**Backend**: Validación robusta con AJV
```javascript
// aws/src/utils/globalValidator.js
const handler = createValidatedAPIHandler(yourHandler, {
  requiredFields: ['email', 'nombre'],
  schema: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' }
    }
  }
});
```

### 2. Request/Response Logging

**Frontend**: Logging básico en desarrollo
```javascript
// ApiClientV2 automáticamente loggea en dev
🔵 [req-...] POST /ocupantes
🟢 [req-...] 201 (342ms)
```

**Backend**: Logging sanitizado completo
```javascript
// Todos los handlers wrapeados con requestResponseLogger()
[requestLogger] 🔵 POST /ocupantes
  User: user-sub-123
  Body: { email: "ju***@hospital.com" }  // PII sanitizado
```

### 3. Data Encryption

**En Reposo**: DynamoDB con KMS
```yaml
# serverless.yml
properties:
  SSESpecification:
    SSEEnabled: true
    SSEType: KMS
```

**En Tránsito**: Encryption/Decryption en handlers
```javascript
// Backend encripta antes de guardar
const encrypted = await encryptPII(data);
await dynamoDB.put(encrypted);

// Backend desencripta antes de retornar
const decrypted = await decryptPII(encrypted);
return createAPIResponse(200, decrypted);
```

**Frontend**: Recibe datos **desencriptados** (JSON normal)
```javascript
// No necesita código especial - ApiClientV2 maneja todo
const ocupante = await req.apiClient.client.get('/ocupantes/123');
console.log(ocupante.data.email); // "juan@hospital.com" (desencriptado)
```

### 4. Rate Limiting

**Backend**: Dual rate limiting (user + IP)
```javascript
const result = await checkRateLimitDual(event, userSub);
// User: 100 req/min, IP: 200 req/min
```

**Frontend**: Lee headers y muestra al usuario
```javascript
const response = await req.apiClient.obtenerGrupos();
const { remaining, limit, reset } = response.metadata.rateLimitHeaders;

if (remaining < 10) {
  console.warn(`⚠️ Solo quedan ${remaining}/${limit} requests`);
}
```

**UI Enhancement** (opcional):
```ejs
<!-- views/dashboard.ejs -->
<div class="rate-limit-badge">
  Requests restantes: <%= rateLimit.remaining %>/<%= rateLimit.total %>
</div>
```

### 5. Secrets Rotation

**Backend**: Automático cada 30 días
```yaml
# aws/resources/secrets-rotation.yml
AppSecretsRotationSchedule:
  Type: AWS::SecretsManager::RotationSchedule
  Properties:
    RotationRules:
      AutomaticallyAfterDays: 30
```

**Frontend**: Requiere coordinación manual
```bash
# 1. Obtener nuevo secret de AWS
aws secretsmanager get-secret-value --secret-id AppSecrets

# 2. Actualizar .env
SESSION_SECRET=nuevo-secret-aqui

# 3. Reiniciar servidor Express
pm2 restart incodefy
```

**Alternativa futura**: Health check endpoint que detecta cambios
```javascript
// Verificar cada 1 hora si el secret cambió
setInterval(async () => {
  const currentHash = crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest('hex');
  const remoteHash = await fetch(`${API_BASE_URL}/health/secret-hash`).then(r => r.json());
  
  if (currentHash !== remoteHash.hash) {
    console.warn('⚠️ SESSION_SECRET desactualizado - reiniciar servidor');
    // Opcional: process.exit(1) para que pm2 reinicie automáticamente
  }
}, 60 * 60 * 1000);
```

---

## 🔍 Debugging End-to-End

### 1. Usar Correlation IDs

**Frontend**:
```javascript
router.get('/ocupantes', async (req, res) => {
  console.log(`[${req.correlationId}] Fetching ocupantes...`);
  
  try {
    const ocupantes = await req.apiClient.client.get('/ocupantes');
    console.log(`[${req.correlationId}] Success - ${ocupantes.data.length} items`);
    res.json(ocupantes.data);
  } catch (error) {
    console.error(`[${req.correlationId}] Error:`, error.apiError);
    res.status(500).json({ error: 'Error del servidor' });
  }
});
```

**Backend (CloudWatch Logs)**:
```
# Filtrar por correlation ID
[requestLogger] 🔵 GET /ocupantes
  Correlation ID: req-1703123456-a1b2c3d4  ← Buscar este ID

[rateLimiter] ✅ Rate limit check passed
  Correlation ID: req-1703123456-a1b2c3d4

[DynamoDB] ✅ Query success (23 items)
  Correlation ID: req-1703123456-a1b2c3d4

[requestLogger] 🟢 200 OK (156ms)
  Correlation ID: req-1703123456-a1b2c3d4
```

### 2. CloudWatch Insights Query

```sql
fields @timestamp, @message
| filter @message like /req-1703123456-a1b2c3d4/
| sort @timestamp asc
```

### 3. Postman / cURL Testing

```bash
# Probar endpoint directamente con correlation ID
curl -X GET \
  https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/grupos \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "X-Correlation-ID: test-manual-12345" \
  -v

# Verificar headers en response
< X-Correlation-ID: test-manual-12345
< X-RateLimit-Limit: 100
< X-RateLimit-Remaining: 89
< X-RateLimit-Reset: 1703123700000
```

---

## ⚙️ Variables de Entorno

### Frontend (.env)

```bash
# Server
NODE_ENV=production
PORT=3000

# Session
SESSION_SECRET=your-64-char-secret-here

# CORS
ALLOWED_ORIGINS=https://app.hospital.com,https://admin.hospital.com

# Database
DB_HOST=db.hospital.internal
DB_USER=incodefy_user
DB_PASSWORD=your-secure-password
DB_NAME=incodefy_prod

# AWS Cognito
AWS_REGION=us-east-1
USER_POOL_ID=us-east-1_XXXXXXXXX
USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx

# Backend API
API_BASE_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com

# ApiClientV2 Config
API_MAX_RETRIES=3
API_RETRY_DELAY=1000

# Admin notifications
ADMIN_EMAIL=admin@hospital.com
```

### Backend (serverless.yml environment)

```yaml
provider:
  environment:
    OCUPANTES_TABLE: ${self:service}-ocupantes-${sls:stage}
    GRUPOS_TABLE: ${self:service}-grupos-${sls:stage}
    
    # Secrets from AWS Secrets Manager
    JWT_SECRET: ${file(./scripts/get-secret.js):JWT_SECRET}
    SESSION_SECRET: ${file(./scripts/get-secret.js):SESSION_SECRET}
    ENCRYPTION_KEY: ${file(./scripts/get-secret.js):ENCRYPTION_KEY}
    
    # KMS for PII encryption
    KMS_KEY_ID: ${cf:${self:service}-${sls:stage}.KMSKeyId}
    
    # Rate limiting
    RATE_LIMIT_USER: 100      # requests per minute per user
    RATE_LIMIT_IP: 200        # requests per minute per IP
    RATE_LIMIT_WINDOW: 60     # seconds
    
    # CORS
    APP_URL: ${env:APP_URL, 'http://localhost:3000'}
```

---

## 📊 Monitoreo y Métricas

### CloudWatch Metrics (Backend)

```javascript
// Custom metrics enviadas por handlers
await cloudwatch.putMetricData({
  Namespace: 'Hospital/API',
  MetricData: [{
    MetricName: 'OcupanteCreated',
    Value: 1,
    Unit: 'Count',
    Dimensions: [
      { Name: 'GrupoId', Value: grupo_id },
      { Name: 'Environment', Value: process.env.STAGE }
    ]
  }]
});
```

### Frontend Metrics (opcional)

```javascript
// Enviar duración de requests a CloudWatch
router.post('/ocupantes', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const result = await req.apiClient.client.post('/ocupantes', req.body);
    const duration = Date.now() - startTime;
    
    // Log para analytics
    console.log(JSON.stringify({
      event: 'api_request',
      method: 'POST',
      endpoint: '/ocupantes',
      duration,
      status: 201,
      correlationId: req.correlationId
    }));
    
    res.json(result.data);
  } catch (error) {
    // Log error metrics
  }
});
```

---

## 🚀 Deployment Checklist

### Frontend (Express.js)

- [ ] Actualizar `.env` con valores de producción
- [ ] Verificar `SESSION_SECRET` sea seguro (64+ chars)
- [ ] Configurar `ALLOWED_ORIGINS` con dominios reales
- [ ] Actualizar `API_BASE_URL` con endpoint de API Gateway production
- [ ] Agregar `correlationIdMiddleware` en `server.js`
- [ ] Reemplazar `attachApiClient` por `attachApiClientV2`
- [ ] Probar login → JWT validation → API calls
- [ ] Verificar logs de correlation IDs
- [ ] Configurar PM2 o similar para auto-restart
- [ ] Configurar HTTPS con certificado SSL
- [ ] Habilitar health check endpoint (`/health`)

### Backend (Serverless)

- [ ] Verificar todas las mejoras v2.1 desplegadas:
  - [ ] `globalValidator.js`
  - [ ] `requestLogger.js`
  - [ ] `encryption.js`
  - [ ] `rateLimiter.js` (dual)
  - [ ] `rotateSecrets.js` + `secrets-rotation.yml`
- [ ] Desplegar a staging primero: `sls deploy --stage staging`
- [ ] Probar end-to-end con frontend de staging
- [ ] Verificar CloudWatch Logs (correlation IDs, PII sanitizado)
- [ ] Verificar CloudWatch Alarms (SecretRotationFailureAlarm)
- [ ] Desplegar a production: `sls deploy --stage production`
- [ ] Configurar SNS para notificaciones (ADMIN_EMAIL)
- [ ] Habilitar AWS WAF en API Gateway
- [ ] Configurar GuardDuty para detección de amenazas

### Integration Testing

- [ ] Test de login → obtener JWT → request autenticado
- [ ] Test de rate limiting (hacer 100+ requests en 1 minuto)
- [ ] Test de retry automático (simular error 503)
- [ ] Test de correlation ID (verificar en CloudWatch)
- [ ] Test de PII encryption (crear ocupante → verificar DynamoDB)
- [ ] Test de secrets rotation (esperar 30 días o forzar rotación)
- [ ] Test de CORS (request desde dominio permitido y no permitido)

---

## 🆘 Troubleshooting Común

### 1. "CORS error" en frontend

**Síntomas**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Causa**: `serverless.yml` no incluye el dominio del frontend en `allowedOrigins`

**Solución**:
```yaml
# serverless.yml
custom:
  allowedOrigins:
    - ${env:APP_URL, 'http://localhost:3000'}
    - https://app.hospital.com  # ← AGREGAR
```

### 2. "401 Unauthorized" en requests

**Síntomas**: Todos los requests retornan 401

**Causa**: JWT expirado o inválido

**Solución**:
```javascript
// jwtValidator.js - verificar issuer
const issuer = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.USER_POOL_ID}`;

// Verificar que .env tenga valores correctos
USER_POOL_ID=us-east-1_XXXXXXXXX  # ← Debe coincidir con backend
```

### 3. "Rate limit exceeded" muy rápido

**Síntomas**: Error 429 después de pocos requests

**Causa**: Rate limit muy bajo o IP compartida

**Solución**:
```bash
# Backend - ajustar límites en serverless.yml
RATE_LIMIT_USER: 200  # Aumentar de 100 a 200
RATE_LIMIT_IP: 500    # Aumentar de 200 a 500
```

### 4. PII no se desencripta en frontend

**Síntomas**: Frontend recibe email como `iv:authTag:ciphertext`

**Causa**: Handler del backend no llama `decryptPII()` antes de retornar

**Solución**:
```javascript
// En handler del backend
const ocupante = await dynamoDB.get({ ... });
const decrypted = await decryptPII(ocupante);  // ← AGREGAR
return createAPIResponse(200, decrypted);
```

### 5. Correlation ID no aparece en logs

**Síntomas**: CloudWatch Logs sin correlation IDs

**Causa**: `requestLogger.js` no está wrapeando el handler

**Solución**:
```javascript
// En handler del backend
const { requestResponseLogger } = require('../../middleware/requestLogger');

module.exports.handler = requestResponseLogger(yourHandler);  // ← WRAP
```

---

## 📚 Referencias

- **Backend Security v2.1**: `aws/SECURITY-IMPROVEMENTS-v2.1.md`
- **Executive Summary**: `aws/EXECUTIVE-SUMMARY-v2.1.md`
- **Migration Guide**: `incodefy/MIGRATION-GUIDE-v2.1.md`
- **Serverless Framework**: https://www.serverless.com/framework/docs
- **AWS API Gateway**: https://docs.aws.amazon.com/apigateway/
- **AWS Cognito**: https://docs.aws.amazon.com/cognito/
- **Express.js**: https://expressjs.com/

---

**Última actualización**: 2024-12-19  
**Versión**: 2.1.0
