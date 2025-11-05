# 🎓 Configuración para AWS Academy Learner Lab

Este proyecto está configurado para trabajar con **AWS Academy Learner Lab**, que utiliza credenciales temporales.

## ⚠️ Importante: Credenciales Temporales

AWS Academy Learner Lab proporciona credenciales temporales que:
- ⏰ **Expiran** cada 4 horas aproximadamente
- 🔄 **Se renuevan** cada vez que inicias el laboratorio
- 🔐 Incluyen un **session token** adicional

## 🔐 Secrets Necesarios en GitHub

Configura estos **3 secrets** en GitHub (no 2):

1. `AWS_ACCESS_KEY_ID` - Empieza con `ASIA...`
2. `AWS_SECRET_ACCESS_KEY` - Tu secret key
3. `AWS_SESSION_TOKEN` - Token largo que empieza con `IQoJ...`

### Cómo obtener las credenciales:

1. Inicia tu **AWS Academy Learner Lab**
2. Haz clic en **"AWS Details"** (arriba a la derecha)
3. Haz clic en **"Show"** junto a "AWS CLI:"
4. Copia los 3 valores:
   ```ini
   [default]
   aws_access_key_id=ASIA...
   aws_secret_access_key=...
   aws_session_token=IQoJ...
   ```

## 📝 Configurar Secrets en GitHub

### Método 1: Interfaz Web

1. Ve a: `https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/settings/secrets/actions`
2. Para cada secret:
   - Clic en **"New repository secret"**
   - Name: El nombre del secret
   - Secret: El valor correspondiente
   - Clic en **"Add secret"**

### Método 2: GitHub CLI (Más rápido)

```powershell
# Instalar GitHub CLI si no lo tienes
# https://cli.github.com/

# Autenticarse
gh auth login

# Actualizar secrets (reemplaza con tus valores reales)
gh secret set AWS_ACCESS_KEY_ID --body "ASIA..." --repo felivazpro/Proyecto-Hospital-Padre-Hurtado
gh secret set AWS_SECRET_ACCESS_KEY --body "tu-secret-key" --repo felivazpro/Proyecto-Hospital-Padre-Hurtado
gh secret set AWS_SESSION_TOKEN --body "IQoJ..." --repo felivazpro/Proyecto-Hospital-Padre-Hurtado
```

## 🚀 Cómo Hacer Deployment

Como las credenciales son temporales, el CD está configurado para **ejecución MANUAL**:

### Proceso de Deployment:

1. **Iniciar el Learner Lab**
   - Ve a tu curso en AWS Academy
   - Inicia el laboratorio

2. **Actualizar las credenciales en GitHub**
   - Obtén las nuevas credenciales (AWS Details → Show)
   - Actualiza los 3 secrets en GitHub

3. **Ejecutar el workflow manualmente**
   - Ve a: `https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/actions`
   - Selecciona **"CD Pipeline - Deploy to AWS EC2"**
   - Clic en **"Run workflow"**
   - Selecciona branch `main`
   - Clic en **"Run workflow"**

4. **Monitorear el progreso**
   - Verás el workflow ejecutándose en tiempo real
   - Haz clic en el workflow para ver los logs

## 🔄 Workflow Típico de Desarrollo

```powershell
# 1. Hacer cambios en el código
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main

# 2. Iniciar AWS Learner Lab

# 3. Actualizar secrets en GitHub (manualmente o con script)

# 4. Ejecutar workflow desde GitHub Actions (manualmente)

# 5. Verificar deployment
```

## ⏰ Renovación de Credenciales

### ¿Cuándo actualizar?

Actualiza los secrets cada vez que:
- ✅ Inicies una nueva sesión del Learner Lab
- ✅ Las credenciales expiren (verás errores de autenticación)
- ✅ El deployment falle con error "ExpiredToken"

### Script de Actualización Rápida

Guarda este script como `scripts/update-aws-secrets.ps1`:

```powershell
# Script para actualizar secrets de AWS Academy
param(
    [Parameter(Mandatory=$true)]
    [string]$AccessKeyId,
    
    [Parameter(Mandatory=$true)]
    [string]$SecretAccessKey,
    
    [Parameter(Mandatory=$true)]
    [string]$SessionToken
)

$repo = "felivazpro/Proyecto-Hospital-Padre-Hurtado"

Write-Host "🔄 Actualizando secrets de AWS..."

gh secret set AWS_ACCESS_KEY_ID --body $AccessKeyId --repo $repo
gh secret set AWS_SECRET_ACCESS_KEY --body $SecretAccessKey --repo $repo
gh secret set AWS_SESSION_TOKEN --body $SessionToken --repo $repo

Write-Host "✅ Secrets actualizados correctamente!"
Write-Host "🚀 Ahora puedes ejecutar el workflow desde GitHub Actions"
```

**Uso:**
```powershell
.\scripts\update-aws-secrets.ps1 `
  -AccessKeyId "ASIA..." `
  -SecretAccessKey "..." `
  -SessionToken "IQoJ..."
```

## 🆘 Solución de Problemas

### Error: "ExpiredToken"

**Causa**: Las credenciales expiraron.

**Solución**:
1. Reinicia el Learner Lab
2. Obtén nuevas credenciales
3. Actualiza los secrets en GitHub
4. Reintenta el deployment

### Error: "Access Denied"

**Causa**: El session token no está configurado.

**Solución**:
1. Verifica que el secret `AWS_SESSION_TOKEN` existe en GitHub
2. Asegúrate de copiar el token completo (es muy largo)
3. Verifica que no haya espacios al inicio/final

### Error: "Invalid credentials"

**Causa**: Credenciales incorrectas o mal copiadas.

**Solución**:
1. Verifica que copiaste los 3 valores correctamente
2. Asegúrate de no incluir `[default]` ni los nombres de las variables
3. Solo copia los valores después del `=`

## 📊 Limitaciones de AWS Academy

| Característica | AWS Academy | Cuenta AWS Real |
|----------------|-------------|-----------------|
| Credenciales | ⏰ Temporales (4h) | ✅ Permanentes |
| CI/CD Automático | ❌ No recomendado | ✅ Totalmente funcional |
| Crear usuarios IAM | ❌ Restringido | ✅ Sin restricciones |
| Servicios disponibles | ⚠️ Limitados | ✅ Todos |
| Uso recomendado | 🎓 Aprendizaje | 🏢 Producción |

## 💡 Recomendación

Para un proyecto de **producción real**, considera:
1. Crear una cuenta AWS gratuita (12 meses free tier)
2. Configurar credenciales permanentes
3. Habilitar CI/CD automático en push a `main`

Para **desarrollo y aprendizaje**, AWS Academy es perfecto con el modo manual.

---

**Documentación actualizada para AWS Academy Learner Lab - Hospital Padre Hurtado**
