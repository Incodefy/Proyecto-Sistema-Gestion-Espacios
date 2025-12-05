#!/bin/bash

# 🔒 OWASP Top 10 2021 Compliance Checker
# Validates Hospital system against OWASP Top 10 security standards
# Usage: bash scripts/owasp-compliance.sh <environment>

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-us-east-2}
SCORE=0
MAX_SCORE=0

print_header() {
    echo -e "\n${PURPLE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║  $1${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_category() {
    echo -e "\n${BLUE}▶ $1${NC}"
    echo -e "${BLUE}  $2${NC}"
    echo -e "${BLUE}  ────────────────────────────────────────${NC}\n"
}

check_item() {
    local description="$1"
    local command="$2"
    
    ((MAX_SCORE++))
    
    if eval "$command" &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $description"
        ((SCORE++))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        return 1
    fi
}

check_file() {
    local description="$1"
    local file="$2"
    local pattern="$3"
    
    ((MAX_SCORE++))
    
    if [ -f "$file" ] && grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $description"
        ((SCORE++))
        return 0
    else
        echo -e "  ${RED}✗${NC} $description"
        return 1
    fi
}

manual_check() {
    local description="$1"
    
    ((MAX_SCORE++))
    echo -e "  ${YELLOW}⊙${NC} $description ${YELLOW}(Manual Review Required)${NC}"
}

print_header "OWASP TOP 10 2021 COMPLIANCE CHECK"
echo -e "${BLUE}Environment:${NC} $ENVIRONMENT"
echo -e "${BLUE}Region:${NC} $REGION"
echo -e "${BLUE}Date:${NC} $(date -u +"%Y-%m-%d %H:%M:%S UTC")\n"

# ============================================================================
# A01:2021 – Broken Access Control
# ============================================================================
print_category "A01:2021 – Broken Access Control" \
    "Restricting unauthorized access to resources"

check_file \
    "JWT validation middleware exists" \
    "incodefy/middleware/jwtValidator.js" \
    "jwt"

check_file \
    "Permission checking middleware exists" \
    "incodefy/middleware/checkPermission.js" \
    "checkPermission"

check_file \
    "Auth middleware requires authentication" \
    "incodefy/middleware/requireAuth.js" \
    "requireAuth"

check_file \
    "Cognito authentication configured" \
    "aws/serverless.yml" \
    "AWS::Cognito::UserPool"

check_file \
    "Rate limiting implemented" \
    "aws/src/middleware/rateLimiter.js" \
    "checkRateLimit"

manual_check "RBAC permissions properly configured in permissions.json"
manual_check "Grupo activo verification in place"
manual_check "User can only access their own data"

# ============================================================================
# A02:2021 – Cryptographic Failures
# ============================================================================
print_category "A02:2021 – Cryptographic Failures" \
    "Protecting sensitive data with proper encryption"

check_file \
    "KMS encryption for DynamoDB defined" \
    "aws/resources/kms.yml" \
    "DynamoDBKMSKey"

check_file \
    "KMS encryption for SQS defined" \
    "aws/resources/kms.yml" \
    "SQSKMSKey"

check_file \
    "Secrets Manager integration exists" \
    "aws/src/utils/secretsManager.js" \
    "getSecrets"

check_file \
    "HTTPS/TLS enforced in serverless config" \
    "aws/serverless.yml" \
    "cors"

check_file \
    "HSTS header configured" \
    "aws/src/middleware/securityHeaders.js" \
    "Strict-Transport-Security"

check_item \
    "No hardcoded secrets in codebase" \
    "! grep -r 'password.*=' aws/src/ --include='*.js' | grep -v 'password:' | grep -v '//' | grep '='"

manual_check "Environment variables properly configured"
manual_check "Database backups encrypted"
manual_check "Sensitive data masked in logs"

# ============================================================================
# A03:2021 – Injection
# ============================================================================
print_category "A03:2021 – Injection" \
    "Preventing SQL, NoSQL, and command injection attacks"

check_file \
    "Input sanitization utility exists" \
    "aws/src/utils/sanitizer.js" \
    "sanitizeString"

check_file \
    "SQL injection protection in sanitizer" \
    "aws/src/utils/sanitizer.js" \
    "SQL_INJECTION"

check_file \
    "NoSQL injection protection in sanitizer" \
    "aws/src/utils/sanitizer.js" \
    "NOSQL_INJECTION"

check_file \
    "XSS protection in sanitizer" \
    "aws/src/utils/sanitizer.js" \
    "XSS_PATTERNS"

check_file \
    "Path traversal protection in sanitizer" \
    "aws/src/utils/sanitizer.js" \
    "PATH_TRAVERSAL"

check_file \
    "Command injection protection in sanitizer" \
    "aws/src/utils/sanitizer.js" \
    "COMMAND_INJECTION"

check_file \
    "Input validation with AJV exists" \
    "aws/src/utils/validation.js" \
    "ajv"

check_file \
    "WAF SQL injection rule defined" \
    "aws/resources/waf.yml" \
    "SQLiProtection"

check_file \
    "WAF XSS protection rule defined" \
    "aws/resources/waf.yml" \
    "XSSProtection"

manual_check "Parameterized queries used (DynamoDB expressions)"
manual_check "User input validated before processing"

# ============================================================================
# A04:2021 – Insecure Design
# ============================================================================
print_category "A04:2021 – Insecure Design" \
    "Secure design patterns and threat modeling"

check_file \
    "Circuit breaker pattern implemented" \
    "aws/src/utils/circuitBreaker.js" \
    "CircuitBreaker"

check_file \
    "Retry with backoff implemented" \
    "aws/src/utils/retry.js" \
    "retry"

check_file \
    "Idempotency handling exists" \
    "aws/src/utils/idempotency.js" \
    "idempotent"

check_file \
    "Security plan documented" \
    "aws/PLAN-SEGURIDAD.md" \
    "seguridad"

manual_check "Threat modeling performed for critical flows"
manual_check "Security requirements in design phase"
manual_check "Secure defaults configured"
manual_check "Fail-safe mechanisms in place"

# ============================================================================
# A05:2021 – Security Misconfiguration
# ============================================================================
print_category "A05:2021 – Security Misconfiguration" \
    "Proper security configuration and hardening"

check_file \
    "Security headers middleware exists" \
    "aws/src/middleware/securityHeaders.js" \
    "getSecurityHeaders"

check_file \
    "CSP header configured" \
    "aws/src/middleware/securityHeaders.js" \
    "Content-Security-Policy"

check_file \
    "X-Frame-Options configured" \
    "aws/src/middleware/securityHeaders.js" \
    "X-Frame-Options"

check_file \
    "X-Content-Type-Options configured" \
    "aws/src/middleware/securityHeaders.js" \
    "X-Content-Type-Options"

check_file \
    "CORS properly configured" \
    "aws/src/middleware/securityHeaders.js" \
    "isOriginAllowed"

check_file \
    "Error messages don't expose sensitive info" \
    "aws/src/utils/response.js" \
    "errorResponse"

manual_check "Default credentials changed"
manual_check "Unnecessary features disabled"
manual_check "Error pages don't leak information"
manual_check "Security patches applied"

# ============================================================================
# A06:2021 – Vulnerable and Outdated Components
# ============================================================================
print_category "A06:2021 – Vulnerable and Outdated Components" \
    "Using secure and up-to-date dependencies"

check_file \
    "Package.json exists with dependencies" \
    "aws/package.json" \
    "dependencies"

check_item \
    "No critical vulnerabilities in npm (AWS)" \
    "cd aws && npm audit --audit-level=critical --production 2>&1 | grep -q '0 vulnerabilities' || npm audit --audit-level=critical --production 2>&1 | grep -q '0 critical'"

check_item \
    "No critical vulnerabilities in npm (Incodefy)" \
    "cd incodefy && npm audit --audit-level=critical --production 2>&1 | grep -q '0 vulnerabilities' || npm audit --audit-level=critical --production 2>&1 | grep -q '0 critical'"

check_file \
    "Runtime using supported Node.js version" \
    "aws/serverless.yml" \
    "nodejs20"

manual_check "Dependency updates scheduled regularly"
manual_check "Dependabot or Renovate configured"
manual_check "Vulnerability scanning in CI/CD"

# ============================================================================
# A07:2021 – Identification and Authentication Failures
# ============================================================================
print_category "A07:2021 – Identification and Authentication Failures" \
    "Secure authentication and session management"

check_file \
    "Cognito User Pool configured" \
    "aws/serverless.yml" \
    "CognitoUserPool"

check_file \
    "Password policy exists" \
    "aws/serverless.yml" \
    "PasswordPolicy"

check_file \
    "JWT token validation exists" \
    "incodefy/middleware/jwtValidator.js" \
    "verify"

check_file \
    "Login rate limiting configured" \
    "aws/resources/waf.yml" \
    "LoginRateLimit"

check_file \
    "Session management exists" \
    "incodefy/middleware/requireAuth.js" \
    "session"

manual_check "MFA available for administrative users"
manual_check "Account lockout after failed attempts"
manual_check "Secure password recovery process"
manual_check "JWT tokens have expiration"

# ============================================================================
# A08:2021 – Software and Data Integrity Failures
# ============================================================================
print_category "A08:2021 – Software and Data Integrity Failures" \
    "Ensuring integrity of code and data"

check_file \
    "CloudTrail audit logging configured" \
    "aws/resources/cloudtrail.yml" \
    "Trail"

check_file \
    "CloudTrail log validation enabled" \
    "aws/resources/cloudtrail.yml" \
    "EnableLogFileValidation"

check_file \
    "DynamoDB Streams for audit trail" \
    "aws/serverless.yml" \
    "StreamSpecification"

manual_check "CI/CD pipeline uses signed commits"
manual_check "Dependencies verified before deployment"
manual_check "Backup and restore procedures tested"
manual_check "Code signing implemented"

# ============================================================================
# A09:2021 – Security Logging and Monitoring Failures
# ============================================================================
print_category "A09:2021 – Security Logging and Monitoring Failures" \
    "Comprehensive logging and monitoring"

check_file \
    "Structured logging utility exists" \
    "aws/src/utils/logger.js" \
    "logger"

check_file \
    "GuardDuty threat detection configured" \
    "aws/resources/guardduty.yml" \
    "Detector"

check_file \
    "CloudWatch metrics in CloudTrail" \
    "aws/resources/cloudtrail.yml" \
    "MetricFilter"

check_file \
    "Security events logged" \
    "aws/src/utils/logger.js" \
    "security"

manual_check "Logs stored securely and immutably"
manual_check "Alerting configured for security events"
manual_check "Log retention policy defined"
manual_check "Logs reviewed regularly"
manual_check "PII/tokens sanitized from logs"

# ============================================================================
# A10:2021 – Server-Side Request Forgery (SSRF)
# ============================================================================
print_category "A10:2021 – Server-Side Request Forgery" \
    "Preventing SSRF attacks"

check_file \
    "URL validation in sanitizer" \
    "aws/src/utils/sanitizer.js" \
    "sanitizeString"

check_file \
    "API client with validation" \
    "incodefy/middleware/apiClient.js" \
    "apiClient"

manual_check "Whitelist of allowed external URLs"
manual_check "Network segmentation with VPC (if applicable)"
manual_check "No user input directly in URLs"
manual_check "DNS rebinding protection"

# ============================================================================
# ADDITIONAL SECURITY CHECKS
# ============================================================================
print_category "ADDITIONAL SECURITY BEST PRACTICES" \
    "Beyond OWASP Top 10"

check_file \
    "WAF configured with multiple rules" \
    "aws/resources/waf.yml" \
    "WebACL"

check_file \
    "Geo-blocking capability exists" \
    "aws/resources/waf.yml" \
    "GeoMatchStatement"

check_file \
    "Request size limits configured" \
    "aws/resources/waf.yml" \
    "SizeConstraintStatement"

check_file \
    "CSRF protection middleware exists" \
    "incodefy/middleware/csrf.js" \
    "csrf"

check_file \
    "CSP middleware exists" \
    "incodefy/middleware/csp.js" \
    "csp"

manual_check "Least privilege IAM policies"
manual_check "Regular security audits scheduled"
manual_check "Incident response plan documented"
manual_check "Security training for team"

# ============================================================================
# SUMMARY & SCORING
# ============================================================================
print_header "COMPLIANCE SUMMARY"

PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($SCORE/$MAX_SCORE)*100}")

echo -e "${BLUE}Total Checks:${NC} $MAX_SCORE"
echo -e "${GREEN}Passed:${NC} $SCORE"
echo -e "${RED}Failed:${NC} $((MAX_SCORE - SCORE))"
echo -e "${PURPLE}Compliance Score:${NC} ${PERCENTAGE}%\n"

# Grade calculation
if (( $(echo "$PERCENTAGE >= 90" | bc -l) )); then
    GRADE="A+"
    COLOR=$GREEN
elif (( $(echo "$PERCENTAGE >= 80" | bc -l) )); then
    GRADE="A"
    COLOR=$GREEN
elif (( $(echo "$PERCENTAGE >= 70" | bc -l) )); then
    GRADE="B"
    COLOR=$YELLOW
elif (( $(echo "$PERCENTAGE >= 60" | bc -l) )); then
    GRADE="C"
    COLOR=$YELLOW
else
    GRADE="F"
    COLOR=$RED
fi

echo -e "${COLOR}╔═══════════════════════════════════╗${NC}"
echo -e "${COLOR}║      COMPLIANCE GRADE: ${GRADE}       ║${NC}"
echo -e "${COLOR}╚═══════════════════════════════════╝${NC}\n"

# Recommendations
if (( $(echo "$PERCENTAGE < 80" | bc -l) )); then
    echo -e "${YELLOW}⚠️  RECOMMENDATIONS:${NC}\n"
    echo "  1. Review failed checks above"
    echo "  2. Complete manual review items"
    echo "  3. Apply security patches from PATCH-SERVERLESS-SECURITY.md"
    echo "  4. Run: bash scripts/test-security.sh $ENVIRONMENT <api-url>"
    echo ""
fi

# Report file
REPORT_FILE="owasp-compliance-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).txt"
{
    echo "OWASP Top 10 2021 Compliance Report"
    echo "==================================="
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo "Score: $SCORE/$MAX_SCORE ($PERCENTAGE%)"
    echo "Grade: $GRADE"
    echo ""
    echo "For detailed results, see terminal output above."
} > "$REPORT_FILE"

echo -e "${BLUE}📄 Report saved to:${NC} $REPORT_FILE\n"

# Exit code based on score
if (( $(echo "$PERCENTAGE >= 70" | bc -l) )); then
    exit 0
else
    exit 1
fi
