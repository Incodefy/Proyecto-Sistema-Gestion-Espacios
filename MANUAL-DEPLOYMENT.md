# Manual Deployment para AWS Academy Learner Lab

## ⚠️ Limitaciones de AWS Academy

AWS Academy Learner Lab tiene restricciones importantes:
- ❌ **No permite CloudFormation** (por eso Serverless Framework no funciona)
- ❌ **No permite crear DynamoDB tables** (restricción de IAM)
- ❌ **No permite crear Cognito User Pools** (restricción de IAM)
- ⚠️ **Puede permitir crear Lambda functions** (depende del lab)
- ⚠️ **Puede permitir crear API Gateway** (depende del lab)

## 🎯 Solución: Deployment Local + Verificación

### Paso 1: Obtener credenciales AWS

1. Ve a **AWS Academy** → Learner Lab
2. Click **Start Lab** (espera a que esté verde)
3. Click **AWS Details**
4. Click **Show** en "AWS CLI credentials"
5. Copia las 3 líneas:
```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_SESSION_TOKEN=...
```

### Paso 2: Configurar credenciales localmente

**En PowerShell (Windows):**
```powershell
$env:AWS_ACCESS_KEY_ID="..."
$env:AWS_SECRET_ACCESS_KEY="..."
$env:AWS_SESSION_TOKEN="..."
$env:AWS_REGION="us-east-1"
```

**En Bash (Mac/Linux):**
```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
export AWS_REGION="us-east-1"
```

### Paso 3: Verificar permisos disponibles

```bash
cd aws
bash scripts/check-permissions.sh
```

### Paso 4: Intentar deployment manual

```bash
# Intenta crear tablas DynamoDB
bash scripts/deploy-dynamodb.sh

# Intenta crear Cognito
bash scripts/deploy-cognito.sh

# Intenta crear Lambdas
bash scripts/deploy-lambda.sh
```

## 🔧 Alternativa: Usar AWS Console manualmente

Si los scripts fallan por permisos, crea los recursos manualmente:

### 1. Crear tablas DynamoDB (si está permitido)

En AWS Console → DynamoDB → Create table:

**Tabla 1: user-roles**
- Table name: `hospital-backend-dev-user-roles`
- Partition key: `user_sub` (String)
- Settings: On-demand

**Tabla 2: permissions**
- Table name: `hospital-backend-dev-permissions`
- Partition key: `permission_id` (String)
- Settings: On-demand

**Tabla 3: parameters**
- Table name: `hospital-backend-dev-parameters`
- Partition key: `user_sub` (String)
- Sort key: `parameter_key` (String)
- Settings: On-demand

### 2. Crear Cognito User Pool (si está permitido)

En AWS Console → Cognito → Create user pool:
- Pool name: `hospital-backend-dev-pool`
- Sign-in: Email
- Password policy: Minimum 8 characters
- Create app client: `hospital-backend-dev-app`

### 3. Crear Lambda Functions (si está permitido)

Para cada función en `aws/src/handlers/`:

1. Create function
2. Function name: `hospital-backend-{nombre}-dev`
3. Runtime: Node.js 20.x
4. Role: LabRole (arn:aws:iam::211125294486:role/LabRole)
5. Upload código: Zip con `src/` y `node_modules/`

### 4. Crear API Gateway (si está permitido)

1. API Gateway → Create API → HTTP API
2. Add integrations → Lambda functions
3. Configure routes:
   - GET /health → hospital-backend-health-dev
   - POST /login → hospital-backend-login-dev
   - POST /refresh → hospital-backend-refresh-dev
   - etc.

## 📝 Actualizar GitHub Secrets

Una vez creados los recursos, actualiza los secrets:

```
USER_POOL_ID=us-east-1_XXXXXX
USER_POOL_CLIENT_ID=XXXXXXXXX
API_GATEWAY_URL=https://XXXXX.execute-api.us-east-1.amazonaws.com
```

## ⏰ Recordatorio: Tokens AWS Academy

Los tokens expiran cada **4 horas**. Debes:
1. Ir a AWS Academy
2. Obtener nuevas credenciales
3. Actualizar GitHub Secrets
4. Re-ejecutar pipeline

## 🎓 Alternativa para el Proyecto

**Si AWS Academy tiene muchas restricciones, considera:**

1. **Usar AWS Free Tier personal** (sin restricciones)
2. **Demostrar el CI pipeline** (que ya funciona 100%)
3. **Documentar el proceso de CD** (con esta guía)
4. **Mostrar capturas** de los recursos creados manualmente
5. **Enfocarte en el código** (que está completo y funcional)

El valor del proyecto está en:
- ✅ Código backend bien estructurado (9 funciones Lambda)
- ✅ CI Pipeline completamente funcional
- ✅ Infraestructura como código (serverless.yml + scripts)
- ✅ Documentación completa del proceso
- ⚠️ CD limitado por restricciones de AWS Academy (no es tu culpa)
