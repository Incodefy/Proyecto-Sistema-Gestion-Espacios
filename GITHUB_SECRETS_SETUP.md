# 🔐 GitHub Secrets - Configuración Completa

Esta guía lista TODOS los secrets que debes configurar en GitHub para que el CI/CD funcione correctamente.

## 📍 Dónde configurar los secrets

1. Ve a tu repositorio en GitHub
2. Click en **Settings**
3. En el menú lateral: **Secrets and variables** → **Actions**
4. Click en **New repository secret**

---

## 🔑 Secrets Requeridos

### 1. AWS Credentials (para Lambda/Serverless)

| Secret Name | Valor | Descripción |
|------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | `ASIATCKAMKWLASYJH5DV` | Tu Access Key ID de AWS |
| `AWS_SECRET_ACCESS_KEY` | `1LXGLxDpIBSGbrth5ROg8RhBDm1ugFLmPN0CZlpl` | Tu Secret Access Key de AWS |

**⚠️ IMPORTANTE**: Estos valores son de ejemplo desde tu .env. En producción deberías usar credenciales con permisos limitados (no usar las de tu sesión temporal).

**Cómo obtener credenciales permanentes:**
1. Ve a AWS Console → IAM → Users → Create user
2. Asigna permisos: `AWSLambdaFullAccess`, `AmazonAPIGatewayAdministrator`
3. Genera Access Keys
4. Guarda las credenciales

---

### 2. AWS Cognito Configuration

| Secret Name | Valor | Descripción |
|------------|-------|-------------|
| `USER_POOL_ID` | `us-east-1_d1nLNhiEF` | ID del User Pool de Cognito |
| `USER_POOL_CLIENT_ID` | `6b39m5lqu77hrhi4q94jpe9tku` | ID del Client de Cognito |
| `API_BASE_URL` | `https://m8kqo3lmdg.execute-api.us-east-1.amazonaws.com` | URL de tu API Gateway |

**📝 Estos valores los tienes en tu `.env` actual**

---

### 3. Application Secrets

| Secret Name | Ejemplo de Valor | Descripción |
|------------|------------------|-------------|
| `SESSION_SECRET` | `kj34h5k2j3h4k5j234h5kj23h45kasjdhf87234` | Clave secreta para sesiones (genera una aleatoria) |

**🔐 Generar SESSION_SECRET:**

En PowerShell:
```powershell
# Generar una clave aleatoria de 64 caracteres
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

O en Node.js:
```javascript
require('crypto').randomBytes(64).toString('hex')
```

---

### 4. EC2 Staging Secrets

| Secret Name | Valor de Ejemplo | Descripción |
|------------|------------------|-------------|
| `EC2_SSH_KEY_STAGING` | Ver abajo | Contenido completo de tu archivo `.pem` |
| `EC2_HOST_STAGING` | `3.88.123.45` | IP pública de tu EC2 de staging |
| `EC2_USER` | `ubuntu` | Usuario SSH (normalmente `ubuntu` para Ubuntu) |

**📋 Cómo obtener EC2_SSH_KEY_STAGING:**

En PowerShell:
```powershell
Get-Content "C:\Users\david\.ssh\hospital-key.pem"
```

Copia TODO el contenido, incluyendo:
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAx...
... (todo el contenido) ...
... (muchas líneas) ...
-----END RSA PRIVATE KEY-----
```

**⚠️ CUIDADO**: 
- Copia TODO el contenido, no lo modifiques
- Incluye las líneas BEGIN y END
- No agregues espacios ni saltos de línea extra

---

### 5. EC2 Production Secrets

| Secret Name | Valor de Ejemplo | Descripción |
|------------|------------------|-------------|
| `EC2_SSH_KEY_PRODUCTION` | Ver abajo | Contenido de tu `.pem` (puede ser el mismo o diferente) |
| `EC2_HOST_PRODUCTION` | `54.23.156.78` | IP pública de tu EC2 de producción |

**💡 TIP**: Puedes usar la misma llave SSH para staging y production, o crear llaves separadas para mayor seguridad.

---

## ✅ Checklist de Configuración

Marca los secrets que ya configuraste:

### AWS & Cognito
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `USER_POOL_ID`
- [ ] `USER_POOL_CLIENT_ID`
- [ ] `API_BASE_URL`

### Application
- [ ] `SESSION_SECRET`

### EC2 Staging
- [ ] `EC2_SSH_KEY_STAGING`
- [ ] `EC2_HOST_STAGING`
- [ ] `EC2_USER`

### EC2 Production
- [ ] `EC2_SSH_KEY_PRODUCTION`
- [ ] `EC2_HOST_PRODUCTION`

---

## 🔍 Verificar que los secrets están configurados

1. Ve a: Settings → Secrets and variables → Actions
2. Deberías ver una lista como esta:

```
Repository secrets (11)

AWS_ACCESS_KEY_ID              Updated 1 hour ago
AWS_SECRET_ACCESS_KEY          Updated 1 hour ago
API_BASE_URL                   Updated 1 hour ago
EC2_HOST_PRODUCTION            Updated 1 hour ago
EC2_HOST_STAGING               Updated 1 hour ago
EC2_SSH_KEY_PRODUCTION         Updated 1 hour ago
EC2_SSH_KEY_STAGING            Updated 1 hour ago
EC2_USER                       Updated 1 hour ago
SESSION_SECRET                 Updated 1 hour ago
USER_POOL_CLIENT_ID            Updated 1 hour ago
USER_POOL_ID                   Updated 1 hour ago
```

---

## 🐛 Troubleshooting

### Error: "Secret not found"

**Problema**: El workflow no encuentra un secret.

**Solución**:
1. Verifica que el nombre esté escrito EXACTAMENTE igual (mayúsculas/minúsculas)
2. Asegúrate de que el secret esté en el nivel de **repositorio**, no de environment

### Error: "SSH connection failed"

**Problema**: No puede conectarse a EC2.

**Solución**:
1. Verifica que `EC2_SSH_KEY_STAGING` tenga TODO el contenido del .pem
2. Verifica que `EC2_HOST_STAGING` sea la IP pública correcta
3. Verifica que el Security Group de EC2 permita SSH (puerto 22)

### Error: "AWS credentials not valid"

**Problema**: Las credenciales de AWS no funcionan.

**Solución**:
1. Si usas credenciales temporales (con `aws_session_token`), necesitas credenciales permanentes
2. Crea un IAM User con permisos de Lambda y API Gateway
3. Genera Access Keys permanentes

---

## 🔄 Actualizar Secrets

Si necesitas cambiar algún secret:

1. Ve a Settings → Secrets and variables → Actions
2. Click en el secret que quieres actualizar
3. Click en **Update secret**
4. Pega el nuevo valor
5. Click en **Update secret**

Los workflows usarán el nuevo valor en la próxima ejecución.

---

## 🔐 Buenas Prácticas de Seguridad

1. ✅ **Nunca** hagas commit de archivos `.env` o llaves SSH
2. ✅ **Usa credenciales** diferentes para staging y production
3. ✅ **Rota las credenciales** cada 90 días
4. ✅ **Usa IAM roles** con permisos mínimos necesarios
5. ✅ **Habilita MFA** en tu cuenta de AWS
6. ✅ **Monitorea** el uso de las credenciales con CloudTrail

---

## 📞 Ayuda

Si tienes problemas configurando los secrets:

1. Revisa que copiaste los valores completos (sin espacios extra)
2. Verifica los nombres (son case-sensitive)
3. Prueba la conexión SSH manualmente desde tu computadora
4. Revisa los logs en GitHub Actions para ver el error específico

---

**¡Una vez configurados todos los secrets, tu CI/CD estará listo para funcionar!** 🎉
