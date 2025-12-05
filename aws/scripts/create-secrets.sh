#!/bin/bash

# Script para crear secrets en AWS Secrets Manager
# Ejecutar UNA VEZ antes del primer deployment

set -e

STAGE=${1:-dev}
REGION=${AWS_REGION:-us-east-2}
SECRET_NAME="hospital/${STAGE}/app-secrets"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 Creating Secrets in AWS Secrets Manager"
echo "   Stage: $STAGE"
echo "   Region: $REGION"
echo "   Secret Name: $SECRET_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Función para generar secrets seguros
generate_secret() {
    openssl rand -base64 32
}

# Verificar si el secret ya existe
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" 2>/dev/null; then
    echo "⚠️  Secret already exists: $SECRET_NAME"
    read -p "Do you want to update it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    UPDATE=true
else
    UPDATE=false
fi

# Pedir valores al usuario
echo ""
echo "Enter secret values (or press Enter to keep existing/generate random):"
echo ""

read -p "SES_FROM_EMAIL (default: incodefy2025@gmail.com): " SES_EMAIL
SES_EMAIL=${SES_EMAIL:-incodefy2025@gmail.com}

read -p "APP_URL for $STAGE (default: http://localhost:3000): " APP_URL
if [ "$STAGE" = "prod" ]; then
    APP_URL=${APP_URL:-https://hospital.com}
elif [ "$STAGE" = "staging" ]; then
    APP_URL=${APP_URL:-https://staging.hospital.com}
else
    APP_URL=${APP_URL:-http://localhost:3000}
fi

# Generar JWT secret seguro
JWT_SECRET=$(generate_secret)
echo "✅ Generated JWT_SECRET: ${JWT_SECRET:0:20}..."

# Generar encryption key
ENCRYPTION_KEY=$(generate_secret)
echo "✅ Generated ENCRYPTION_KEY: ${ENCRYPTION_KEY:0:20}..."

# Crear JSON con los secrets
SECRET_JSON=$(cat <<EOF
{
  "SES_FROM_EMAIL": "$SES_EMAIL",
  "APP_URL": "$APP_URL",
  "JWT_SECRET": "$JWT_SECRET",
  "ENCRYPTION_KEY": "$ENCRYPTION_KEY",
  "DATABASE_ENCRYPTION_ENABLED": "true",
  "LOG_LEVEL": "info"
}
EOF
)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Secret content (preview):"
echo "$SECRET_JSON" | jq .
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Proceed with creating/updating secret? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

if [ "$UPDATE" = true ]; then
    # Actualizar secret existente
    echo "Updating secret..."
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION"
else
    # Crear nuevo secret
    echo "Creating secret..."
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "Application secrets for Hospital System - $STAGE" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION" \
        --tags Key=Environment,Value=$STAGE Key=Project,Value=HospitalPadreHurtado Key=ManagedBy,Value=Manual
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secret created/updated successfully!"
echo ""
echo "Secret ARN:"
aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" --query 'ARN' --output text
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Update serverless.yml with SECRET_NAME environment variable"
echo "2. Deploy your Lambda functions"
echo "3. Test secret retrieval"
echo ""
echo "Test command:"
echo "aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION --query SecretString --output text | jq ."
echo ""
