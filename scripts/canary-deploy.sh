#!/bin/bash
# ========================================
# Canary Deployment Script for Lambda
# ========================================

set -e

STAGE=${1:-"dev"}
FUNCTION_NAME=${2:-"login"}
CANARY_PERCENTAGE=${3:-10}

echo "=================================="
echo "Lambda Canary Deployment"
echo "=================================="
echo "Stage: $STAGE"
echo "Function: $FUNCTION_NAME"
echo "Canary: ${CANARY_PERCENTAGE}%"
echo "=================================="
echo ""

cd ../aws

# Install plugin if not present
if ! npm list serverless-plugin-canary-deployments &>/dev/null; then
  echo "📦 Installing serverless-plugin-canary-deployments..."
  npm install --save-dev serverless-plugin-canary-deployments
fi

echo "🚀 Step 1: Deploying with Canary configuration..."
serverless deploy --stage $STAGE

echo ""
echo "✅ Deployment initiated!"
echo ""

# Get function ARN
FUNCTION_ARN=$(aws lambda get-function \
  --function-name inco-${STAGE}-${FUNCTION_NAME} \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "Function ARN: $FUNCTION_ARN"
echo ""

# Get alias
ALIAS_ARN="${FUNCTION_ARN}:Live"

echo "📊 Step 2: Monitoring deployment..."
echo "Alias: Live"
echo ""

# Monitor for 10 minutes
for i in {1..20}; do
  echo "⏳ Checking status (${i}/20)..."
  
  # Get alias configuration
  ALIAS_INFO=$(aws lambda get-alias \
    --function-name inco-${STAGE}-${FUNCTION_NAME} \
    --name Live \
    --output json 2>/dev/null || echo "{}")
  
  if [ "$ALIAS_INFO" != "{}" ]; then
    FUNCTION_VERSION=$(echo $ALIAS_INFO | jq -r '.FunctionVersion')
    ROUTING_CONFIG=$(echo $ALIAS_INFO | jq -r '.RoutingConfig.AdditionalVersionWeights // {}')
    
    echo "  Current Version: $FUNCTION_VERSION"
    
    if [ "$ROUTING_CONFIG" != "{}" ]; then
      echo "  Canary Routing: $ROUTING_CONFIG"
    else
      echo "  ✅ Traffic fully migrated to new version"
      break
    fi
  fi
  
  sleep 30
done

echo ""
echo "📈 Step 3: Checking CloudWatch Metrics..."

# Get metrics for last 5 minutes
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
START_TIME=$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S)

ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=inco-${STAGE}-${FUNCTION_NAME} \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text)

INVOCATIONS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=inco-${STAGE}-${FUNCTION_NAME} \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text)

THROTTLES=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=inco-${STAGE}-${FUNCTION_NAME} \
  --start-time $START_TIME \
  --end-time $END_TIME \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text)

echo ""
echo "📊 Metrics (last 5 minutes):"
echo "  Invocations: ${INVOCATIONS:-0}"
echo "  Errors: ${ERRORS:-0}"
echo "  Throttles: ${THROTTLES:-0}"
echo ""

if [ "${ERRORS:-0}" = "0" ] && [ "${THROTTLES:-0}" = "0" ]; then
  echo "🎉 Canary deployment SUCCESSFUL!"
  echo "   - No errors detected"
  echo "   - No throttles detected"
  echo "   - Ready for production traffic"
else
  echo "⚠️  Deployment completed but metrics show issues:"
  echo "   - Errors: ${ERRORS:-0}"
  echo "   - Throttles: ${THROTTLES:-0}"
  echo "   - Review CloudWatch Logs for details"
fi

echo ""
echo "=================================="
echo "Deployment Complete!"
echo "=================================="
