#!/bin/bash
set -e
echo "=========================================="
echo "Setting up instance"
echo "=========================================="

# Clonar o actualizar repositorio
if [ -d "/home/appuser/hospital-app/.git" ]; then
  echo "Updating existing repository..."
  cd /home/appuser/hospital-app
  sudo -u appuser git fetch origin
  sudo -u appuser git reset --hard origin/felipe-4
else
  echo "Cloning repository..."
  rm -rf /home/appuser/hospital-app/*
  rm -rf /home/appuser/hospital-app/.git
  sudo -u appuser git clone https://github.com/Incodefy/Proyecto-Sistema-Gestion-Espacios.git /home/appuser/hospital-app
  chown -R appuser:appuser /home/appuser/hospital-app
fi

# Fetch environment variables from SSM
echo "Fetching environment variables from AWS SSM..."
cd /home/appuser/hospital-app
chmod +x scripts/fetch-env-from-aws.sh
AWS_REGION=us-east-2 ENVIRONMENT=production ./scripts/fetch-env-from-aws.sh

if [ ! -f /home/appuser/hospital-app/incodefy/.env ]; then
  echo "ERROR: .env file was not created!"
  exit 1
fi

echo ".env file created successfully"
chown appuser:appuser /home/appuser/hospital-app/incodefy/.env
chmod 600 /home/appuser/hospital-app/incodefy/.env

# Install dependencies if needed
cd /home/appuser/hospital-app/incodefy
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  sudo -u appuser npm install --production
fi

# Start server with PM2
echo "Starting server..."
sudo -u appuser bash -c "export HOME=/home/appuser && cd /home/appuser/hospital-app/incodefy && pm2 delete all 2>/dev/null || true"
sudo -u appuser bash -c "export HOME=/home/appuser && cd /home/appuser/hospital-app/incodefy && pm2 start server.js --name hospital-app"

sleep 5

# Verify server is running
if ss -tlnp | grep :3000 > /dev/null 2>&1; then
  echo "Server is running on port 3000"
else
  echo "WARNING: Server is not responding on port 3000"
fi

echo "=========================================="
echo "Setup completed"
echo "=========================================="
