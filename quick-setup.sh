#!/bin/bash
# Quick setup script for EC2 instances
set -e

echo "=== Creating appuser if needed ==="
id -u appuser &>/dev/null || useradd -m -s /bin/bash appuser

echo "=== Installing Node.js if needed ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "=== Cloning repository ==="
mkdir -p /home/appuser
rm -rf /home/appuser/hospital-app
git clone -b felipe-4 https://github.com/Incodefy/Proyecto-Sistema-Gestion-Espacios.git /home/appuser/hospital-app
chown -R appuser:appuser /home/appuser/hospital-app

echo "=== Creating .env file ==="
cat > /home/appuser/hospital-app/incodefy/.env << 'EOF'
NODE_ENV=development
PORT=3000
SESSION_SECRET=tu-clave-secreta-super-segura

AWS_REGION=us-east-2
USER_POOL_ID=us-east-2_HxF4pn23S
USER_POOL_CLIENT_ID=2vbst10c3pg8alsngeinqdq7bm

AWS_ACCESS_KEY_ID=AKIAZL3B5KO7FQJDX47P
AWS_SECRET_ACCESS_KEY=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

API_BASE_URL=https://l4ggwvtd2d.execute-api.us-east-2.amazonaws.com
PERMISSIONS_ENDPOINT=/my-permissions
PERSONALIZATION_ENDPOINT=/personalization

ALLOWED_ORIGINS=http://incodefy-alb-dev-1108693392.us-east-2.elb.amazonaws.com
EOF

chown appuser:appuser /home/appuser/hospital-app/incodefy/.env
chmod 600 /home/appuser/hospital-app/incodefy/.env

echo "=== Installing dependencies ==="
cd /home/appuser/hospital-app/incodefy
sudo -u appuser npm install --production

echo "=== Starting server ==="
pkill -f "node.*server.js" || true
sudo -u appuser bash -c "cd /home/appuser/hospital-app/incodefy && nohup node server.js > /tmp/app.log 2>&1 < /dev/null &"

sleep 5

echo "=== Verification ==="
ps aux | grep "node.*server.js" | grep -v grep || echo "WARNING: Process not found"
ss -tlnp | grep :3000 || echo "WARNING: Port not listening"

echo "=== Setup complete ==="
