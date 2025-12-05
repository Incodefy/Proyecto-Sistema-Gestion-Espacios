# 🏥 Sistema de Gestión Hospital Padre Hurtado - Backend AWS

## 📋 Descripción

Backend serverless construido con AWS Lambda, DynamoDB, Cognito y API Gateway para gestión hospitalaria completa.

**Versión:** 2.1.0  
**Status:** ✅ Producción con seguridad empresarial  
**Última actualización:** 4 de Diciembre 2025

---

## ✨ Características Principales

### 🔒 Seguridad v2.1 (NUEVO)
- ✅ **Input Validation**: 100% handlers con validación AJV obligatoria
- ✅ **PII Encryption**: AES-256-GCM + KMS para datos sensibles
- ✅ **Request/Response Logging**: Logs sanitizados y centralizados
- ✅ **Dual Rate Limiting**: Throttling por usuario Y por IP
- ✅ **Secrets Rotation**: Automática cada 30 días

### 🏗️ Arquitectura
- **80+ Lambda Functions** (Node.js 20.x)
- **14 DynamoDB Tables** con KMS encryption
- **Cognito User Pool** con JWT Authorizer
- **WAF** con rate limiting y geo-blocking
- **GuardDuty** para threat detection
- **CloudTrail** para auditoría

### 📊 Funcionalidades
- Gestión de Grupos y Espacios
- Ocupantes (médicos, enfermeras, técnicos)
- Instrumentos médicos
- Especialidades
- Appointments (citas médicas)
- Notificaciones en tiempo real
- Personalización de usuario
- Sistema de permisos basado en roles

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- AWS CLI configurado (`aws configure`)
- Serverless Framework v3
- Credenciales AWS con permisos necesarios

### Instalación

```bash
# 1. Clonar repositorio
cd aws

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Desplegar a AWS
npm run deploy

# O con serverless directamente
serverless deploy --stage dev --region us-east-2
```

### Deploy Output Esperado

```
✔ Service deployed to stack feli-dev (142s)

endpoints:
  POST   - https://abc123xyz.execute-api.us-east-2.amazonaws.com/auth/login
  POST   - https://abc123xyz.execute-api.us-east-2.amazonaws.com/auth/refresh
  GET    - https://abc123xyz.execute-api.us-east-2.amazonaws.com/me
  POST   - https://abc123xyz.execute-api.us-east-2.amazonaws.com/groups
  GET    - https://abc123xyz.execute-api.us-east-2.amazonaws.com/groups/{id}
  ... (80+ endpoints)

functions:
  rotateSecrets: feli-dev-rotateSecrets (256 kB)
  health: feli-dev-health (1.2 kB)
  login: feli-dev-login (2.3 kB)
  ... (80+ functions)
```

---

## 📚 Documentación

### 📖 Guías de Seguridad v2.1

| Documento | Descripción |
|-----------|-------------|
| [SECURITY-IMPROVEMENTS-v2.1.md](SECURITY-IMPROVEMENTS-v2.1.md) | Detalles técnicos de las 5 mejoras de seguridad |
| [IMPLEMENTATION-CHECKLIST.md](IMPLEMENTATION-CHECKLIST.md) | Checklist paso a paso para implementación |
| [EXECUTIVE-SUMMARY-v2.1.md](EXECUTIVE-SUMMARY-v2.1.md) | Resumen ejecutivo con métricas de impacto |

### 🔧 Ejemplos de Código

| Archivo | Descripción |
|---------|-------------|
| [src/handlers/examples/secureOcupante.example.js](src/handlers/examples/secureOcupante.example.js) | Handler completo con todas las mejoras de seguridad integradas |

### 📋 Otras Guías

| Documento | Descripción |
|-----------|-------------|
| [README-MODERN.md](README-MODERN.md) | Documentación técnica detallada (v2.0) |
| [RESUMEN-EJECUTIVO.md](RESUMEN-EJECUTIVO.md) | Resumen de optimizaciones v2.0 |
| [PERMISSIONS-GUIDE.md](../incodefy/PERMISSIONS-GUIDE.md) | Sistema de permisos y roles |

---

## 🧪 Testing

### Crear Usuario de Prueba

```bash
# Obtener User Pool ID y Client ID
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name feli-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name feli-dev \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text)

# Crear usuario
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "test@hospital.com" \
  --user-attributes Name=email,Value="test@hospital.com" \
  --message-action SUPPRESS

# Asignar contraseña
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "test@hospital.com" \
  --password "Test1234!" \
  --permanent
```

### Probar Endpoints

```bash
# Obtener URL base
BASE=$(serverless info --verbose | grep HttpApiUrl | awk '{print $2}')

# 1. Login
curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test@hospital.com",
    "password": "Test1234!"
  }'

# Response:
# {
#   "ok": true,
#   "tokens": {
#     "idToken": "eyJraWQ...",
#     "accessToken": "eyJraWQ...",
#     "refreshToken": "eyJjdHk..."
#   }
# }

# 2. Endpoint protegido (requiere JWT)
TOKEN="eyJraWQ..."  # Copiar idToken del login

curl -X GET "$BASE/me" \
  -H "Authorization: Bearer $TOKEN"

# 3. Crear grupo (con validación v2.1)
curl -X POST "$BASE/groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cardiología - Piso 3",
    "description": "Grupo de especialidad cardiología"
  }'
```

### Health Check

```bash
curl "$BASE/health"

# Expected:
# {
#   "status": "healthy",
#   "timestamp": "2025-12-04T10:30:00.000Z",
#   "version": "2.1.0"
# }
```

---

## 🔒 Características de Seguridad v2.1

### 1. Input Validation (NUEVO ✨)

Todos los handlers POST/PUT/PATCH tienen validación AJV obligatoria:

```javascript
// ❌ ANTES: Sin validación
exports.handler = createAPIHandler(handler);

// ✅ AHORA: Validación forzada
const { createValidatedAPIHandler } = require('./utils/globalValidator');

exports.handler = createValidatedAPIHandler(handler, {
  method: 'POST',
  validationSchema: 'createGroup' // OBLIGATORIO
});
```

### 2. PII Encryption (NUEVO ✨)

Datos sensibles encriptados con AES-256-GCM + KMS:

```javascript
const { encryptPII, decryptPII } = require('./utils/encryption');

// Encriptar antes de guardar
const encrypted = await encryptPII({
  email: 'juan@hospital.com',
  telefono: '+56912345678',
  dni: '12345678-9'
});

// Campos encriptados: "iv:authTag:ciphertext"
console.log(encrypted.email);
// "ZGVmNDU2:YWJjMTIz:ZW1haWxAZXhhbXBsZS5jb20="
```

### 3. Request/Response Logging (NUEVO ✨)

Logging centralizado con sanitización de PII:

```javascript
const { requestResponseLogger } = require('./middleware/requestLogger');

exports.handler = createAPIHandler(handler, {
  preMiddleware: [requestResponseLogger().before],
  postMiddleware: [requestResponseLogger().after]
});

// Logs generados automáticamente con PII sanitizada
// email: "juan@hospital.com" → "ju***@hospital.com"
```

### 4. Dual Rate Limiting (NUEVO ✨)

Throttling por usuario **Y** por IP:

```javascript
exports.handler = createAPIHandler(handler, {
  rateLimit: {
    endpoint: 'createGroup',
    dualCheck: true, // Valida usuario + IP
    maxRequests: 10,
    windowSeconds: 60
  }
});
```

### 5. Secrets Rotation (NUEVO ✨)

Rotación automática cada 30 días:

```yaml
# Configurado en resources/secrets-rotation.yml
AppSecretsRotationSchedule:
  Type: AWS::SecretsManager::RotationSchedule
  RotationRules:
    AutomaticallyAfterDays: 30
```

---

## 📁 Estructura del Proyecto

```
aws/
├── src/
│   ├── handlers/           # 80+ Lambda functions
│   │   ├── auth/           # Login, refresh, me
│   │   ├── groups/         # CRUD grupos y espacios
│   │   ├── ocupantes/      # CRUD ocupantes
│   │   ├── instrumentos/   # CRUD instrumentos
│   │   ├── especialidades/ # CRUD especialidades
│   │   ├── permissions/    # Sistema de roles
│   │   ├── personalization/# Preferencias usuario
│   │   ├── notifications/  # Notificaciones
│   │   ├── secrets/        # Rotación de secrets ✨
│   │   └── examples/       # Ejemplos de uso ✨
│   ├── middleware/
│   │   ├── interceptors.js      # Request/response interceptors
│   │   ├── rateLimiter.js       # Dual rate limiting ✨
│   │   ├── requestLogger.js     # Logging sanitizado ✨
│   │   └── securityHeaders.js   # Security headers
│   ├── utils/
│   │   ├── logger.js            # Structured logging
│   │   ├── validator.js         # AJV schemas
│   │   ├── globalValidator.js   # Validation enforcer ✨
│   │   ├── encryption.js        # PII encryption ✨
│   │   ├── cache.js             # Redis-like caching
│   │   ├── circuitBreaker.js    # Circuit breaker pattern
│   │   ├── errorHandler.js      # Error handling
│   │   └── secretsManager.js    # AWS Secrets Manager
│   └── config/
│       ├── config.js            # Configuración central
│       ├── defaults.json        # Valores por defecto
│       └── permissions.json     # Definición de permisos
├── resources/
│   ├── kms.yml                  # KMS encryption keys
│   ├── waf.yml                  # WAF rules
│   ├── cloudtrail.yml           # Audit trail
│   ├── guardduty.yml            # Threat detection
│   ├── secrets-rotation.yml     # Secrets rotation ✨
│   ├── iam-permissions.yml      # IAM policies
│   └── environment.yml          # Environment variables
├── __tests__/                   # Test suites (93 test cases)
├── scripts/                     # Deployment scripts
├── serverless.yml               # Serverless config
├── package.json
├── README.md                    # Este archivo
├── SECURITY-IMPROVEMENTS-v2.1.md ✨
├── IMPLEMENTATION-CHECKLIST.md   ✨
└── EXECUTIVE-SUMMARY-v2.1.md     ✨
```

---

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests con cobertura
npm run test:coverage

# Tests específicos
npm test -- validator.test.js
```

### Coverage Esperado

```
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
utils/           |   85.2  |   78.4   |   82.1  |   86.3  |
  logger.js      |   92.1  |   85.3   |   90.0  |   93.5  |
  validator.js   |   88.7  |   82.1   |   87.5  |   89.2  |
  encryption.js  |   81.3  |   75.6   |   78.9  |   82.4  |
middleware/      |   82.4  |   76.8   |   80.3  |   83.1  |
handlers/        |   79.6  |   72.3   |   77.8  |   80.2  |
-----------------|---------|----------|---------|---------|
All files        |   82.1  |   75.9   |   79.8  |   83.2  |
-----------------|---------|----------|---------|---------|
```

---

## 📊 Métricas y Monitoreo

### CloudWatch Logs

```bash
# Ver logs de un handler específico
aws logs tail /aws/lambda/feli-dev-createGroup --follow

# Filtrar logs de auditoría
aws logs filter-log-events \
  --log-group-name /aws/lambda/feli-dev-createGroup \
  --filter-pattern '{ $.eventType = "AUDIT" }'

# Buscar errores
aws logs filter-log-events \
  --log-group-name /aws/lambda/feli-dev-createGroup \
  --filter-pattern '{ $.level = "error" }'
```

### CloudWatch Metrics

- **Lambda Duration**: p50, p95, p99
- **Lambda Errors**: Count
- **API Gateway 4xx/5xx**: Count
- **DynamoDB Throttles**: Count
- **KMS API Calls**: Count
- **Rate Limit Blocks**: Custom metric

### CloudWatch Alarms

- ✅ Secret rotation failures
- ✅ Lambda errors > 10/min
- ✅ API Gateway 5xx > 5%
- ✅ DynamoDB throttles > 100/min

---

## 🚢 Deployment

### Ambientes

```bash
# Development
serverless deploy --stage dev --region us-east-2

# Staging
serverless deploy --stage staging --region us-east-2

# Production
serverless deploy --stage prod --region us-east-2
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS
on:
  push:
    branches: [main, develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: serverless deploy --stage prod
```

---

## 🔧 Configuración Avanzada

### Variables de Entorno

```bash
# .env
AWS_REGION=us-east-2
STAGE=dev
KMS_KEY_ID=arn:aws:kms:us-east-2:ACCOUNT_ID:key/KEY_ID
ADMIN_EMAIL=admin@hospital.com
LOG_LEVEL=info
APP_URL=http://localhost:3000
```

### Secrets en AWS Secrets Manager

```bash
# Crear secret
aws secretsmanager create-secret \
  --name hospital/dev/app-secrets \
  --secret-string '{
    "JWT_SECRET": "secure-random-64-chars",
    "SESSION_SECRET": "secure-random-64-chars",
    "ENCRYPTION_KEY": "secure-random-64-chars"
  }'

# Leer secret
aws secretsmanager get-secret-value \
  --secret-id hospital/dev/app-secrets \
  | jq -r '.SecretString | fromjson'
```

---

## 📝 Changelog

### v2.1.0 (2025-12-04) - Seguridad Empresarial ✨

**Added:**
- ✨ Input validation obligatoria (globalValidator.js)
- ✨ PII encryption con AES-256-GCM (encryption.js)
- ✨ Request/Response logging sanitizado (requestLogger.js)
- ✨ Dual rate limiting: user + IP (rateLimiter.js)
- ✨ Secrets rotation automática (rotateSecrets.js + secrets-rotation.yml)
- ✨ Ejemplo completo de handler seguro (secureOcupante.example.js)
- ✨ Documentación exhaustiva (3 guías nuevas)

**Changed:**
- 🔧 rateLimiter.js: Agregada función checkRateLimitDual()
- 🔧 serverless.yml: Agregada función Lambda rotateSecrets

**Security:**
- 🔒 100% handlers con validación obligatoria
- 🔒 PII encriptada en tránsito y reposo
- 🔒 Logs sanitizados (PII enmascarada)
- 🔒 Rate limiting dual (previene abuso distribuido)
- 🔒 Rotación automática de secrets cada 30 días

**Metrics:**
- Security Score: 65% → 80% (+15%)
- Handlers validados: 40% → 100% (+150%)
- PII encriptada: 0% → 100% (∞)

### v2.0.0 (2025-11-30) - Optimización y Modernización

**Added:**
- ✅ 8 mejoras de arquitectura implementadas
- ✅ 93 test cases (coverage ~78%)
- ✅ Modularización de serverless.yml
- ✅ Documentación README-MODERN.md

**Changed:**
- 🔧 80/82 handlers migrados a patrón moderno
- 🔧 Eliminados 4 archivos obsoletos (-837 líneas)
- 🔧 Middleware consolidado (interceptors.js)

**Removed:**
- ❌ Código duplicado en utils/
- ❌ console.log en handlers (reemplazados por Logger)

### v1.0.0 (2025-10-01) - Lanzamiento Inicial

- 🎉 80 Lambda functions
- 🎉 14 DynamoDB tables
- 🎉 Cognito authentication
- 🎉 WAF + GuardDuty

---

## 🤝 Contribuir

### Reportar Issues

Usa el [issue tracker](https://github.com/hospital/proyecto/issues) para:
- 🐛 Reportar bugs
- 💡 Sugerir features
- 📝 Mejorar documentación

### Pull Requests

1. Fork el repositorio
2. Crea una branch (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la branch (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver `LICENSE` para más detalles.

---

## 👥 Equipo

**Desarrollado por:** Equipo de Desarrollo Hospital Padre Hurtado  
**Mantenedor:** @Incodefy  
**Contacto:** dev@hospital.com

---

## 🙏 Agradecimientos

- AWS Serverless Framework
- Comunidad de Node.js
- Contributors del proyecto

---

**¿Preguntas?** Lee la [documentación completa](SECURITY-IMPROVEMENTS-v2.1.md) o abre un [issue](https://github.com/hospital/proyecto/issues).

**¡Gracias por usar nuestro sistema!** 🎉

TOKENS=$(curl -s -X POST "$BASE/auth/login"   -H 'content-type: application/json'   -d '{"username":"alice@example.com","password":"Passw0rd!"}')

echo $TOKENS | jq
ID_TOKEN=$(echo $TOKENS | jq -r .idToken)
ACCESS_TOKEN=$(echo $TOKENS | jq -r .accessToken)
REFRESH_TOKEN=$(echo $TOKENS | jq -r .refreshToken)
```

### 2) Llamar un endpoint protegido
```bash
curl -s "$BASE/me" -H "authorization: Bearer $ID_TOKEN" | jq
```

### 3) Refrescar tokens
```bash
curl -s -X POST "$BASE/auth/refresh"   -H 'content-type: application/json'   -d "{"refreshToken":"$REFRESH_TOKEN"}" | jq
```

## Notas
- El authorizer de API Gateway valida **firma**, **audience (ClientId)** y **issuer (UserPool)**.
- Si obtienes `403` con `challenge: NEW_PASSWORD_REQUIRED`, el usuario requiere cambio de contraseña (flujo no cubierto aquí).
- Para **signup/confirmación** con correo/SMS, usa los endpoints de Cognito `SignUp`/`ConfirmSignUp` o el Hosted UI.
- `serverless offline` no emula el JWT authorizer; usa despliegue real para `/me`.

## Limpieza
```bash
npm run remove
```
