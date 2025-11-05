#!/bin/bash

# Script para crear el archivo .env en EC2
# Ejecuta este script en tu EC2 ANTES del primer deployment

ENV_FILE="/home/ubuntu/hospital-app/incodefy/.env"

echo "📝 Creando archivo .env para producción..."

# Solicitar valores al usuario
read -p "SESSION_SECRET (clave secreta para sesiones): " SESSION_SECRET
read -p "USER_POOL_ID (AWS Cognito): " USER_POOL_ID
read -p "USER_POOL_CLIENT_ID (AWS Cognito): " USER_POOL_CLIENT_ID
read -p "API_BASE_URL (URL de tu API Lambda): " API_BASE_URL
read -p "DB_HOST (Host de MySQL, ej: localhost o RDS endpoint): " DB_HOST
read -p "DB_USER (Usuario de MySQL): " DB_USER
read -sp "DB_PASSWORD (Password de MySQL): " DB_PASSWORD
echo ""
read -p "DB_NAME (Nombre de la base de datos): " DB_NAME

# Crear el archivo .env
cat > $ENV_FILE << EOF
# Configuración de producción
NODE_ENV=production
PORT=3000
SESSION_SECRET=$SESSION_SECRET

# Base de datos MySQL
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# AWS Cognito
AWS_REGION=us-east-1
USER_POOL_ID=$USER_POOL_ID
USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID

# API Backend
API_BASE_URL=$API_BASE_URL
EOF

# Establecer permisos seguros
chmod 600 $ENV_FILE

echo ""
echo "✅ Archivo .env creado exitosamente en: $ENV_FILE"
echo ""
echo "🔒 Permisos configurados: solo el usuario puede leer/escribir"
echo ""
echo "📋 Contenido del archivo (sin passwords):"
grep -v "PASSWORD\|SECRET" $ENV_FILE
