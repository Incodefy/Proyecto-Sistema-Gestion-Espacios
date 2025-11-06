#!/bin/bash

# Script para verificar qué permisos tiene el rol de AWS Academy

REGION=${AWS_REGION:-us-east-1}

echo "🔍 Checking AWS Academy permissions..."
echo ""

# Verificar Lambda
echo "📦 Lambda:"
aws lambda list-functions --region $REGION --max-items 1 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ lambda:ListFunctions - ALLOWED"
else
    echo "   ❌ lambda:ListFunctions - DENIED"
fi

aws lambda get-function --function-name test-function-does-not-exist --region $REGION > /dev/null 2>&1
ERROR_CODE=$?
if [ $ERROR_CODE -eq 254 ] || [ $ERROR_CODE -eq 0 ]; then
    echo "   ✅ lambda:GetFunction - ALLOWED"
else
    echo "   ❌ lambda:GetFunction - DENIED"
fi

# Verificar DynamoDB
echo ""
echo "🗄️  DynamoDB:"
aws dynamodb list-tables --region $REGION > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ dynamodb:ListTables - ALLOWED"
else
    echo "   ❌ dynamodb:ListTables - DENIED"
fi

# Verificar Cognito
echo ""
echo "🔐 Cognito:"
aws cognito-idp list-user-pools --max-results 1 --region $REGION > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ cognito-idp:ListUserPools - ALLOWED"
else
    echo "   ❌ cognito-idp:ListUserPools - DENIED"
fi

# Verificar S3
echo ""
echo "🪣  S3:"
aws s3 ls > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ s3:ListBuckets - ALLOWED"
else
    echo "   ❌ s3:ListBuckets - DENIED"
fi

# Verificar IAM
echo ""
echo "👤 IAM:"
aws iam get-role --role-name LabRole --region $REGION > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ iam:GetRole - ALLOWED"
else
    echo "   ❌ iam:GetRole - DENIED"
fi

# Verificar API Gateway
echo ""
echo "🌐 API Gateway:"
aws apigatewayv2 get-apis --region $REGION > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ apigateway:GET /apis - ALLOWED"
else
    echo "   ❌ apigateway:GET /apis - DENIED"
fi

echo ""
echo "📋 Summary: Check which services you can use above"
