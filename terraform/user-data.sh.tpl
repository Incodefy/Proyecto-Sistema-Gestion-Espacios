#!/bin/bash
# User Data script para instancias EC2
# Este script se ejecuta al iniciar la instancia

set -e

# Logging
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=========================================="
echo "Starting EC2 instance configuration"
echo "Project: ${project_name}"
echo "Environment: ${stage}"
echo "=========================================="

# Actualizar sistema
echo "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Instalar Node.js 18
echo "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Verificar instalación
node --version
npm --version

# Instalar PM2
echo "Installing PM2..."
npm install -g pm2

# Instalar CloudWatch Agent
echo "Installing CloudWatch Agent..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# Crear usuario para la aplicación
echo "Creating app user..."
useradd -m -s /bin/bash appuser || true

# Crear directorios
echo "Creating application directories..."
mkdir -p /home/appuser/hospital-app
mkdir -p /var/log/hospital-app
chown -R appuser:appuser /home/appuser/hospital-app
chown -R appuser:appuser /var/log/hospital-app

# Configurar variables de entorno desde AWS SSM Parameter Store
echo "Fetching environment variables from AWS SSM..."
cd /home/appuser/hospital-app
chmod +x scripts/fetch-env-from-aws.sh
AWS_REGION=${region} ENVIRONMENT=production ./scripts/fetch-env-from-aws.sh

# Verificar que .env fue creado
if [ ! -f /home/appuser/hospital-app/incodefy/.env ]; then
  echo "ERROR: .env file was not created!"
  exit 1
fi

echo ".env file created successfully"
chown appuser:appuser /home/appuser/hospital-app/incodefy/.env
chmod 600 /home/appuser/hospital-app/incodefy/.env

# Instalar Git
echo "Installing Git..."
apt-get install -y git

# Clonar repositorio
echo "Cloning application repository..."
rm -rf /home/appuser/hospital-app/*
git clone https://github.com/Incodefy/Proyecto-Sistema-Gestion-Espacios.git /home/appuser/hospital-app/repo
mv /home/appuser/hospital-app/repo/* /home/appuser/hospital-app/
mv /home/appuser/hospital-app/repo/.* /home/appuser/hospital-app/ 2>/dev/null || true
rm -rf /home/appuser/hospital-app/repo

# Cambiar permisos
chown -R appuser:appuser /home/appuser/hospital-app

# Instalar dependencias de la aplicación
echo "Installing application dependencies..."
cd /home/appuser/hospital-app/incodefy
su - appuser -c "cd /home/appuser/hospital-app/incodefy && npm install --production"

# Configurar PM2
echo "Configuring PM2..."
cat > /home/appuser/hospital-app/ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [{
    name: 'hospital-app',
    cwd: '/home/appuser/hospital-app/incodefy',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/hospital-app/error.log',
    out_file: '/var/log/hospital-app/out.log',
    log_file: '/var/log/hospital-app/combined.log',
    time: true
  }]
};
EOFPM2

chown appuser:appuser /home/appuser/hospital-app/ecosystem.config.js

# Configurar PM2 para iniciar con el sistema
echo "Setting up PM2 startup..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u appuser --hp /home/appuser

# Health check endpoint básico
echo "Creating health check endpoint..."
mkdir -p /var/www/html
cat > /var/www/html/health << 'EOFHEALTH'
#!/bin/bash
# Health check simple
if systemctl is-active --quiet pm2-appuser; then
  echo "OK"
  exit 0
else
  echo "FAIL"
  exit 1
fi
EOFHEALTH
chmod +x /var/www/html/health

# Configurar firewall
echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 3000/tcp
ufw --force enable

# Signal al Auto Scaling que la instancia está lista
echo "Starting application with PM2..."
su - appuser -c "export HOME=/home/appuser && cd /home/appuser/hospital-app/incodefy && pm2 start server.js --name hospital-app"
su - appuser -c "export HOME=/home/appuser && pm2 save"

# Esperar a que el servidor inicie
echo "Waiting for server to start..."
sleep 10

# Verificar que el servidor esté corriendo
if netstat -tlnp | grep :3000 > /dev/null; then
  echo "Server is running on port 3000"
else
  echo "WARNING: Server is not responding on port 3000"
  su - appuser -c "export HOME=/home/appuser && pm2 logs --lines 50 --nostream"
fi

echo "Instance configuration completed successfully!"
echo "=========================================="
