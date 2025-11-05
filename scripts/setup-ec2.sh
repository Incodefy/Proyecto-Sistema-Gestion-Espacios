#!/bin/bash

# Script de configuración inicial para EC2
# Ejecuta este script en tu instancia EC2 la primera vez

echo "🚀 Configurando EC2 para Hospital Padre Hurtado..."

# Actualizar el sistema
echo "📦 Actualizando el sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18
echo "📦 Instalando Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
echo "✅ Node.js version: $(node --version)"
echo "✅ NPM version: $(npm --version)"

# Instalar PM2 globalmente
echo "📦 Instalando PM2..."
sudo npm install -g pm2

# Instalar MySQL Client
echo "📦 Instalando MySQL Client..."
sudo apt install -y mysql-client

# Crear directorio de la aplicación
echo "📁 Creando directorio de aplicación..."
sudo mkdir -p /home/ubuntu/hospital-app
sudo chown -R ubuntu:ubuntu /home/ubuntu/hospital-app

# Crear directorio para logs
echo "📁 Creando directorio de logs..."
sudo mkdir -p /var/log/hospital-app
sudo chown -R ubuntu:ubuntu /var/log/hospital-app

# Configurar PM2 para arranque automático
echo "⚙️ Configurando PM2 startup..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Configurar firewall (UFW)
echo "🔥 Configurando firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Node.js App
sudo ufw --force enable

# Instalar NGINX (opcional, para reverse proxy)
echo "📦 Instalando NGINX..."
sudo apt install -y nginx

# Crear configuración básica de NGINX
sudo bash -c 'cat > /etc/nginx/sites-available/hospital-app << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF'

# Habilitar el sitio
sudo ln -sf /etc/nginx/sites-available/hospital-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Instalar Git (si no está instalado)
echo "📦 Instalando Git..."
sudo apt install -y git

echo ""
echo "✅ ¡EC2 configurado exitosamente!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Configurar las variables de entorno en /home/ubuntu/hospital-app/incodefy/.env"
echo "2. Clonar o desplegar tu aplicación en /home/ubuntu/hospital-app"
echo "3. Ejecutar: cd /home/ubuntu/hospital-app/incodefy && npm install"
echo "4. Iniciar la app: pm2 start server.js --name hospital-app"
echo "5. Guardar configuración: pm2 save"
echo ""
echo "🌐 La aplicación estará disponible en:"
echo "   - http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000 (directo)"
echo "   - http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4) (via NGINX)"
