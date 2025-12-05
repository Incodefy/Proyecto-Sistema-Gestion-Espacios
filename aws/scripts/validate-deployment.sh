#!/bin/bash
# ============================================================================
# Validación de Deployment - Seguridad Serverless
# ============================================================================
# Script para validar que todas las configuraciones de seguridad estén
# correctamente implementadas después del deployment.
#
# Uso: bash validate-deployment.sh [stage]
# Ejemplo: bash validate-deployment.sh dev
# ============================================================================

set -e

STAGE=${1:-dev}
REGION="us-east-2"
SERVICE_NAME="hospital-aws"

echo "=================================================="
echo "🔍 VALIDACIÓN DE DEPLOYMENT - SEGURIDAD"
echo "=================================================="
echo "Stage: $STAGE"
echo "Region: $REGION"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Función para verificar
check() {
    local test_name=$1
    local command=$2
    
    echo -n "Verificando $test_name... "
    
    if eval $command > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

# Función para verificar con output
check_with_output() {
    local test_name=$1
    local command=$2
    local expected=$3
    
    echo -n "Verificando $test_name... "
    
    result=$(eval $command 2>&1 || echo "ERROR")
    
    if [[ "$result" == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Esperado: $expected"
        echo "  Obtenido: $result"
        ((FAILED++))
        return 1
    fi
}

echo "=================================================="
echo "1. VERIFICANDO TABLAS DYNAMODB"
echo "=================================================="
echo ""

TABLES=(
    "parameters"
    "activity-logs"
    "processed-messages"
    "groups"
    "group-members"
    "group-invitations"
    "role-mappings"
    "spaces"
    "occupants"
    "especialidades"
    "tipos-instrumentos"
    "instrumentos"
    "appointments"
    "notifications"
    "websocket-connections"
)

for table in "${TABLES[@]}"; do
    TABLE_NAME="${SERVICE_NAME}-${STAGE}-${table}"
    
    # Verificar que la tabla existe
    check "Tabla $table existe" \
        "aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION"
    
    # Verificar SSE (KMS encryption)
    check "KMS encryption en $table" \
        "aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION | grep -q 'SSEType.*KMS'"
done

echo ""
echo "=================================================="
echo "2. VERIFICANDO AWS SECRETS MANAGER"
echo "=================================================="
echo ""

SECRET_NAME="hospital/${STAGE}/app-secrets"

check "Secret existe" \
    "aws secretsmanager describe-secret --secret-id $SECRET_NAME --region $REGION"

check "Secret tiene SES_FROM_EMAIL" \
    "aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION | grep -q 'SES_FROM_EMAIL'"

check "Secret tiene APP_URL" \
    "aws secretsmanager get-secret-value --secret-id $SECRET_NAME --region $REGION | grep -q 'APP_URL'"

echo ""
echo "=================================================="
echo "3. VERIFICANDO KMS KEY"
echo "=================================================="
echo ""

check "KMS Key existe" \
    "aws kms list-aliases --region $REGION | grep -q 'hospital-kms-key'"

check "KMS Key está habilitada" \
    "aws kms describe-key --key-id alias/hospital-kms-key --region $REGION | grep -q 'Enabled.*true'"

echo ""
echo "=================================================="
echo "4. VERIFICANDO LAMBDAS"
echo "=================================================="
echo ""

# Verificar algunas funciones lambda críticas
FUNCTIONS=(
    "login"
    "createGroup"
    "inviteMember"
    "crearOcupante"
    "health"
)

for func in "${FUNCTIONS[@]}"; do
    FUNCTION_NAME="${SERVICE_NAME}-${STAGE}-${func}"
    
    check "Lambda $func existe" \
        "aws lambda get-function --function-name $FUNCTION_NAME --region $REGION"
    
    # Verificar que tiene permisos de Secrets Manager
    check "Lambda $func tiene permisos Secrets Manager" \
        "aws lambda get-function --function-name $FUNCTION_NAME --region $REGION | grep -q 'secretsmanager'"
    
    # Verificar variable de entorno SECRET_NAME
    check "Lambda $func tiene SECRET_NAME env var" \
        "aws lambda get-function-configuration --function-name $FUNCTION_NAME --region $REGION | grep -q 'SECRET_NAME'"
done

echo ""
echo "=================================================="
echo "5. VERIFICANDO API GATEWAY"
echo "=================================================="
echo ""

# Encontrar API Gateway
API_ID=$(aws apigatewayv2 get-apis --region $REGION | jq -r ".Items[] | select(.Name == \"${SERVICE_NAME}-${STAGE}\") | .ApiId")

if [ -n "$API_ID" ]; then
    echo -e "${GREEN}✓ API Gateway encontrado: $API_ID${NC}"
    ((PASSED++))
    
    # Verificar CORS
    check "CORS configurado" \
        "aws apigatewayv2 get-api --api-id $API_ID --region $REGION | grep -q 'CorsConfiguration'"
else
    echo -e "${RED}✗ API Gateway no encontrado${NC}"
    ((FAILED++))
fi

echo ""
echo "=================================================="
echo "6. VERIFICANDO WAF (Si está configurado)"
echo "=================================================="
echo ""

WAF_NAME="hospital-${STAGE}-waf"

if aws wafv2 list-web-acls --scope REGIONAL --region $REGION | grep -q "$WAF_NAME"; then
    echo -e "${GREEN}✓ WAF configurado${NC}"
    ((PASSED++))
    
    # Verificar reglas de rate limiting
    check "WAF tiene reglas de rate limiting" \
        "aws wafv2 list-web-acls --scope REGIONAL --region $REGION | grep -q 'RateLimit'"
else
    echo -e "${YELLOW}⚠ WAF no encontrado (opcional)${NC}"
fi

echo ""
echo "=================================================="
echo "7. VERIFICANDO CLOUDTRAIL (Si está configurado)"
echo "=================================================="
echo ""

TRAIL_NAME="hospital-${STAGE}-trail"

if aws cloudtrail describe-trails --region $REGION | grep -q "$TRAIL_NAME"; then
    echo -e "${GREEN}✓ CloudTrail configurado${NC}"
    ((PASSED++))
    
    check "CloudTrail está activo" \
        "aws cloudtrail get-trail-status --name $TRAIL_NAME --region $REGION | grep -q 'IsLogging.*true'"
else
    echo -e "${YELLOW}⚠ CloudTrail no encontrado (opcional)${NC}"
fi

echo ""
echo "=================================================="
echo "8. VERIFICANDO GUARDDUTY (Si está configurado)"
echo "=================================================="
echo ""

if aws guardduty list-detectors --region $REGION | grep -q "DetectorId"; then
    echo -e "${GREEN}✓ GuardDuty configurado${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ GuardDuty no encontrado (opcional)${NC}"
fi

echo ""
echo "=================================================="
echo "9. TESTS FUNCIONALES"
echo "=================================================="
echo ""

# Obtener API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api --api-id $API_ID --region $REGION | jq -r '.ApiEndpoint' 2>/dev/null || echo "")

if [ -n "$API_ENDPOINT" ]; then
    echo "API Endpoint: $API_ENDPOINT"
    echo ""
    
    # Test health endpoint
    echo -n "Test /health endpoint... "
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_ENDPOINT/health" 2>/dev/null || echo "000")
    
    if [ "$HEALTH_STATUS" = "200" ]; then
        echo -e "${GREEN}✓ PASS (HTTP 200)${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL (HTTP $HEALTH_STATUS)${NC}"
        ((FAILED++))
    fi
    
    # Test security headers
    echo -n "Test Security Headers... "
    HEADERS=$(curl -s -I "$API_ENDPOINT/health" 2>/dev/null || echo "")
    
    if echo "$HEADERS" | grep -q "Strict-Transport-Security" && \
       echo "$HEADERS" | grep -q "X-Content-Type-Options" && \
       echo "$HEADERS" | grep -q "X-Frame-Options"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Headers faltantes de seguridad"
        ((FAILED++))
    fi
    
    # Test rate limiting (opcional - puede generar muchas requests)
    # echo -n "Test Rate Limiting... "
    # for i in {1..25}; do
    #     curl -s -o /dev/null "$API_ENDPOINT/health"
    # done
    # RATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_ENDPOINT/health")
    # if [ "$RATE_STATUS" = "429" ]; then
    #     echo -e "${GREEN}✓ PASS (HTTP 429 - Too Many Requests)${NC}"
    #     ((PASSED++))
    # else
    #     echo -e "${YELLOW}⚠ SKIP (No se activó rate limiting)${NC}"
    # fi
else
    echo -e "${YELLOW}⚠ No se puede ejecutar tests funcionales sin API endpoint${NC}"
fi

echo ""
echo "=================================================="
echo "10. RESUMEN DE ARCHIVOS"
echo "=================================================="
echo ""

# Verificar que existen archivos críticos
FILES=(
    "serverless.yml"
    "resources/kms.yml"
    "resources/waf.yml"
    "resources/cloudtrail.yml"
    "resources/guardduty.yml"
    "src/utils/secretsManager.js"
    "src/utils/sanitizer.js"
    "src/middleware/rateLimiter.js"
    "src/middleware/securityHeaders.js"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ $file (NO ENCONTRADO)${NC}"
        ((FAILED++))
    fi
done

echo ""
echo "=================================================="
echo "📊 RESULTADO FINAL"
echo "=================================================="
echo ""

TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))

echo "Tests ejecutados: $TOTAL"
echo -e "Tests pasados: ${GREEN}$PASSED${NC}"
echo -e "Tests fallidos: ${RED}$FAILED${NC}"
echo ""
echo -e "Porcentaje de éxito: ${GREEN}${PERCENTAGE}%${NC}"

echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=================================================="
    echo "✅ DEPLOYMENT VALIDADO EXITOSAMENTE"
    echo "=================================================="
    echo -e "${NC}"
    echo "Todas las verificaciones de seguridad pasaron."
    echo "El sistema está listo para producción."
    exit 0
elif [ $PERCENTAGE -ge 80 ]; then
    echo -e "${YELLOW}=================================================="
    echo "⚠️ DEPLOYMENT PARCIALMENTE VALIDADO"
    echo "=================================================="
    echo -e "${NC}"
    echo "Algunas verificaciones fallaron, pero el deployment"
    echo "puede ser funcional. Revisa los errores arriba."
    exit 0
else
    echo -e "${RED}=================================================="
    echo "❌ DEPLOYMENT CON PROBLEMAS CRÍTICOS"
    echo "=================================================="
    echo -e "${NC}"
    echo "Demasiados tests fallaron. Revisa la configuración"
    echo "antes de usar en producción."
    exit 1
fi
