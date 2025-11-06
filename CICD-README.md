# CI/CD Pipeline - Hospital Padre Hurtado

## 📋 Descripción

Este proyecto implementa un pipeline completo de CI/CD usando GitHub Actions para:
- **Backend Serverless**: AWS Lambda + API Gateway + DynamoDB + Cognito
- **Frontend**: Node.js Express en EC2

## 🏗️ Arquitectura

```
┌─────────────┐
│   GitHub    │
│  Repository │
└──────┬──────┘
       │
       ├─── Push/PR ───▶ CI Pipeline (Tests, Lint, Validate)
       │
       └─── Merge to main ───▶ CD Pipeline
                                │
                                ├─▶ Deploy Serverless (Lambda + API Gateway)
                                └─▶ Deploy Frontend (EC2)
```

## 🚀 Workflows Configurados

### 1. CI Pipeline (`ci.yml`)
**Triggers**: Push o Pull Request a `main` o `develop`

**Jobs**:
- ✅ **Lint**: ESLint en ambos proyectos
- ✅ **Test**: Ejecuta tests unitarios
- ✅ **Security**: npm audit
- ✅ **Validate Serverless**: Valida configuración serverless.yml
- ✅ **Build**: Compila y empaqueta

### 2. CD Pipeline (`cd.yml`)
**Triggers**: 
- Push a `main` (automático)
- Manual dispatch (elegir entorno)

**Jobs**:
- 🚀 **Deploy Serverless**: Despliega Lambda functions, API Gateway, DynamoDB, Cognito
- 🌐 **Deploy Frontend**: Despliega aplicación Express a EC2 (solo staging/prod)
- ✅ **Health Check**: Verifica que los servicios estén funcionando

## 🔐 Secrets Requeridos en GitHub

### AWS Credentials
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN (para AWS Academy)
```

### Cognito & API
```
USER_POOL_ID
USER_POOL_CLIENT_ID
API_BASE_URL
```

### EC2 Deployment
```
EC2_HOST_STAGING
EC2_USER
EC2_SSH_KEY_STAGING
EC2_HOST_PRODUCTION
EC2_SSH_KEY_PRODUCTION
```

### Application
```
SESSION_SECRET
```

## 📦 Estructura del Proyecto

```
Proyecto-Hospital-Padre-Hurtado/
├── .github/
│   └── workflows/
│       ├── ci.yml          # Pipeline de integración continua
│       ├── cd.yml          # Pipeline de despliegue continuo
│       └── codeql.yml      # Análisis de seguridad del código
├── aws/                    # Backend Serverless
│   ├── src/handlers/       # Lambda functions
│   ├── serverless.yml      # Configuración de infraestructura
│   └── package.json
└── incodefy/               # Frontend Express
    ├── routes/
    ├── views/
    ├── server.js
    └── package.json
```

## 🔧 Comandos Útiles

### Desarrollo Local

```bash
# Backend Serverless
cd aws
npm install
npm run dev              # Serverless offline
npm run validate         # Validar configuración
npm run lint             # Linting

# Frontend
cd incodefy
npm install
npm start                # Servidor Express local
```

### Deployment Manual

```bash
# Deploy backend a diferentes entornos
cd aws
npm run deploy:dev       # Desarrollo
npm run deploy:staging   # Staging
npm run deploy:prod      # Producción

# Ver información del stack
npm run info:dev
npm run info:prod

# Ver logs en tiempo real
npm run logs -- -f login
```

## 🌍 Entornos

### Development (dev)
- **Backend**: AWS Lambda (stage: dev)
- **Frontend**: No desplegado automáticamente
- **Base de datos**: DynamoDB (tablas con prefijo -dev)

### Staging
- **Backend**: AWS Lambda (stage: staging)
- **Frontend**: EC2 Staging
- **Base de datos**: DynamoDB (tablas con prefijo -staging)

### Production (prod)
- **Backend**: AWS Lambda (stage: prod)
- **Frontend**: EC2 Production
- **Base de datos**: DynamoDB (tablas con prefijo -prod)

## 📊 Monitoreo

### CloudWatch Logs
```bash
# Ver logs de una función específica
serverless logs -f login --stage prod --tail

# Ver logs de todas las funciones
aws logs tail /aws/lambda/aws-cognito-jwt-login-prod-login --follow
```

### Health Check Endpoints
```bash
# Verificar estado del API
curl https://[api-id].execute-api.us-east-1.amazonaws.com/health

# Verificar Frontend
curl http://[ec2-ip]:3000/health
```

## 🔄 Flujo de Trabajo Recomendado

1. **Crear rama de feature**
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

2. **Desarrollar y hacer commits**
   ```bash
   git add .
   git commit -m "feat: descripción del cambio"
   ```

3. **Push y crear Pull Request**
   ```bash
   git push origin feature/nueva-funcionalidad
   ```
   - ✅ Se ejecuta automáticamente el **CI Pipeline**
   - Se valida lint, tests, y build

4. **Merge a main**
   - Una vez aprobado el PR, hacer merge
   - ✅ Se ejecuta automáticamente el **CD Pipeline**
   - Se despliega a desarrollo/staging/producción

5. **Verificar deployment**
   - Revisar logs en GitHub Actions
   - Probar health check endpoints
   - Verificar CloudWatch Logs

## 🐛 Troubleshooting

### Error: AWS credentials not found
```bash
# Verificar que los secrets estén configurados en GitHub
# Settings → Secrets and variables → Actions
```

### Error: Serverless deployment failed
```bash
# Verificar permisos del role de AWS
# El role debe tener permisos para:
# - Lambda
# - API Gateway
# - DynamoDB
# - Cognito
# - CloudWatch Logs
```

### Error: EC2 deployment failed
```bash
# Verificar que la SSH key esté correctamente configurada
# Verificar que PM2 esté instalado en el EC2
ssh ec2-user@[ip] "pm2 list"
```

## 📚 Recursos

- [Serverless Framework Documentation](https://www.serverless.com/framework/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)

## 👥 Equipo

- **DevOps**: Configuración de CI/CD y deployment
- **Backend**: AWS Lambda + DynamoDB
- **Frontend**: Express.js en EC2

---

**Last Updated**: $(date)
**Version**: 1.0.0
