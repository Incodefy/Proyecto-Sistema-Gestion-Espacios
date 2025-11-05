# 🚀 Guía Completa de Deployment en AWS EC2

Esta guía te llevará paso a paso para desplegar el proyecto **Hospital Padre Hurtado** en AWS EC2 con CI/CD automático.

---

## 📋 Pre-requisitos

- Cuenta de AWS con acceso a EC2
- Llave SSH (.pem) de AWS
- Conocimientos básicos de terminal
- Repositorio en GitHub

---

## 🎯 Paso 1: Crear Instancias EC2

### 1.1 Crear EC2 para Staging

1. Ve a **AWS Console → EC2 → Launch Instance**
2. **Nombre**: `hospital-staging`
3. **AMI**: Ubuntu Server 22.04 LTS
4. **Instance Type**: `t2.micro` (o `t3.micro` si prefieres)
5. **Key pair**: Crea o selecciona una (guárdala como `hospital-key.pem`)
6. **Network Settings**:
   - Allow SSH (22) - Tu IP
   - Allow HTTP (80) - 0.0.0.0/0
   - Allow HTTPS (443) - 0.0.0.0/0
   - Allow Custom TCP (3000) - 0.0.0.0/0
7. **Storage**: 20 GB gp3
8. Click **Launch instance**

### 1.2 Crear EC2 para Production

Repite el proceso anterior pero con nombre `hospital-production`

### 1.3 Anotar las IPs

Una vez creadas, anota:
- **IP Pública Staging**: `3.88.123.45` (ejemplo)
- **IP Pública Production**: `54.23.156.78` (ejemplo)

---

## 🔑 Paso 2: Configurar SSH en tu computadora

### En Windows (PowerShell):

```powershell
# Mover la llave a un lugar seguro
Move-Item -Path "C:\Users\david\Downloads\hospital-key.pem" -Destination "C:\Users\david\.ssh\"

# Dar permisos (solo lectura para ti)
icacls "C:\Users\david\.ssh\hospital-key.pem" /inheritance:r
icacls "C:\Users\david\.ssh\hospital-key.pem" /grant:r "$env:USERNAME:(R)"
```

### Conectarse por SSH:

```powershell
ssh -i "C:\Users\david\.ssh\hospital-key.pem" ubuntu@3.88.123.45
```

---

## ⚙️ Paso 3: Configurar el Servidor EC2

### 3.1 Conectarse al servidor

```bash
ssh -i ~/.ssh/hospital-key.pem ubuntu@TU_IP_EC2
```

### 3.2 Ejecutar el script de setup

```bash
# Descargar el script (desde tu repo)
wget https://raw.githubusercontent.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/main/scripts/setup-ec2.sh

# Dar permisos de ejecución
chmod +x setup-ec2.sh

# Ejecutar
./setup-ec2.sh
```

Este script instalará:
- ✅ Node.js 18
- ✅ PM2 (Process Manager)
- ✅ MySQL Client
- ✅ NGINX (Reverse Proxy)
- ✅ Git

### 3.3 Configurar variables de entorno

```bash
# Ejecutar el script interactivo
wget https://raw.githubusercontent.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/main/scripts/create-env-ec2.sh
chmod +x create-env-ec2.sh
./create-env-ec2.sh
```

Te pedirá ingresar:
- `SESSION_SECRET`: Una cadena aleatoria larga (ej: `kj34h5k2j3h4k5j234h5kj23h45`)
- `USER_POOL_ID`: `us-east-1_d1nLNhiEF` (de tu archivo .env)
- `USER_POOL_CLIENT_ID`: `6b39m5lqu77hrhi4q94jpe9tku`
- `API_BASE_URL`: `https://m8kqo3lmdg.execute-api.us-east-1.amazonaws.com`
- Datos de MySQL (si usas RDS o MySQL local)

---

## 🗄️ Paso 4: Configurar Base de Datos

### Opción A: MySQL en la misma EC2 (No recomendado para producción)

```bash
# Instalar MySQL Server
sudo apt install -y mysql-server

# Configurar MySQL
sudo mysql_secure_installation

# Crear base de datos y usuario
sudo mysql
```

```sql
CREATE DATABASE incodefy;
CREATE USER 'hospital_user'@'localhost' IDENTIFIED BY 'TU_PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON incodefy.* TO 'hospital_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Opción B: AWS RDS (Recomendado) ✅

1. Ve a **AWS Console → RDS → Create database**
2. **Engine**: MySQL 8.0
3. **Template**: Free tier (para testing) o Production
4. **DB Instance Identifier**: `hospital-db`
5. **Master username**: `admin`
6. **Master password**: Genera uno seguro
7. **DB Instance class**: `db.t3.micro` (free tier)
8. **Storage**: 20 GB
9. **Connectivity**:
   - **VPC**: Mismo que tu EC2
   - **Public access**: No (más seguro)
   - **Security group**: Permitir MySQL (3306) desde el security group de EC2
10. Click **Create database**

Anota el **Endpoint** (ej: `hospital-db.xxxxxxxxx.us-east-1.rds.amazonaws.com`)

Actualiza el `.env` en EC2:
```bash
DB_HOST=hospital-db.xxxxxxxxx.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=tu_password_rds
DB_NAME=incodefy
```

---

## 🔐 Paso 5: Configurar Secrets en GitHub

Ve a tu repositorio: **Settings → Secrets and variables → Actions → New repository secret**

Agrega estos secrets:

### Secrets para AWS Lambda:
```
AWS_ACCESS_KEY_ID = ASIATCKAMKWLASYJH5DV
AWS_SECRET_ACCESS_KEY = 1LXGLxDpIBSGbrth5ROg8RhBDm1ugFLmPN0CZlpl
```

### Secrets para EC2 Staging:
```
EC2_SSH_KEY_STAGING = (contenido de tu hospital-key.pem)
EC2_HOST_STAGING = 3.88.123.45 (tu IP de staging)
EC2_USER = ubuntu
```

### Secrets para EC2 Production:
```
EC2_SSH_KEY_PRODUCTION = (contenido de tu hospital-key.pem)
EC2_HOST_PRODUCTION = 54.23.156.78 (tu IP de production)
```

### Secrets compartidos:
```
SESSION_SECRET = tu-clave-secreta-super-segura
USER_POOL_ID = us-east-1_d1nLNhiEF
USER_POOL_CLIENT_ID = 6b39m5lqu77hrhi4q94jpe9tku
API_BASE_URL = https://m8kqo3lmdg.execute-api.us-east-1.amazonaws.com
```

### Cómo obtener el contenido de la llave SSH:

**En Windows (PowerShell):**
```powershell
Get-Content "C:\Users\david\.ssh\hospital-key.pem"
```

Copia TODO el contenido incluyendo:
```
-----BEGIN RSA PRIVATE KEY-----
... todo el contenido ...
-----END RSA PRIVATE KEY-----
```

---

## 🎮 Paso 6: Configurar Environments en GitHub

1. Ve a **Settings → Environments**
2. Click **New environment**

### Crear "staging":
- Nombre: `staging`
- No agregar protection rules (por ahora)
- Click **Configure environment**

### Crear "production":
- Nombre: `production`
- ✅ **Required reviewers**: Agrega tu usuario (aprobación manual)
- ✅ **Wait timer**: 0 minutos
- Click **Configure environment**

---

## 🚀 Paso 7: Probar el Deployment

### 7.1 Hacer un cambio en el código

```bash
cd c:\Users\david\OneDrive\Escritorio\GitHub\Proyecto-Hospital-Padre-Hurtado

# Hacer un cambio pequeño (ej: agregar un comentario)
echo "// Test deployment" >> incodefy/server.js

# Commit y push
git add .
git commit -m "test: probar CI/CD deployment"
git push origin main
```

### 7.2 Monitorear el deployment

1. Ve a tu repo en GitHub
2. Click en la pestaña **Actions**
3. Verás dos workflows ejecutándose:
   - ✅ **CI Pipeline** (lint, test, build)
   - 🚀 **CD Pipeline** (deploy)

4. Click en el workflow **CD Pipeline** para ver los logs en tiempo real

### 7.3 Aprobar deployment a producción

Cuando llegue al job **deploy-production**:
1. Verás un botón amarillo **"Review deployments"**
2. Click y selecciona **production**
3. Click **Approve and deploy**

---

## ✅ Paso 8: Verificar que funciona

### Abrir la aplicación:

**Staging:**
```
http://3.88.123.45:3000
```

**Production:**
```
http://54.23.156.78:3000
```

### Ver logs en el servidor:

```bash
# Conectarse al servidor
ssh -i ~/.ssh/hospital-key.pem ubuntu@TU_IP_EC2

# Ver logs de PM2
pm2 logs hospital-staging

# Ver estado
pm2 status
```

---

## 🔧 Comandos Útiles

### En el servidor EC2:

```bash
# Ver logs de la aplicación
pm2 logs hospital-staging

# Reiniciar la aplicación
pm2 restart hospital-staging

# Ver estado
pm2 status

# Ver uso de recursos
pm2 monit

# Ver logs de NGINX
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Reiniciar NGINX
sudo systemctl restart nginx
```

### En tu computadora local:

```bash
# Ejecutar CI localmente
cd incodefy
npm run lint
npm test

# Ver logs de GitHub Actions
# Ve a: https://github.com/felivazpro/Proyecto-Hospital-Padre-Hurtado/actions
```

---

## 🎯 Próximos Pasos (Opcional)

### 1. Configurar un Dominio

Si tienes un dominio (ej: `hospital-padre-hurtado.cl`):

1. En tu proveedor de DNS, crea records:
   - `staging.hospital-padre-hurtado.cl` → `3.88.123.45`
   - `www.hospital-padre-hurtado.cl` → `54.23.156.78`

2. Actualiza NGINX en EC2:

```bash
sudo nano /etc/nginx/sites-available/hospital-app
```

Cambia `server_name _;` por:
```nginx
server_name staging.hospital-padre-hurtado.cl;
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Agregar HTTPS con Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d staging.hospital-padre-hurtado.cl
```

### 3. Configurar Monitoreo

```bash
# Instalar monitoring de PM2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🐛 Troubleshooting

### El deployment falla en SSH:

1. Verifica que agregaste la llave correcta en GitHub Secrets
2. Asegúrate de que el Security Group permite SSH desde GitHub Actions
3. Conecta manualmente primero para aceptar el fingerprint

### La aplicación no arranca:

```bash
# Ver logs detallados
pm2 logs hospital-staging --lines 100

# Ver si hay errores de permisos
ls -la /home/ubuntu/hospital-app/incodefy

# Verificar el .env
cat /home/ubuntu/hospital-app/incodefy/.env
```

### Error de base de datos:

```bash
# Probar conexión a MySQL
mysql -h DB_HOST -u DB_USER -p

# Ver logs de MySQL
sudo tail -f /var/log/mysql/error.log
```

---

## 📞 Soporte

Si tienes problemas, revisa:
1. Logs en GitHub Actions
2. Logs en EC2 (`pm2 logs`)
3. Security Groups en AWS
4. Variables de entorno en `.env`

---

**¡Listo! Tu aplicación ahora tiene CI/CD completo** 🎉
