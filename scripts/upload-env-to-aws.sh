#!/bin/bash
# upload-env-to-aws.sh
# Sube todas las variables del .env a AWS Parameter Store

set -e

REGION="us-east-2"
ENV="production"

echo "📤 Subiendo variables de entorno a AWS Parameter Store..."

# NODE_ENV
aws ssm put-parameter --name "/hospital/${ENV}/node-env" --value "production" --type "String" --overwrite --region ${REGION}

# PORT
aws ssm put-parameter --name "/hospital/${ENV}/port" --value "3000" --type "String" --overwrite --region ${REGION}

# SESSION_SECRET (SecureString para datos sensibles)
aws ssm put-parameter --name "/hospital/${ENV}/session-secret" --value "tu-clave-secreta-super-segura" --type "SecureString" --overwrite --region ${REGION}

# AWS Cognito
aws ssm put-parameter --name "/hospital/${ENV}/aws-region" --value "us-east-2" --type "String" --overwrite --region ${REGION}
aws ssm put-parameter --name "/hospital/${ENV}/user-pool-id" --value "us-east-2_HxF4pn23S" --type "String" --overwrite --region ${REGION}
aws ssm put-parameter --name "/hospital/${ENV}/user-pool-client-id" --value "2vbst10c3pg8alsngeinqdq7bm" --type "String" --overwrite --region ${REGION}

# AWS Credentials (SecureString - CRÍTICO)
aws ssm put-parameter --name "/hospital/${ENV}/aws-access-key-id" --value "AKIAZL3B5KO7FQJDX47P" --type "SecureString" --overwrite --region ${REGION}
aws ssm put-parameter --name "/hospital/${ENV}/aws-secret-access-key" --value "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" --type "SecureString" --overwrite --region ${REGION}

# API Endpoints
aws ssm put-parameter --name "/hospital/${ENV}/api-base-url" --value "https://l4ggwvtd2d.execute-api.us-east-2.amazonaws.com" --type "String" --overwrite --region ${REGION}
aws ssm put-parameter --name "/hospital/${ENV}/permissions-endpoint" --value "/my-permissions" --type "String" --overwrite --region ${REGION}
aws ssm put-parameter --name "/hospital/${ENV}/personalization-endpoint" --value "/personalization" --type "String" --overwrite --region ${REGION}

echo "✅ Variables subidas exitosamente a AWS Parameter Store"
echo "🔍 Verifica con: aws ssm get-parameters-by-path --path '/hospital/${ENV}' --region ${REGION}"
