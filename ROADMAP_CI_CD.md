# 🗺️ Roadmap Completo CI/CD - Hospital Padre Hurtado

## 📊 Estado Actual (5 de Noviembre, 2025)

### ✅ COMPLETADO (80%)

#### 1. Pipeline CI (Continuous Integration)
- ✅ Configurado en `.github/workflows/ci.yml`
- ✅ Jobs: Lint, Tests, Security Scan, Build
- ✅ ESLint configurado y funcionando (0 errores)
- ✅ Ejecuta en cada push/PR a `main` y `develop`
- ✅ `.eslintignore` creado para archivos frontend
- ⚠️ **Pendiente**: Agregar tests unitarios reales

#### 2. Pipeline CD (Continuous Deployment)
- ✅ Configurado en `.github/workflows/cd.yml`
- ✅ 3 Jobs: Lambda, Staging EC2, Production EC2
- ✅ Adaptado para AWS Academy (session token)
- ✅ Modo manual (workflow_dispatch)
- ⚠️ **Pendiente**: Configurar instancias EC2

#### 3. Seguridad
- ✅ CodeQL configurado (deshabilitado - requiere Advanced Security)
- ✅ Dependabot configurado para actualizaciones automáticas
- ✅ npm audit integrado en CI
- ✅ Variables sensibles en GitHub Secrets (7/11)
- ⚠️ **Pendiente**: 4 secrets de EC2

#### 4. Código
- ✅ Conexión a base de datos usando variables de entorno
- ✅ `.env.example` creado
- ✅ `.gitignore` actualizado
- ✅ `.editorconfig` para consistencia
- ✅ PR template creado
- ⚠️ **Pendiente**: Agregar tests unitarios

#### 5. Documentación
- ✅ README.md completo
- ✅ CICD_README.md con guía CI/CD
- ✅ DEPLOYMENT_GUIDE.md paso a paso
- ✅ GITHUB_SECRETS_SETUP.md
- ✅ AWS_ACADEMY_SETUP.md
- ✅ CONFIGURAR_SECRETS.md
- ✅ RESUMEN_COMPLETO.md

#### 6. GitHub Secrets Configurados
1. ✅ `AWS_ACCESS_KEY_ID`
2. ✅ `AWS_SECRET_ACCESS_KEY`
3. ✅ `AWS_SESSION_TOKEN`
4. ✅ `SESSION_SECRET`
5. ✅ `USER_POOL_ID`
6. ✅ `USER_POOL_CLIENT_ID`
7. ✅ `API_BASE_URL`

---

## 🔴 PENDIENTE (20%)

### Opción A: Despliegue Solo Lambda (RÁPIDO - 30 min)
**Ideal para pruebas rápidas sin infraestructura pesada**

#### Pasos:
1. ✅ Ya tienes todo configurado
2. 🔄 Ejecutar workflow CD manualmente
3. 🔄 Verificar deployment de Lambda
4. 🔄 Probar endpoints API Gateway
5. 🔄 Monitorear logs en CloudWatch

**Ventajas**:
- ⚡ Rápido (sin crear EC2)
- 💰 Económico (serverless)
- 🔧 Fácil de revertir

**Desventajas**:
- ⚠️ Base de datos sigue en localhost
- ⚠️ Frontend no se despliega
- ⚠️ Solo API funcionará

---

### Opción B: Despliegue Completo EC2 (COMPLETO - 2-3 horas)
**Infraestructura completa con staging y producción**

#### 1. Crear Instancias EC2 (45 min)

##### Instancia Staging:
```bash
# En AWS Academy Console
1. EC2 → Launch Instance
2. Name: hospital-staging
3. AMI: Ubuntu Server 22.04 LTS
4. Instance type: t2.micro (Free tier)
5. Key pair: Crear nueva "hospital-staging-key"
   - Guardar archivo .pem
6. Security Group:
   - SSH (22) desde tu IP
   - HTTP (80) desde 0.0.0.0/0
   - HTTPS (443) desde 0.0.0.0/0
   - Custom TCP (3000) desde 0.0.0.0/0
7. Storage: 8 GB gp3
8. Launch Instance
```

##### Instancia Production:
```bash
# Repetir pasos anteriores con:
- Name: hospital-production
- Key pair: "hospital-production-key"
- Mismos security groups
```

#### 2. Configurar Instancias (30 min por instancia)

```bash
# Conectarse vía SSH
ssh -i "hospital-staging-key.pem" ubuntu@<EC2_PUBLIC_IP>

# Ejecutar script de setup (ya creado)
# Copiar el contenido de scripts/setup-ec2.sh
# O subirlo con:
scp -i "hospital-staging-key.pem" scripts/setup-ec2.sh ubuntu@<EC2_PUBLIC_IP>:~

# Ejecutar
chmod +x setup-ec2.sh
sudo ./setup-ec2.sh
```

#### 3. Configurar GitHub Secrets EC2 (10 min)

```bash
# En GitHub: Settings → Secrets and variables → Actions → New repository secret

# Staging
EC2_SSH_KEY_STAGING: <contenido de hospital-staging-key.pem>
EC2_HOST_STAGING: <IP pública de staging>
EC2_USER: ubuntu

# Production
EC2_SSH_KEY_PRODUCTION: <contenido de hospital-production-key.pem>
EC2_HOST_PRODUCTION: <IP pública de production>
```

#### 4. Configurar Base de Datos (30 min)

**Opción 4A: MySQL en EC2** (Más simple)
```bash
# En cada instancia EC2
sudo apt update
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Crear base de datos
sudo mysql
CREATE DATABASE incodefy;
CREATE USER 'appuser'@'localhost' IDENTIFIED BY '<password-seguro>';
GRANT ALL PRIVILEGES ON incodefy.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Importar schema
mysql -u appuser -p incodefy < schema.sql
```

**Opción 4B: RDS MySQL** (Recomendado para producción)
```bash
# En AWS Console
1. RDS → Create database
2. MySQL 8.0
3. Free tier / Dev/Test
4. DB instance: db.t3.micro
5. Username: admin
6. Password: <generar-seguro>
7. VPC: Misma que EC2
8. Security group: Permitir 3306 desde EC2
9. Create database

# Agregar secrets:
DB_HOST: <rds-endpoint>
DB_USER: admin
DB_PASSWORD: <tu-password>
DB_NAME: incodefy
```

#### 5. Configurar Variables de Entorno en EC2 (15 min)

```bash
# En cada instancia EC2
sudo nano /opt/hospital-app/.env

# Agregar:
NODE_ENV=production  # o staging
DB_HOST=localhost  # o RDS endpoint
DB_USER=appuser
DB_PASSWORD=<tu-password>
DB_NAME=incodefy
SESSION_SECRET=<mismo de GitHub Secret>
USER_POOL_ID=<mismo de GitHub Secret>
USER_POOL_CLIENT_ID=<mismo de GitHub Secret>
API_BASE_URL=<mismo de GitHub Secret>
PORT=3000
```

#### 6. Ejecutar Deployment (5 min)

```bash
# En GitHub: Actions → CD Pipeline → Run workflow
# Seleccionar: staging o production
```

#### 7. Configurar NGINX (Opcional - 20 min)

```bash
# En cada instancia EC2
sudo apt install -y nginx

# Configurar reverse proxy
sudo nano /etc/nginx/sites-available/hospital

# Agregar:
server {
    listen 80;
    server_name <tu-dominio-o-ip>;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Activar
sudo ln -s /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📝 MEJORAS ADICIONALES (FUTURO)

### 1. Tests Unitarios (1-2 días)
```bash
# Instalar Jest
cd incodefy
npm install --save-dev jest supertest

# Crear tests/
mkdir tests
# auth.test.js
# db.test.js
# routes.test.js
```

### 2. Monitoreo y Observabilidad (1 día)
- Configurar CloudWatch Logs
- Crear dashboards en CloudWatch
- Alertas por email/SMS
- Métricas de performance

### 3. Backup Automatizado (4 horas)
```bash
# Crear script de backup DB
# Subir a S3
# Configurar cron job
```

### 4. SSL/TLS con Let's Encrypt (2 horas)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

### 5. Ambientes Adicionales (4 horas)
- `develop` branch → Dev environment
- `staging` branch → Staging environment
- `main` branch → Production environment

### 6. Rollback Automático (1 día)
- Health checks después de deployment
- Rollback automático si falla
- Notificaciones en Slack/Discord

### 7. Cache con Redis (4 horas)
```bash
# En EC2 o ElastiCache
sudo apt install redis-server
# Configurar en aplicación
```

### 8. CDN con CloudFront (2 horas)
- Distribuir assets estáticos
- Mejorar performance global
- Reducir carga en EC2

---

## 🎯 RECOMENDACIÓN PARA TU SITUACIÓN

### AWS Academy = Credenciales Temporales (~4 horas)

**Mejor enfoque**: **Opción B Simplificada**

#### Plan Recomendado (2 horas total):

1. **✅ Crear 1 instancia EC2** (solo staging) - 20 min
   - Te permite probar el deployment completo
   - Menor complejidad que 2 instancias

2. **✅ MySQL en la misma EC2** - 15 min
   - Evita costos de RDS
   - Más simple para AWS Academy

3. **✅ Configurar 3 secrets** (solo staging) - 5 min
   ```
   EC2_SSH_KEY_STAGING
   EC2_HOST_STAGING
   EC2_USER
   ```

4. **✅ Modificar workflow CD** - 10 min
   - Comentar job de production
   - Solo desplegar a staging

5. **✅ Ejecutar deployment** - 5 min

6. **✅ Probar aplicación** - 15 min

7. **✅ Documentar IPs/endpoints** - 10 min

**Total invertido hasta ahora**: ~8 horas (configuración inicial)
**Para completar mínimo viable**: +2 horas
**Para completar todo (2 ambientes)**: +3 horas

---

## 📋 CHECKLIST FINAL

### Mínimo Viable (Staging Only)
- [ ] Crear instancia EC2 staging
- [ ] Guardar archivo .pem
- [ ] Ejecutar setup-ec2.sh
- [ ] Instalar y configurar MySQL
- [ ] Importar schema de DB
- [ ] Configurar .env en EC2
- [ ] Agregar 3 secrets a GitHub
- [ ] Comentar job de production en cd.yml
- [ ] Ejecutar workflow CD
- [ ] Verificar aplicación en http://<EC2_IP>:3000
- [ ] Documentar IP y acceso

### Completo (Staging + Production)
- [ ] Todo lo anterior
- [ ] Crear instancia EC2 production
- [ ] Repetir configuración para production
- [ ] Agregar 2 secrets más (production)
- [ ] Descomentar job de production
- [ ] Configurar NGINX en ambas
- [ ] Configurar dominio (opcional)
- [ ] Configurar SSL (opcional)

---

## 🚦 PRÓXIMO PASO INMEDIATO

**Te recomiendo empezar con Opción B Simplificada (staging only)**

### ¿Quieres que te ayude a:

1. **🚀 Crear la instancia EC2 staging** (te guío paso a paso)
2. **⚡ Solo probar Lambda** (5 minutos)
3. **📚 Ver más detalles** de alguna sección específica

**¿Qué prefieres?** 🤔
