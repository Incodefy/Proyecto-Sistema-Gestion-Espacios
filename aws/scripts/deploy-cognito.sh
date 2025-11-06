#!/bin/bash

# Script para crear Cognito User Pool sin CloudFormation
# Compatible con AWS Academy Learner Lab

set -e

STAGE=${STAGE:-dev}
REGION=${AWS_REGION:-us-east-1}
SERVICE_NAME="hospital-backend"
POOL_NAME="${SERVICE_NAME}-${STAGE}-pool"
CLIENT_NAME="${SERVICE_NAME}-${STAGE}-app"

echo "🔐 Setting up Cognito User Pool in $REGION (stage: $STAGE)"

# Verificar si el User Pool ya existe
EXISTING_POOLS=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" 2>/dev/null || echo '{"UserPools":[]}')
POOL_ID=$(echo "$EXISTING_POOLS" | jq -r ".UserPools[] | select(.Name==\"$POOL_NAME\") | .Id" | head -n 1)

if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "null" ]; then
    echo "✨ Creating new User Pool: $POOL_NAME"
    
    CREATE_OUTPUT=$(aws cognito-idp create-user-pool \
        --pool-name "$POOL_NAME" \
        --username-attributes email \
        --auto-verified-attributes email \
        --policies "PasswordPolicy={MinimumLength=8,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false,RequireUppercase=true}" \
        --user-pool-tags "Environment=$STAGE,Project=HospitalPadreHurtado" \
        --region "$REGION" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo "❌ Error creating User Pool:"
        echo "$CREATE_OUTPUT"
        
        # Intentar buscar nuevamente (puede haber sido creado)
        POOL_ID=$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" | jq -r ".UserPools[] | select(.Name==\"$POOL_NAME\") | .Id" | head -n 1)
        
        if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "null" ]; then
            exit 1
        fi
    else
        POOL_ID=$(echo "$CREATE_OUTPUT" | jq -r '.UserPool.Id')
    fi
    
    echo "✅ User Pool created: $POOL_ID"
else
    echo "⏭️  User Pool already exists: $POOL_ID"
fi

# Verificar si el App Client ya existe
EXISTING_CLIENTS=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" --region "$REGION" 2>/dev/null || echo '{"UserPoolClients":[]}')
CLIENT_ID=$(echo "$EXISTING_CLIENTS" | jq -r ".UserPoolClients[] | select(.ClientName==\"$CLIENT_NAME\") | .ClientId" | head -n 1)

if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" = "null" ]; then
    echo "✨ Creating App Client: $CLIENT_NAME"
    
    CLIENT_OUTPUT=$(aws cognito-idp create-user-pool-client \
        --user-pool-id "$POOL_ID" \
        --client-name "$CLIENT_NAME" \
        --no-generate-secret \
        --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
        --access-token-validity 60 \
        --id-token-validity 60 \
        --refresh-token-validity 30 \
        --token-validity-units "AccessToken=minutes,IdToken=minutes,RefreshToken=days" \
        --prevent-user-existence-errors ENABLED \
        --region "$REGION")
    
    CLIENT_ID=$(echo "$CLIENT_OUTPUT" | jq -r '.UserPoolClient.ClientId')
    echo "✅ App Client created: $CLIENT_ID"
else
    echo "⏭️  App Client already exists: $CLIENT_ID"
fi

echo ""
echo "🎉 Cognito setup completed successfully!"
echo ""
echo "📋 Configuration:"
echo "   User Pool ID: $POOL_ID"
echo "   Client ID: $CLIENT_ID"
echo "   Region: $REGION"
echo ""

# Guardar IDs en archivo para uso posterior
mkdir -p .aws-output
cat > .aws-output/cognito-ids.json <<EOF
{
  "UserPoolId": "$POOL_ID",
  "ClientId": "$CLIENT_ID",
  "Region": "$REGION",
  "Stage": "$STAGE"
}
EOF

echo "💾 Configuration saved to .aws-output/cognito-ids.json"
echo ""
echo "✨ Cognito setup completed!"
