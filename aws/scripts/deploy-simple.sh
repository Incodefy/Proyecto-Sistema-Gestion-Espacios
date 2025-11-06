#!/bin/bash

# Script SIMPLE para deployment - solo Lambda functions
# Versión minimalista sin dependencias de DynamoDB/Cognito

set -e

STAGE=${STAGE:-dev}
REGION=${AWS_REGION:-us-east-1}
ROLE_ARN="arn:aws:iam::211125294486:role/LabRole"
SERVICE_NAME="hospital-backend"

echo "🚀 Simple Lambda Deployment"
echo "   Stage: $STAGE"
echo "   Region: $REGION"
echo ""

# Crear zip con el código
echo "📦 Creating deployment package..."
cd "$(dirname "$0")/.."
rm -rf dist function.zip 2>/dev/null || true
mkdir -p dist

# Copiar archivos necesarios
cp -r src dist/
cp -r node_modules dist/ 2>/dev/null || echo "⚠️  node_modules not found, Lambda may fail"
cp package.json dist/

cd dist
zip -r -q ../function.zip .
cd ..

SIZE=$(du -h function.zip | cut -f1)
echo "✅ Package created: $SIZE"
echo ""

# Desplegar solo la función health (la más importante)
FUNC_NAME="hospital-backend-health-$STAGE"
echo "🔄 Deploying $FUNC_NAME..."

if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" 2>/dev/null; then
    echo "   Updating existing function..."
    aws lambda update-function-code \
        --function-name "$FUNC_NAME" \
        --zip-file fileb://function.zip \
        --region "$REGION" > /dev/null
    echo "✅ Function updated"
else
    echo "   Creating new function..."
    aws lambda create-function \
        --function-name "$FUNC_NAME" \
        --runtime nodejs20.x \
        --role "$ROLE_ARN" \
        --handler "src/handlers/health.check" \
        --zip-file fileb://function.zip \
        --timeout 30 \
        --memory-size 256 \
        --environment "Variables={STAGE=$STAGE,VERSION=1.0.0}" \
        --region "$REGION" > /dev/null
    echo "✅ Function created"
fi

echo ""
echo "🧪 Testing function..."
aws lambda invoke \
    --function-name "$FUNC_NAME" \
    --region "$REGION" \
    --log-type Tail \
    response.json > /dev/null 2>&1

if [ -f response.json ]; then
    echo "Response:"
    cat response.json
    rm response.json
fi

# Cleanup
rm -rf dist function.zip

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🔗 Invoke your function:"
echo "   aws lambda invoke --function-name $FUNC_NAME response.json --region $REGION"
