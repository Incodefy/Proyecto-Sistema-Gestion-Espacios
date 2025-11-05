# 🎯 Guía Rápida: Configurar Secrets para AWS Academy

## 📋 Checklist de Secrets Necesarios

```
Secrets MÍNIMOS para que funcione el CD:

□ AWS_ACCESS_KEY_ID       (empieza con ASIA)
□ AWS_SECRET_ACCESS_KEY   (tu secret key)
□ AWS_SESSION_TOKEN       (empieza con IQoJ - MUY LARGO)
□ SESSION_SECRET          (genera con PowerShell)
□ USER_POOL_ID           (us-east-1_d1nLNhiEF)
□ USER_POOL_CLIENT_ID    (de AWS Cognito)
□ API_BASE_URL           (tu API Gateway)
```

---

## 🚀 PASO 1: Obtener Credenciales de AWS Academy

1. Ve a tu **AWS Academy Course**
2. Inicia el **Learner Lab**
3. Una vez iniciado, haz clic en **"AWS Details"** (arriba a la derecha)
4. Haz clic en **"Show"** junto a "AWS CLI:"

Verás algo como:

```ini
[default]
aws_access_key_id=ASIATCKAMKWLGU4BILAN
aws_secret_access_key=OjnVt7i1jQzM03HFMwORtjrfEVk90h/K8AWI9ATg
aws_session_token=IQoJb3JpZ2luX2VjEDwaCXVzLXdlc3QtMiJIMEYCIQ...
```

**COPIA LOS 3 VALORES** (solo el contenido después del `=`)

---

## 🔐 PASO 2: Configurar Secrets en GitHub

### Ir a la configuración:

**Opción A - URL Directa:**
```
https://github.com/Incodefy/Proyecto-Hospital-Padre-Hurtado/settings/secrets/actions
```
*(Nota: El repo se movió a Incodefy, usa la nueva URL)*

**Opción B - Navegación:**
1. Ve a tu repositorio
2. Click en **Settings** (arriba)
3. En el menú lateral: **Secrets and variables** → **Actions**

### Agregar cada secret:

Para CADA secret:
1. Click en **"New repository secret"**
2. Ingresa el **Name** (nombre exacto)
3. Pega el **Secret** (valor)
4. Click en **"Add secret"**

---

## 📝 PASO 3: Lista de Secrets a Crear

### Secret 1: AWS_ACCESS_KEY_ID
```
Name: AWS_ACCESS_KEY_ID
Secret: ASIATCKAMKWLGU4BILAN
```
*(Usa tu valor real del Learner Lab)*

### Secret 2: AWS_SECRET_ACCESS_KEY
```
Name: AWS_SECRET_ACCESS_KEY
Secret: OjnVt7i1jQzM03HFMwORtjrfEVk90h/K8AWI9ATg
```
*(Usa tu valor real)*

### Secret 3: AWS_SESSION_TOKEN ⚠️ IMPORTANTE
```
Name: AWS_SESSION_TOKEN
Secret: IQoJb3JpZ2luX2VjEDwaCXVzLXdlc3QtMiJIMEYCIQ...
```
**ATENCIÓN**: Este token es MUY LARGO (más de 1000 caracteres). Cópialo COMPLETO.

### Secret 4: SESSION_SECRET

Genera uno nuevo con PowerShell:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

```
Name: SESSION_SECRET
Secret: (el resultado del comando anterior)
```

### Secret 5: USER_POOL_ID
```
Name: USER_POOL_ID
Secret: us-east-1_d1nLNhiEF
```

### Secret 6: USER_POOL_CLIENT_ID

Obtenlo de AWS Cognito:
1. AWS Console → Cognito → User Pools
2. Click en `us-east-1_d1nLNhiEF`
3. Tab **"App integration"**
4. Sección **"App clients"**
5. Copia el **Client ID**

```
Name: USER_POOL_CLIENT_ID
Secret: (tu client ID de Cognito)
```

### Secret 7: API_BASE_URL
```
Name: API_BASE_URL
Secret: https://m8kqo3lmdg.execute-api.us-east-1.amazonaws.com
```

---

## ✅ PASO 4: Verificar que todos están configurados

Deberías ver esta lista en GitHub Secrets:

```
Repository secrets (7)

API_BASE_URL               ✅
AWS_ACCESS_KEY_ID          ✅
AWS_SECRET_ACCESS_KEY      ✅
AWS_SESSION_TOKEN          ✅
SESSION_SECRET             ✅
USER_POOL_CLIENT_ID        ✅
USER_POOL_ID               ✅
```

---

## 🚀 PASO 5: Ejecutar el Deployment

1. Ve a: https://github.com/Incodefy/Proyecto-Hospital-Padre-Hurtado/actions

2. Click en **"CD Pipeline - Deploy to AWS EC2"** (en el menú lateral)

3. Click en **"Run workflow"** (botón verde)

4. Selecciona branch: **main**

5. Click en **"Run workflow"** (confirmar)

6. Verás el workflow ejecutándose en tiempo real

---

## 🔄 Renovar Credenciales (Cada 4 horas)

Cada vez que las credenciales expiren o inicies una nueva sesión:

### Método Manual:
1. Obtén nuevas credenciales del Learner Lab
2. Ve a GitHub Secrets
3. Para cada secret de AWS, click en **"Update"**
4. Pega el nuevo valor
5. Click en **"Update secret"**

### Método Automático (Con GitHub CLI):
```powershell
# Si tienes gh CLI instalado
.\scripts\update-aws-secrets.ps1 `
  -AccessKeyId "ASIA..." `
  -SecretAccessKey "..." `
  -SessionToken "IQoJ..."
```

---

## 🆘 Errores Comunes

### "Secret not found"
**Solución**: Verifica que el nombre esté escrito EXACTAMENTE igual (mayúsculas/minúsculas)

### "ExpiredToken"
**Solución**: Las credenciales expiraron. Obtén nuevas del Learner Lab y actualiza los secrets.

### "Access Denied"
**Solución**: Falta el `AWS_SESSION_TOKEN`. Asegúrate de agregarlo.

### "Invalid credentials"
**Solución**: Verifica que copiaste los valores COMPLETOS, sin espacios al inicio/final.

---

## 📞 Próximos Pasos

Una vez configurados todos los secrets:

1. ✅ Los workflows podrán ejecutarse correctamente
2. ✅ Podrás deployar manualmente desde GitHub Actions
3. ✅ Lambda y Serverless se desplegarán automáticamente

**Para deployment a EC2**: Necesitarás también configurar las instancias EC2 y sus secrets (EC2_HOST_*, EC2_SSH_KEY_*, EC2_USER). Ver `DEPLOYMENT_GUIDE.md` para más detalles.

---

**¡Empieza configurando estos 7 secrets y luego prueba el workflow!** 🎉
