#!/bin/bash
cd /home/appuser/hospital-app/incodefy
export HOME=/home/appuser
sudo -u appuser pm2 delete all 2>/dev/null || true
sudo -u appuser bash -c "cd /home/appuser/hospital-app/incodefy && export HOME=/home/appuser && pm2 start server.js --name hospital-app --log /home/appuser/pm2-app.log"
sleep 5
netstat -tlnp 2>/dev/null | grep :3000 || echo "No server on port 3000"
curl -s http://localhost:3000/health || echo "Health check failed"
