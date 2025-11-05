#!/bin/bash

# Script de deployment manual para EC2
# Ejecuta este script DENTRO de tu instancia EC2 después del setup inicial

APP_DIR="/home/ubuntu/hospital-app"
APP_NAME="hospital-app"

echo "🚀 Iniciando deployment de Hospital Padre Hurtado..."

# Ir al directorio de la aplicación
cd $APP_DIR/incodefy || exit 1

# Hacer backup del .env (si existe)
if [ -f ".env" ]; then
    echo "💾 Haciendo backup del archivo .env..."
    cp .env .env.backup
fi

# Instalar dependencias de producción
echo "📦 Instalando dependencias..."
npm ci --production

# Verificar si existe el archivo .env
if [ ! -f ".env" ]; then
    echo "⚠️ ADVERTENCIA: No se encontró archivo .env"
    echo "Por favor, crea el archivo .env con las variables necesarias"
    exit 1
fi

# Reiniciar la aplicación con PM2
echo "🔄 Reiniciando aplicación..."
pm2 restart $APP_NAME 2>/dev/null || pm2 start server.js --name $APP_NAME --env production

# Guardar configuración de PM2
pm2 save

# Mostrar estado
echo ""
echo "✅ Deployment completado!"
echo ""
pm2 list
echo ""
echo "📊 Para ver los logs:"
echo "   pm2 logs $APP_NAME"
echo ""
echo "🌐 La aplicación debería estar disponible en:"
echo "   http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"
