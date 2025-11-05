# CI/CD Pipeline - Hospital Padre Hurtado

Este proyecto utiliza GitHub Actions para implementar prácticas de CI/CD (Integración Continua y Despliegue Continuo) con deployment automático a AWS EC2.

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐
│   GitHub Repo   │
│   (main branch) │
└────────┬────────┘
         │ git push
         ▼
┌─────────────────────────────────────────┐
│      GitHub Actions (CI/CD)              │
├─────────────────────────────────────────┤
│  1. CI Pipeline (Lint, Test, Build)     │
│  2. Deploy AWS Lambda (Serverless)      │
│  3. Deploy to EC2 Staging               │
│  4. Deploy to EC2 Production (manual)   │
└─────────┬───────────────────────────────┘
          │
          ├──────────────┬──────────────┐
          ▼              ▼              ▼
    ┌─────────┐   ┌──────────┐   ┌──────────┐
    │   AWS   │   │   EC2    │   │   EC2    │
    │ Lambda  │   │ Staging  │   │   Prod   │
    │ API GW  │   │ (Node.js)│   │ (Node.js)│
    └─────────┘   └──────────┘   └──────────┘
```

## 🚀 Pipelines Configurados

### 1. **CI Pipeline** (`.github/workflows/ci.yml`)
Se ejecuta automáticamente en cada push o pull request a las ramas `main` y `develop`.

**Etapas:**
- ✅ **Lint**: Análisis de código con ESLint
- ✅ **Test**: Ejecución de pruebas unitarias
- ✅ **Security**: Escaneo de vulnerabilidades con `npm audit`
- ✅ **Build**: Verificación de compilación
- 📊 **CodeQL**: Análisis de seguridad del código

### 2. **CD Pipeline** (`.github/workflows/cd.yml`)
Se ejecuta cuando se hace push a `main` o manualmente desde GitHub.

**Etapas:**
1. 🚀 **Deploy AWS Lambda**: Despliegue de funciones serverless
2. 🚀 **Deploy to EC2 Staging**: Despliegue automático a ambiente de pruebas
3. 🚀 **Deploy to EC2 Production**: Despliegue a producción (requiere aprobación manual)

## 📋 Requisitos Previos

1. **Instalar dependencias:**
   ```powershell
   # En la carpeta incodefy
   cd incodefy
   npm install

   # En la carpeta aws
   cd ..\aws
   npm install
   ```

2. **Configurar variables de entorno:**
   - Copiar `.env.example` a `.env` en la carpeta `incodefy`
   - Completar los valores necesarios
   - Agregar secrets en GitHub (Settings → Secrets and variables → Actions)

3. **Tener instancias EC2 configuradas:**
   - EC2 para Staging
   - EC2 para Production
   - Ver `DEPLOYMENT_GUIDE.md` para instrucciones detalladas

## 🔧 Comandos Disponibles

### Incodefy (Backend principal)
```bash
npm start          # Iniciar servidor
npm run dev        # Modo desarrollo con nodemon
npm run lint       # Ejecutar linter
npm run lint:fix   # Corregir problemas de lint automáticamente
npm test           # Ejecutar tests
```

### AWS (Serverless)
```bash
npm run dev            # Servidor local con serverless-offline
npm run deploy         # Desplegar a AWS (dev)
npm run deploy:prod    # Desplegar a AWS (producción)
npm run lint           # Ejecutar linter
npm run lint:fix       # Corregir problemas de lint
```

## 🌿 Estrategia de Branches

```
main (producción)
  ↑
develop (staging)
  ↑
feature/* (desarrollo)
```

### Flujo de trabajo recomendado:

1. **Crear rama de feature:**
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

2. **Hacer commits:**
   ```bash
   git add .
   git commit -m "feat: agregar nueva funcionalidad"
   ```

3. **Push y crear Pull Request:**
   ```bash
   git push origin feature/nueva-funcionalidad
   ```
   - Ir a GitHub y crear PR hacia `develop`
   - El CI se ejecutará automáticamente
   - Esperar aprobación de revisores

4. **Merge a develop:**
   - Una vez aprobado, hacer merge
   - Se desplegará automáticamente a Staging

5. **Merge a main:**
   - Cuando esté probado en Staging, crear PR de `develop` → `main`
   - Se desplegará a Producción (con aprobación manual)

## 🔒 Protección de Branches

Se recomienda configurar en GitHub:
1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Activar:
   - ✅ Require pull request before merging
   - ✅ Require status checks to pass (CI)
   - ✅ Require conversation resolution before merging

## 🐛 Solución de Problemas

### El CI falla en lint
```bash
npm run lint:fix
git add .
git commit -m "fix: corregir problemas de lint"
```

### El CI falla en tests
```bash
npm test  # Ver qué está fallando
# Corregir los tests
git add .
git commit -m "test: corregir tests fallidos"
```

### Vulnerabilidades de seguridad
```bash
npm audit
npm audit fix
```

## 📊 Monitoreando el Pipeline

1. Ve a tu repositorio en GitHub
2. Click en la pestaña **Actions**
3. Verás todos los workflows ejecutándose o completados
4. Click en cualquier workflow para ver los detalles y logs

## 🎯 Próximos Pasos

- [x] Agregar ESLint para calidad de código
- [x] Configurar CI Pipeline
- [x] Configurar CD Pipeline para EC2
- [x] Agregar análisis de seguridad (CodeQL)
- [x] Configurar Dependabot
- [ ] Agregar tests unitarios reales
- [ ] Configurar code coverage
- [ ] Agregar integration tests
- [ ] Configurar notificaciones (Slack/Discord)
- [ ] Implementar rollback automático
- [ ] Agregar monitoreo con CloudWatch
- [ ] Configurar dominios personalizados con Route 53
- [ ] Agregar certificados SSL con ACM

---

## 📚 Documentación Adicional

- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**: Guía completa paso a paso para deployment en AWS EC2
- **Scripts de deployment**: Carpeta `scripts/`
  - `setup-ec2.sh`: Configuración inicial del servidor
  - `deploy-to-ec2.sh`: Script de deployment manual
  - `create-env-ec2.sh`: Configurar variables de entorno

---

**Documentación generada para implementar DevOps en el proyecto Hospital Padre Hurtado**
