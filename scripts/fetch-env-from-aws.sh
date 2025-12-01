#!/bin/bash
# fetch-env-from-aws.sh
# Obtiene variables de entorno desde AWS Parameter Store y crea .env

set -e

REGION="${AWS_REGION:-us-east-2}"
ENV="${ENVIRONMENT:-production}"

echo "📥 Obteniendo variables de entorno desde AWS Parameter Store..."

# Crear archivo .env
cat > incodefy/.env << EOF
# Generado automáticamente desde AWS Parameter Store
# Fecha: $(date)

NODE_ENV=$(aws ssm get-parameter --name "/hospital/${ENV}/node-env" --query 'Parameter.Value' --output text --region ${REGION})
PORT=$(aws ssm get-parameter --name "/hospital/${ENV}/port" --query 'Parameter.Value' --output text --region ${REGION})
SESSION_SECRET=$(aws ssm get-parameter --name "/hospital/${ENV}/session-secret" --with-decryption --query 'Parameter.Value' --output text --region ${REGION})

AWS_REGION=$(aws ssm get-parameter --name "/hospital/${ENV}/aws-region" --query 'Parameter.Value' --output text --region ${REGION})
USER_POOL_ID=$(aws ssm get-parameter --name "/hospital/${ENV}/user-pool-id" --query 'Parameter.Value' --output text --region ${REGION})
USER_POOL_CLIENT_ID=$(aws ssm get-parameter --name "/hospital/${ENV}/user-pool-client-id" --query 'Parameter.Value' --output text --region ${REGION})

AWS_ACCESS_KEY_ID=$(aws ssm get-parameter --name "/hospital/${ENV}/aws-access-key-id" --with-decryption --query 'Parameter.Value' --output text --region ${REGION})
AWS_SECRET_ACCESS_KEY=$(aws ssm get-parameter --name "/hospital/${ENV}/aws-secret-access-key" --with-decryption --query 'Parameter.Value' --output text --region ${REGION})

# Endpoints
API_BASE_URL=$(aws ssm get-parameter --name "/hospital/${ENV}/api-base-url" --query 'Parameter.Value' --output text --region ${REGION})
PERMISSIONS_ENDPOINT=$(aws ssm get-parameter --name "/hospital/${ENV}/permissions-endpoint" --query 'Parameter.Value' --output text --region ${REGION})
PERSONALIZATION_ENDPOINT=$(aws ssm get-parameter --name "/hospital/${ENV}/personalization-endpoint" --query 'Parameter.Value' --output text --region ${REGION})

# CORS Configuration
ALLOWED_ORIGINS=$(aws ssm get-parameter --name "/hospital/${ENV}/ALLOWED_ORIGINS" --query 'Parameter.Value' --output text --region ${REGION} 2>/dev/null || echo "http://localhost:3000")
EOF

echo "✅ Archivo .env creado exitosamente en incodefy/.env"
echo "🔒 Variables sensibles obtenidas de forma segura desde AWS"
