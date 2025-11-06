#!/bin/bash

# Script para desplegar funciones Lambda sin CloudFormation
# Compatible con AWS Academy Learner Lab

set -e

STAGE=${STAGE:-dev}
REGION=${AWS_REGION:-us-east-1}
ROLE_ARN="arn:aws:iam::211125294486:role/LabRole"
SERVICE_NAME="hospital-backend"

echo "🚀 Deploying Lambda functions to $REGION (stage: $STAGE)"

# Crear zip con solo las dependencias de producción
echo "📦 Creating deployment package..."
cd "$(dirname "$0")/.."
rm -rf dist function.zip 2>/dev/null || true
mkdir -p dist

# Copiar código fuente
cp -r src dist/
cp package.json dist/

# Instalar solo dependencias de producción
cd dist
npm install --production --no-optional 2>/dev/null || npm install --omit=dev --no-optional
cd ..

# Crear zip excluyendo archivos innecesarios
cd dist
zip -r -q ../function.zip . -x "*.git*" "*.DS_Store" "*.md" "*test*" "*spec*"
cd ..

SIZE=$(du -h function.zip | cut -f1)
SIZE_BYTES=$(du -b function.zip | cut -f1)
echo "✅ Package created: $SIZE ($SIZE_BYTES bytes)"

# Verificar tamaño (Lambda tiene límite de ~50MB comprimido)
if [ "$SIZE_BYTES" -gt 52428800 ]; then
    echo "⚠️  Warning: Package is larger than 50MB, may fail to upload"
fi

# Array de funciones a desplegar
declare -A FUNCTIONS=(
    ["health"]="src/handlers/health.check"
    ["login"]="src/handlers/login.handler"
    ["refresh"]="src/handlers/refresh.handler"
    ["me"]="src/handlers/me.handler"
    ["listUserRoles"]="src/handlers/permissions.listUserRoles"
    ["assignRole"]="src/handlers/permissions.assignRole"
    ["listAvailablePermissions"]="src/handlers/permissions.listAvailablePermissions"
    ["getPersonalization"]="src/handlers/personalization.getPersonalization"
    ["setPersonalization"]="src/handlers/personalization.setPersonalization"
)

# Desplegar cada función
for FUNC_NAME in "${!FUNCTIONS[@]}"; do
    FULL_NAME="${SERVICE_NAME}-${FUNC_NAME}-${STAGE}"
    HANDLER="${FUNCTIONS[$FUNC_NAME]}"
    
    echo ""
    echo "🔄 Deploying function: $FULL_NAME"
    
    # Preparar variables de entorno
    ENV_VARS="Variables={"
    ENV_VARS+="STAGE=${STAGE},"
    ENV_VARS+="VERSION=1.0.0,"
    ENV_VARS+="USER_ROLES_TABLE=${SERVICE_NAME}-${STAGE}-user-roles,"
    ENV_VARS+="PERMISSIONS_TABLE=${SERVICE_NAME}-${STAGE}-permissions,"
    ENV_VARS+="PARAMETERS_TABLE=${SERVICE_NAME}-${STAGE}-parameters"
    
    # Agregar Cognito IDs si existen
    if [ -f ".aws-output/cognito-ids.json" ]; then
        USER_POOL_ID=$(jq -r '.UserPoolId' .aws-output/cognito-ids.json)
        CLIENT_ID=$(jq -r '.ClientId' .aws-output/cognito-ids.json)
        ENV_VARS+=",USER_POOL_ID=${USER_POOL_ID}"
        ENV_VARS+=",USER_POOL_CLIENT_ID=${CLIENT_ID}"
    fi
    ENV_VARS+="}"
    
    # Verificar si la función existe
    if aws lambda get-function --function-name "$FULL_NAME" --region "$REGION" 2>/dev/null; then
        echo "♻️  Updating existing function..."
        aws lambda update-function-code \
            --function-name "$FULL_NAME" \
            --zip-file fileb://function.zip \
            --region "$REGION" > /dev/null
        
        echo "⚙️  Updating configuration..."
        aws lambda update-function-configuration \
            --function-name "$FULL_NAME" \
            --runtime nodejs20.x \
            --handler "$HANDLER" \
            --timeout 30 \
            --memory-size 256 \
            --environment "$ENV_VARS" \
            --region "$REGION" > /dev/null
    else
        echo "✨ Creating new function..."
        aws lambda create-function \
            --function-name "$FULL_NAME" \
            --runtime nodejs20.x \
            --role "$ROLE_ARN" \
            --handler "$HANDLER" \
            --zip-file fileb://function.zip \
            --timeout 30 \
            --memory-size 256 \
            --environment "$ENV_VARS" \
            --region "$REGION" \
            --tags "Environment=$STAGE,Project=HospitalPadreHurtado,ManagedBy=GitHubActions" > /dev/null
    fi
    
    echo "✅ Function $FULL_NAME deployed"
done

echo ""
echo "🎉 All Lambda functions deployed successfully!"
echo ""
echo "📋 Deployed functions:"
aws lambda list-functions --region "$REGION" | grep -E "${SERVICE_NAME}.*${STAGE}" || true

# Cleanup
rm -f function.zip
rm -rf dist

echo ""
echo "✨ Deployment completed!"
