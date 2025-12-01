#!/bin/bash
set -e

export HOME=/root

# Fix git ownership
git config --global --add safe.directory /home/appuser/hospital-app

# Update code
cd /home/appuser/hospital-app
sudo -u appuser git pull origin felipe-4

# Stop old server
sudo pkill -u appuser node || true

# Start server as appuser
sudo -u appuser bash -c "cd /home/appuser/hospital-app/incodefy && nohup node server.js > /home/appuser/app.log 2>&1 < /dev/null &"

sleep 5

# Verify
ss -tlnp | grep :3000 && echo "Server Running" || echo "Failed to start"
ps aux | grep "node.*server.js" | grep -v grep && echo "Process OK" || echo "No process"
