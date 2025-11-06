# ✅ Checklist de Configuración CI/CD

## 🔐 Secrets de GitHub (Configurados ✓)

### AWS Credentials
- [x] `AWS_ACCESS_KEY_ID`
- [x] `AWS_SECRET_ACCESS_KEY`  
- [x] `AWS_SESSION_TOKEN`

### Cognito & API
- [x] `USER_POOL_ID`
- [x] `USER_POOL_CLIENT_ID`
- [x] `API_BASE_URL`

### Application
- [x] `SESSION_SECRET`

### EC2 (Opcional para staging/prod)
- [ ] `EC2_HOST_STAGING`
- [ ] `EC2_USER`
- [ ] `EC2_SSH_KEY_STAGING`
- [ ] `EC2_HOST_PRODUCTION`
- [ ] `EC2_SSH_KEY_PRODUCTION`

## 📁 Archivos Creados/Actualizados

### Backend Serverless
- [x] `aws/src/handlers/health.js` - Health check endpoint
- [x] `aws/serverless.yml` - Configuración mejorada
- [x] `aws/package.json` - Scripts actualizados
- [x] `aws/.eslintrc.json` - Configuración de linting

### Workflows de GitHub
- [x] `.github/workflows/ci.yml` - Pipeline de CI
- [x] `.github/workflows/cd.yml` - Pipeline de CD

### Documentación
- [x] `CICD-README.md` - Documentación completa
- [x] `CICD-CHECKLIST.md` - Este checklist
- [x] `scripts/test-pipeline.ps1` - Script de testing local

## 🧪 Tests Pre-Deploy

Antes de hacer push, ejecuta:

```powershell
# Probar pipeline localmente
.\scripts\test-pipeline.ps1
```

O manualmente:

```bash
# 1. Lint
cd aws
npm run lint

# 2. Validar Serverless
serverless print --stage dev

# 3. Verificar sintaxis de handlers
node -c src/handlers/health.js
node -c src/handlers/login.js
# ... etc

# 4. Audit
npm audit --audit-level=high
```

## 🚀 Pasos para Primera Deployment

### 1. Preparar el código
```bash
git checkout -b setup/cicd-pipeline
git add .
git commit -m "feat: setup CI/CD pipeline with GitHub Actions"
git push origin setup/cicd-pipeline
```

### 2. Crear Pull Request
- Ve a GitHub
- Crea PR de `setup/cicd-pipeline` → `main`
- Verifica que pasen todos los checks del CI
- Revisa los logs del workflow

### 3. Merge y Deploy
- Una vez aprobado, haz merge a `main`
- El CD Pipeline se ejecutará automáticamente
- Deploy se hará a entorno `dev` por defecto

### 4. Deploy Manual a otros entornos
- Ve a Actions → CD Pipeline
- Click en "Run workflow"
- Selecciona el entorno (staging/production)
- Click en "Run workflow"

## 🔍 Verificación Post-Deploy

### Backend (Serverless)
```bash
# Obtener URL del API
cd aws
serverless info --stage dev

# Probar health check
curl https://[api-id].execute-api.us-east-1.amazonaws.com/health
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-05T...",
  "stage": "dev",
  "services": {
    "dynamodb": "connected",
    "cognito": "available",
    "lambda": "running"
  }
}
```

### Frontend (EC2) - Solo staging/prod
```bash
curl http://[ec2-ip]:3000/health
```

### CloudWatch Logs
```bash
# Ver logs de una función
serverless logs -f health --stage dev --tail

# O desde AWS Console:
# CloudWatch → Log groups → /aws/lambda/aws-cognito-jwt-login-dev-*
```

## 🐛 Troubleshooting Common Issues

### ❌ CI Pipeline falla en Lint
```bash
# Ejecutar localmente
npm run lint:fix
```

### ❌ CD Pipeline falla en Deploy
- Verificar que los secrets de AWS estén configurados
- Verificar permisos del LabRole en AWS
- Revisar logs del workflow en GitHub Actions

### ❌ Health Check falla después del deploy
- Esperar 30 segundos (cold start de Lambda)
- Verificar logs en CloudWatch
- Verificar configuración de API Gateway

### ❌ DynamoDB tables no se crean
- Verificar que el LabRole tenga permisos de DynamoDB
- Verificar que no existan tablas con el mismo nombre
- Revisar CloudFormation stack en AWS Console

## 📊 Métricas y Monitoreo

### GitHub Actions
- **CI Pipeline**: Debe completarse en < 5 minutos
- **CD Pipeline**: Debe completarse en < 10 minutos

### AWS Lambda
- **Cold Start**: < 3 segundos
- **Warm Response**: < 500ms
- **Error Rate**: < 1%

### Costos Esperados (AWS Academy - Gratis)
- Lambda: Incluido en free tier
- DynamoDB: PAY_PER_REQUEST (bajo costo)
- API Gateway: Primeras 1M requests gratis
- Cognito: Primeros 50,000 usuarios gratis

## 📚 Recursos Adicionales

- [Documentación del Proyecto](./README.md)
- [Configuración de Serverless](./aws/serverless.yml)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Serverless Framework](https://www.serverless.com/framework/docs)

## ✨ Próximos Pasos

- [ ] Configurar notificaciones de Slack/Discord
- [ ] Añadir tests de integración
- [ ] Configurar rollback automático
- [ ] Implementar canary deployments
- [ ] Añadir métricas de performance

---

**Status**: 🟢 Ready to Deploy
**Last Updated**: $(date)
