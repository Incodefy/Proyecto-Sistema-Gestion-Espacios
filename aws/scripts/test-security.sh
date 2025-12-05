#!/bin/bash

# 🔒 Security Testing Script
# Tests all security implementations for the Hospital system
# Usage: bash scripts/test-security.sh <environment> <api-url>
# Example: bash scripts/test-security.sh dev https://abc123.execute-api.us-east-2.amazonaws.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config
ENVIRONMENT=${1:-dev}
API_URL=${2}
REGION=${AWS_REGION:-us-east-2}
TEST_RESULTS=()
PASS_COUNT=0
FAIL_COUNT=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TEST_RESULTS+=("✅ $1")
    ((PASS_COUNT++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TEST_RESULTS+=("❌ $1")
    ((FAIL_COUNT++))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Validate inputs
if [ -z "$API_URL" ]; then
    echo -e "${RED}Error: API URL is required${NC}"
    echo "Usage: bash scripts/test-security.sh <environment> <api-url>"
    exit 1
fi

print_header "🔒 HOSPITAL SECURITY VALIDATION - ${ENVIRONMENT^^}"
print_info "API URL: $API_URL"
print_info "Region: $REGION"
print_info "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"

# ============================================================================
# TEST 1: AWS Secrets Manager
# ============================================================================
print_header "TEST 1: AWS Secrets Manager"

print_test "Checking if secrets exist..."
SECRET_ID="hospital/${ENVIRONMENT}/app-secrets"

if aws secretsmanager describe-secret \
    --secret-id "$SECRET_ID" \
    --region "$REGION" \
    --output json &>/dev/null; then
    print_pass "Secrets Manager: Secret exists ($SECRET_ID)"
else
    print_fail "Secrets Manager: Secret NOT found ($SECRET_ID)"
fi

print_test "Validating secret structure..."
SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ID" \
    --region "$REGION" \
    --query SecretString \
    --output text 2>/dev/null || echo "{}")

# Check required fields
REQUIRED_KEYS=("JWT_SECRET" "SES_FROM_EMAIL" "APP_URL")
for key in "${REQUIRED_KEYS[@]}"; do
    if echo "$SECRET_VALUE" | jq -e ".$key" &>/dev/null && \
       [ "$(echo "$SECRET_VALUE" | jq -r ".$key")" != "null" ] && \
       [ "$(echo "$SECRET_VALUE" | jq -r ".$key")" != "" ]; then
        print_pass "Secret contains required key: $key"
    else
        print_fail "Secret missing or empty key: $key"
    fi
done

# ============================================================================
# TEST 2: KMS Encryption
# ============================================================================
print_header "TEST 2: KMS Encryption"

print_test "Checking KMS keys..."

# Find KMS key alias
KMS_ALIAS="alias/hospital-${ENVIRONMENT}-dynamodb"
if aws kms describe-key \
    --key-id "$KMS_ALIAS" \
    --region "$REGION" \
    --output json &>/dev/null; then
    
    KEY_ID=$(aws kms describe-key \
        --key-id "$KMS_ALIAS" \
        --region "$REGION" \
        --query 'KeyMetadata.KeyId' \
        --output text)
    
    print_pass "KMS key exists: $KMS_ALIAS"
    
    # Check key rotation
    ROTATION=$(aws kms get-key-rotation-status \
        --key-id "$KEY_ID" \
        --region "$REGION" \
        --query 'KeyRotationEnabled' \
        --output text)
    
    if [ "$ROTATION" == "True" ]; then
        print_pass "KMS key rotation enabled"
    else
        print_fail "KMS key rotation NOT enabled"
    fi
else
    print_fail "KMS key NOT found: $KMS_ALIAS"
fi

# Check DynamoDB tables encryption
print_test "Checking DynamoDB encryption..."
TABLES=("Hospital-Users-${ENVIRONMENT}" "Hospital-Patients-${ENVIRONMENT}")

for table in "${TABLES[@]}"; do
    if aws dynamodb describe-table \
        --table-name "$table" \
        --region "$REGION" \
        --output json &>/dev/null; then
        
        ENCRYPTION=$(aws dynamodb describe-table \
            --table-name "$table" \
            --region "$REGION" \
            --query 'Table.SSEDescription.Status' \
            --output text 2>/dev/null || echo "NONE")
        
        if [ "$ENCRYPTION" == "ENABLED" ]; then
            print_pass "Table encrypted: $table"
        else
            print_fail "Table NOT encrypted: $table"
        fi
    else
        print_info "Table not found (may not exist yet): $table"
    fi
done

# ============================================================================
# TEST 3: AWS WAF
# ============================================================================
print_header "TEST 3: AWS WAF"

print_test "Checking WAF configuration..."

# List all WAFs
WAF_NAME="HospitalWAF-${ENVIRONMENT}"
WAF_ARN=$(aws wafv2 list-web-acls \
    --scope REGIONAL \
    --region "$REGION" \
    --query "WebACLs[?Name=='$WAF_NAME'].ARN | [0]" \
    --output text 2>/dev/null || echo "")

if [ -n "$WAF_ARN" ] && [ "$WAF_ARN" != "None" ]; then
    print_pass "WAF exists: $WAF_NAME"
    
    # Check rules
    print_test "Validating WAF rules..."
    RULES=$(aws wafv2 get-web-acl \
        --id "${WAF_ARN##*/}" \
        --name "$WAF_NAME" \
        --scope REGIONAL \
        --region "$REGION" \
        --query 'WebACL.Rules[].Name' \
        --output json 2>/dev/null || echo "[]")
    
    RULE_COUNT=$(echo "$RULES" | jq '. | length')
    
    if [ "$RULE_COUNT" -ge 5 ]; then
        print_pass "WAF has $RULE_COUNT rules configured"
    else
        print_fail "WAF has only $RULE_COUNT rules (expected >= 5)"
    fi
    
    # Check specific rules
    EXPECTED_RULES=("GlobalRateLimit" "LoginRateLimit" "SQLiProtection" "XSSProtection")
    for rule in "${EXPECTED_RULES[@]}"; do
        if echo "$RULES" | jq -e ". | index(\"$rule\")" &>/dev/null; then
            print_pass "WAF rule configured: $rule"
        else
            print_fail "WAF rule missing: $rule"
        fi
    done
else
    print_fail "WAF NOT found: $WAF_NAME"
fi

# ============================================================================
# TEST 4: CloudTrail
# ============================================================================
print_header "TEST 4: CloudTrail Audit Logging"

print_test "Checking CloudTrail configuration..."

TRAIL_NAME="hospital-${ENVIRONMENT}-trail"
TRAIL_STATUS=$(aws cloudtrail get-trail-status \
    --name "$TRAIL_NAME" \
    --region "$REGION" \
    --query 'IsLogging' \
    --output text 2>/dev/null || echo "false")

if [ "$TRAIL_STATUS" == "True" ]; then
    print_pass "CloudTrail is logging: $TRAIL_NAME"
    
    # Check if multi-region
    TRAIL_INFO=$(aws cloudtrail describe-trails \
        --trail-name-list "$TRAIL_NAME" \
        --region "$REGION" \
        --output json 2>/dev/null || echo "{}")
    
    IS_MULTIREGION=$(echo "$TRAIL_INFO" | jq -r '.trailList[0].IsMultiRegionTrail // false')
    
    if [ "$IS_MULTIREGION" == "true" ]; then
        print_pass "CloudTrail is multi-region enabled"
    else
        print_fail "CloudTrail is NOT multi-region"
    fi
else
    print_fail "CloudTrail is NOT logging or not found: $TRAIL_NAME"
fi

# ============================================================================
# TEST 5: GuardDuty
# ============================================================================
print_header "TEST 5: GuardDuty Threat Detection"

print_test "Checking GuardDuty status..."

DETECTOR_ID=$(aws guardduty list-detectors \
    --region "$REGION" \
    --query 'DetectorIds[0]' \
    --output text 2>/dev/null || echo "")

if [ -n "$DETECTOR_ID" ] && [ "$DETECTOR_ID" != "None" ]; then
    DETECTOR_STATUS=$(aws guardduty get-detector \
        --detector-id "$DETECTOR_ID" \
        --region "$REGION" \
        --query 'Status' \
        --output text 2>/dev/null || echo "DISABLED")
    
    if [ "$DETECTOR_STATUS" == "ENABLED" ]; then
        print_pass "GuardDuty is enabled"
        
        # Check finding frequency
        FREQUENCY=$(aws guardduty get-detector \
            --detector-id "$DETECTOR_ID" \
            --region "$REGION" \
            --query 'FindingPublishingFrequency' \
            --output text 2>/dev/null || echo "")
        
        print_info "Finding frequency: $FREQUENCY"
    else
        print_fail "GuardDuty is DISABLED"
    fi
else
    print_fail "GuardDuty detector NOT found"
fi

# ============================================================================
# TEST 6: API Security Headers
# ============================================================================
print_header "TEST 6: Security Headers"

print_test "Testing security headers on API response..."

# Test health endpoint (should be public)
HEADERS_FILE=$(mktemp)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -D "$HEADERS_FILE" \
    "${API_URL}/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
    print_pass "API is reachable (HTTP $HTTP_CODE)"
    
    # Check specific headers
    EXPECTED_HEADERS=(
        "Strict-Transport-Security"
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Content-Security-Policy"
    )
    
    for header in "${EXPECTED_HEADERS[@]}"; do
        if grep -qi "^${header}:" "$HEADERS_FILE"; then
            print_pass "Header present: $header"
        else
            print_fail "Header missing: $header"
        fi
    done
else
    print_fail "API not reachable (HTTP $HTTP_CODE)"
fi

rm -f "$HEADERS_FILE"

# ============================================================================
# TEST 7: Rate Limiting
# ============================================================================
print_header "TEST 7: Rate Limiting"

print_test "Testing rate limiting (sending 15 rapid requests)..."

# Create test payload
TEST_PAYLOAD='{"username":"testuser","password":"testpass"}'

BLOCKED=false
for i in {1..15}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" \
        "${API_URL}/auth/login" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" == "429" ]; then
        BLOCKED=true
        break
    fi
    
    # Small delay to avoid network issues
    sleep 0.1
done

if [ "$BLOCKED" == true ]; then
    print_pass "Rate limiting is working (got 429 after $i requests)"
else
    print_fail "Rate limiting NOT working (no 429 after 15 requests)"
fi

# ============================================================================
# TEST 8: Input Sanitization
# ============================================================================
print_header "TEST 8: Input Sanitization & WAF Protection"

print_test "Testing SQL injection protection..."

SQL_PAYLOAD='{"name":"test'"'"' OR 1=1--","description":"test"}'
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$SQL_PAYLOAD" \
    "${API_URL}/groups" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "403" ] || [ "$HTTP_CODE" == "400" ]; then
    print_pass "SQL injection blocked (HTTP $HTTP_CODE)"
else
    print_fail "SQL injection NOT blocked (HTTP $HTTP_CODE)"
fi

print_test "Testing XSS protection..."

XSS_PAYLOAD='{"name":"<script>alert(1)</script>","description":"test"}'
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$XSS_PAYLOAD" \
    "${API_URL}/groups" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "403" ] || [ "$HTTP_CODE" == "400" ]; then
    print_pass "XSS attack blocked (HTTP $HTTP_CODE)"
else
    print_fail "XSS attack NOT blocked (HTTP $HTTP_CODE)"
fi

# ============================================================================
# TEST 9: CORS Configuration
# ============================================================================
print_header "TEST 9: CORS Configuration"

print_test "Testing CORS headers..."

CORS_HEADERS=$(curl -s -I \
    -H "Origin: https://malicious-site.com" \
    "${API_URL}/health" 2>/dev/null | grep -i "access-control" || echo "")

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin: \*"; then
    print_fail "CORS allows wildcard (*) - security risk!"
elif echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin:"; then
    ORIGIN=$(echo "$CORS_HEADERS" | grep -i "access-control-allow-origin:" | cut -d: -f2- | tr -d ' \r')
    print_pass "CORS is configured (Origin: $ORIGIN)"
else
    print_info "CORS headers not present (may be handled by API Gateway)"
fi

# ============================================================================
# TEST 10: IAM Permissions
# ============================================================================
print_header "TEST 10: IAM Best Practices"

print_test "Checking Lambda execution role..."

# This requires the function name - try common pattern
FUNCTION_NAME="hospital-${ENVIRONMENT}-login"

if aws lambda get-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --output json &>/dev/null; then
    
    ROLE_ARN=$(aws lambda get-function \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION" \
        --query 'Configuration.Role' \
        --output text 2>/dev/null || echo "")
    
    if [ -n "$ROLE_ARN" ]; then
        print_pass "Lambda has execution role configured"
        
        # Check if role has inline policies (not recommended)
        ROLE_NAME=$(echo "$ROLE_ARN" | rev | cut -d/ -f1 | rev)
        INLINE_POLICIES=$(aws iam list-role-policies \
            --role-name "$ROLE_NAME" \
            --query 'PolicyNames | length(@)' \
            --output text 2>/dev/null || echo "0")
        
        if [ "$INLINE_POLICIES" -gt 0 ]; then
            print_info "Role has $INLINE_POLICIES inline policies (consider using managed policies)"
        else
            print_pass "Role uses managed policies (best practice)"
        fi
    fi
else
    print_info "Lambda function not found (may not be deployed yet): $FUNCTION_NAME"
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_header "📊 TEST SUMMARY"

TOTAL_TESTS=$((PASS_COUNT + FAIL_COUNT))
PASS_PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($PASS_COUNT/$TOTAL_TESTS)*100}")

echo -e "\n${GREEN}Passed:${NC} $PASS_COUNT"
echo -e "${RED}Failed:${NC} $FAIL_COUNT"
echo -e "${BLUE}Total:${NC}  $TOTAL_TESTS"
echo -e "${BLUE}Score:${NC}  ${PASS_PERCENTAGE}%\n"

# Print detailed results
echo -e "${BLUE}Detailed Results:${NC}\n"
for result in "${TEST_RESULTS[@]}"; do
    echo "  $result"
done

# Exit code
if [ "$FAIL_COUNT" -gt 0 ]; then
    echo -e "\n${RED}⚠️  Some security tests failed. Please review and fix.${NC}\n"
    exit 1
else
    echo -e "\n${GREEN}✅ All security tests passed!${NC}\n"
    exit 0
fi
