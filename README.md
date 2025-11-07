# 🏥 Hospital Padre Hurtado - Sistema de Gestión

Sistema integral de gestión hospitalaria desarrollado con Node.js, Express, AWS Cognito y arquitectura serverless.

## 🚀 Estado del Proyecto

![CI Pipeline](https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/workflows/CI%20Pipeline/badge.svg)
![CD Pipeline](https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/workflows/CD%20Pipeline%20-%20Deploy%20to%20AWS%20EC2/badge.svg)
![CodeQL](https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/workflows/CodeQL%20Security%20Scan/badge.svg)

## 📋 Características

- ✅ Autenticación con AWS Cognito
- ✅ Sistema de permisos y roles
- ✅ Gestión de consultas médicas
- ✅ Calendario de citas
- ✅ Sistema de notificaciones
- ✅ Personalización de interfaz
- ✅ Internacionalización (i18n) - Español/Inglés
- ✅ Dashboard interactivo
- ✅ Arquitectura serverless con AWS Lambda

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│          Node.js + Express + EJS                 │
│              (Puerto 3000)                       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│              AWS Cognito                         │
│          (Autenticación JWT)                     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│         AWS Lambda + API Gateway                 │
│     (Funciones Serverless - Node.js 20)         │
│  - Login/Refresh/Me                              │
│  - Permisos y Roles                              │
│  - Personalización                               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│            DynamoDB + MySQL                      │
│    (Configuración + Datos relacionales)         │
└─────────────────────────────────────────────────┘
```

## 📁 Estructura del Proyecto

```
Proyecto-Hospital-Padre-Hurtado/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # Pipeline de CI
│   │   ├── cd.yml                 # Pipeline de CD
│   │   └── codeql.yml             # Análisis de seguridad
│   ├── dependabot.yml             # Actualizaciones automáticas
│   └── pull_request_template.md
├── incodefy/                      # Aplicación Node.js principal
│   ├── middleware/
│   ├── public/
│   ├── routes/
│   ├── views/
│   ├── db.js
│   ├── server.js
│   └── package.json
├── aws/                           # Funciones Serverless
│   ├── src/handlers/
│   ├── serverless.yml
│   └── package.json
├── scripts/                       # Scripts de deployment
│   ├── setup-ec2.sh
│   ├── deploy-to-ec2.sh
│   └── create-env-ec2.sh
├── CICD_README.md                 # Documentación CI/CD
├── DEPLOYMENT_GUIDE.md            # Guía de deployment
└── README.md
```

## 🛠️ Tecnologías

### Frontend & Backend
- **Node.js** 18.x
- **Express** 5.x
- **EJS** (Template Engine)
- **i18next** (Internacionalización)
- **MySQL2** (Base de datos)

### AWS Services
- **Cognito** (Autenticación)
- **Lambda** (Funciones serverless)
- **API Gateway** (HTTP API)
- **DynamoDB** (Parámetros y configuración)
- **SQS** (Colas de mensajes)
- **EC2** (Hosting de la aplicación)

### DevOps
- **GitHub Actions** (CI/CD)
- **ESLint** (Calidad de código)
- **PM2** (Process Manager)
- **NGINX** (Reverse Proxy)

## 🚀 Inicio Rápido

### Pre-requisitos

- Node.js 18.x o superior
- MySQL 8.x
- AWS Account
- Git

### Instalación Local

```powershell
# Clonar el repositorio
git clone https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado.git
cd Proyecto-Hospital-Padre-Hurtado

# Instalar dependencias (incodefy)
cd incodefy
npm install

# Configurar variables de entorno
copy .env.example .env
# Editar .env con tus valores

# Iniciar servidor de desarrollo
npm run dev

# En otra terminal - Instalar dependencias (aws)
cd ..\aws
npm install

# Probar funciones serverless localmente
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 🔧 Configuración

### Variables de Entorno

Crea un archivo `.env` en la carpeta `incodefy/` con:

```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=tu-clave-secreta-super-segura

# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu-password
DB_NAME=incodefy

# AWS Cognito
AWS_REGION=us-east-1
USER_POOL_ID=us-east-1_XXXXXXXXX
USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
aws_access_key_id=YOUR_ACCESS_KEY_ID
aws_secret_access_key=YOUR_SECRET_ACCESS_KEY

# API Backend
API_BASE_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```

## 📦 Scripts Disponibles

### Incodefy (Aplicación principal)

```powershell
npm start          # Iniciar servidor
npm run dev        # Modo desarrollo con nodemon
npm run lint       # Ejecutar linter
npm run lint:fix   # Corregir problemas de lint automáticamente
npm test           # Ejecutar tests
```

### AWS (Serverless)

```powershell
npm run dev            # Servidor local con serverless-offline
npm run deploy         # Desplegar a AWS (dev)
npm run deploy:prod    # Desplegar a AWS (producción)
npm run lint           # Ejecutar linter
npm run lint:fix       # Corregir problemas de lint
```

## 🔄 CI/CD

Este proyecto utiliza GitHub Actions para CI/CD automático:

- **CI**: Se ejecuta en cada push/PR
  - Lint del código
  - Ejecución de tests
  - Análisis de seguridad
  - Build verification

- **CD**: Se ejecuta en push a `main`
  - Deploy de funciones Lambda
  - Deploy a EC2 Staging (automático)
  - Deploy a EC2 Production (manual con aprobación)

Ver [CICD_README.md](./CICD_README.md) para más detalles.

## 🚢 Deployment

Para instrucciones detalladas de deployment en AWS EC2, consulta [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Resumen rápido:

1. Crear instancias EC2 (Staging y Production)
2. Ejecutar `scripts/setup-ec2.sh` en cada EC2
3. Configurar secrets en GitHub
4. Push a `main` para deployar automáticamente

## 🧪 Testing

```powershell
# Ejecutar todos los tests
npm test

# Ejecutar tests con coverage
npm run test:coverage

# Ejecutar tests en modo watch
npm run test:watch
```

## 📊 Monitoreo

### Ver logs en producción:

```bash
# Conectarse a EC2
ssh -i ~/.ssh/hospital-key.pem ubuntu@TU_IP_EC2

# Ver logs de la aplicación
pm2 logs hospital-production

# Ver estado
pm2 status

# Monitorear recursos
pm2 monit
```
## ☁️ Integración con Terraform e Ingeniería del Caos

El sistema del **Hospital Padre Hurtado** ahora incluye una capa de **infraestructura como código (IaC)** implementada con **Terraform**, la cual automatiza el despliegue de los servicios serverless en AWS.

### 📦 Componentes gestionados por Terraform
- **AWS Lambda — Chaos Engine:** función que simula errores, latencias y fallas de servicios para pruebas de resiliencia.  
- **API Gateway:** expone los endpoints `/chaos` y `/chaos-latency` para los experimentos.  
- **DynamoDB:** tablas de parámetros y roles creadas automáticamente.  
- **CloudWatch:** monitoreo de logs y alarmas básicas.  

### 🧪 Experimentos de Ingeniería del Caos
Los experimentos implementados permiten evaluar la tolerancia a fallas del backend:

| Experimento | Endpoint | Descripción |
|--------------|-----------|--------------|
| **1️⃣ Error interno aleatorio** | `/chaos?type=failure` | Simula fallas internas en funciones Lambda. |
| **2️⃣ Falla de DynamoDB** | `/chaos?type=dynamodb` | Simula pérdida de conexión con DynamoDB. |
| **3️⃣ Monitoreo de salud** | `/health` | Evalúa el uptime del sistema mediante un script de sondeo continuo. |
| **4️⃣ Latencia aleatoria** | `/chaos-latency` | Introduce retardos controlados para medir la degradación del servicio. |

📂 Los archivos Terraform se encuentran en la carpeta [`/terraform`](./terraform/README.md).  
📂 El artefacto del Chaos Engine (`engine.zip`) se ubica en `aws/src/handlers/chaos/`.


## 🔐 Seguridad

- ✅ Autenticación JWT con AWS Cognito
- ✅ Sistema de roles y permisos granular
- ✅ Variables de entorno para secrets
- ✅ Análisis de seguridad con CodeQL
- ✅ Escaneo de vulnerabilidades con `npm audit`
- ✅ Dependabot para actualizaciones automáticas

## 🌍 Internacionalización

Soporta múltiples idiomas:
- 🇪🇸 Español
- 🇬🇧 Inglés

Agregar nuevos idiomas en `incodefy/locales/`

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'feat: agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

Ver convenciones de commits: [Conventional Commits](https://www.conventionalcommits.org/)

## 📝 Licencia

Este proyecto es privado y propiedad del Hospital Padre Hurtado.

## 👥 Equipo

- **Desarrollador**: [felivazpro](https://github.com/felivazpro)

## 📞 Soporte

Para reportar bugs o solicitar features, abre un [Issue](https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/issues)

---

**Hospital Padre Hurtado © 2024-2025**
