#!/bin/bash

# Script maestro para desplegar toda la infraestructura
# Sin CloudFormation - Compatible con AWS Academy

set -e

STAGE=${STAGE:-dev}
REGION=${AWS_REGION:-us-east-1}

echo "🚀 Starting full deployment to AWS"
echo "   Stage: $STAGE"
echo "   Region: $REGION"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AWS_DIR="$(dirname "$SCRIPT_DIR")"

# 1. Crear tablas DynamoDB
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/3: Creating DynamoDB Tables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/deploy-dynamodb.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/3: Setting up Cognito"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/deploy-cognito.sh"

# Leer IDs de Cognito
if [ -f "$AWS_DIR/.aws-output/cognito-ids.json" ]; then
    USER_POOL_ID=$(jq -r '.UserPoolId' "$AWS_DIR/.aws-output/cognito-ids.json")
    CLIENT_ID=$(jq -r '.ClientId' "$AWS_DIR/.aws-output/cognito-ids.json")
    
    echo ""
    echo "📝 Setting Lambda environment variables..."
    export USER_POOL_ID
    export USER_POOL_CLIENT_ID=$CLIENT_ID
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/3: Deploying Lambda Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/deploy-lambda.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Completed Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Deployment Summary:"
echo "   • DynamoDB Tables: 3 tables"
echo "   • Cognito User Pool: $USER_POOL_ID"
echo "   • Lambda Functions: 9 functions"
echo "   • Stage: $STAGE"
echo "   • Region: $REGION"
echo ""
echo "⚠️  Note: API Gateway needs to be created manually or with additional script"
echo "   You can invoke Lambda functions directly or create HTTP API in console"
echo ""
echo "🔗 Next steps:"
echo "   1. Test Lambda function: aws lambda invoke --function-name hospital-backend-health-dev response.json"
echo "   2. Create API Gateway HTTP API (manual or script)"
echo "   3. Configure Lambda permissions for API Gateway"
echo ""
