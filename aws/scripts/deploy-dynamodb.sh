#!/bin/bash

# Script para crear DynamoDB tables sin CloudFormation
# Compatible con AWS Academy Learner Lab

set -e

STAGE=${STAGE:-dev}
REGION=${AWS_REGION:-us-east-1}
SERVICE_NAME="hospital-backend"

echo "🗄️  Creating DynamoDB tables in $REGION (stage: $STAGE)"

# Función para crear tabla si no existe
create_table_if_not_exists() {
    local TABLE_NAME=$1
    local KEY_SCHEMA=$2
    local ATTRIBUTE_DEFINITIONS=$3
    
    if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" 2>/dev/null; then
        echo "⏭️  Table $TABLE_NAME already exists, skipping..."
    else
        echo "✨ Creating table $TABLE_NAME..."
        aws dynamodb create-table \
            --table-name "$TABLE_NAME" \
            --billing-mode PAY_PER_REQUEST \
            --key-schema "$KEY_SCHEMA" \
            --attribute-definitions "$ATTRIBUTE_DEFINITIONS" \
            --tags "Key=Environment,Value=$STAGE" "Key=Project,Value=HospitalPadreHurtado" \
            --region "$REGION" > /dev/null
        
        echo "⏳ Waiting for table to be active..."
        aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
        echo "✅ Table $TABLE_NAME created"
    fi
}

# 1. User Roles Table
echo ""
echo "📋 Creating User Roles table..."
create_table_if_not_exists \
    "${SERVICE_NAME}-${STAGE}-user-roles" \
    "AttributeName=user_sub,KeyType=HASH" \
    "AttributeName=user_sub,AttributeType=S"

# 2. Permissions Table
echo ""
echo "📋 Creating Permissions table..."
create_table_if_not_exists \
    "${SERVICE_NAME}-${STAGE}-permissions" \
    "AttributeName=permission_id,KeyType=HASH" \
    "AttributeName=permission_id,AttributeType=S"

# 3. Parameters Table (con composite key)
echo ""
echo "📋 Creating Parameters table..."
if aws dynamodb describe-table --table-name "${SERVICE_NAME}-${STAGE}-parameters" --region "$REGION" 2>/dev/null; then
    echo "⏭️  Table ${SERVICE_NAME}-${STAGE}-parameters already exists, skipping..."
else
    echo "✨ Creating table ${SERVICE_NAME}-${STAGE}-parameters..."
    aws dynamodb create-table \
        --table-name "${SERVICE_NAME}-${STAGE}-parameters" \
        --billing-mode PAY_PER_REQUEST \
        --key-schema "AttributeName=user_sub,KeyType=HASH" "AttributeName=parameter_key,KeyType=RANGE" \
        --attribute-definitions "AttributeName=user_sub,AttributeType=S" "AttributeName=parameter_key,AttributeType=S" \
        --tags "Key=Environment,Value=$STAGE" "Key=Project,Value=HospitalPadreHurtado" \
        --region "$REGION" > /dev/null
    
    echo "⏳ Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name "${SERVICE_NAME}-${STAGE}-parameters" --region "$REGION"
    echo "✅ Table ${SERVICE_NAME}-${STAGE}-parameters created"
fi

echo ""
echo "🎉 All DynamoDB tables created successfully!"
echo ""
echo "📋 Tables:"
aws dynamodb list-tables --region "$REGION" | grep -E "${SERVICE_NAME}.*${STAGE}" || true

echo ""
echo "✨ Database setup completed!"
