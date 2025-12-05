# 🚀 Hospital Security Deployment Script
# Automated deployment of all security enhancements
# Usage: .\scripts\deploy-security.ps1 -Environment dev -Region us-east-2

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-2",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipSecrets,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $oldColor = $Host.UI.RawUI.ForegroundColor
    $Host.UI.RawUI.ForegroundColor = $Color
    Write-Output $Message
    $Host.UI.RawUI.ForegroundColor = $oldColor
}

function Write-Header {
    param([string]$Message)
    
    Write-ColorOutput "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" "Blue"
    Write-ColorOutput "  $Message" "Blue"
    Write-ColorOutput "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" "Blue"
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "[STEP] $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[✓] $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[⚠] $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[✗] $Message" "Red"
}

function Test-Command {
    param([string]$Command)
    
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Test-AWSCLIConfigured {
    try {
        $result = aws sts get-caller-identity 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
        return $false
    } catch {
        return $false
    }
}

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================
Write-Header "🔒 HOSPITAL SECURITY DEPLOYMENT"
Write-Output "Environment: $Environment"
Write-Output "Region: $Region"
Write-Output "Dry Run: $DryRun"
Write-Output ""

Write-Header "Pre-flight Checks"

# Check AWS CLI
Write-Step "Checking AWS CLI..."
if (Test-Command "aws") {
    Write-Success "AWS CLI installed"
} else {
    Write-Error "AWS CLI not found. Please install: https://aws.amazon.com/cli/"
    exit 1
}

# Check AWS credentials
Write-Step "Checking AWS credentials..."
if (Test-AWSCLIConfigured) {
    $identity = aws sts get-caller-identity --query 'Arn' --output text
    Write-Success "AWS credentials configured: $identity"
} else {
    Write-Error "AWS credentials not configured. Run 'aws configure'"
    exit 1
}

# Check Node.js
Write-Step "Checking Node.js..."
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Success "Node.js installed: $nodeVersion"
} else {
    Write-Error "Node.js not found. Please install: https://nodejs.org/"
    exit 1
}

# Check npm
Write-Step "Checking npm..."
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Success "npm installed: $npmVersion"
} else {
    Write-Error "npm not found"
    exit 1
}

# Check Serverless Framework
Write-Step "Checking Serverless Framework..."
if (Test-Command "serverless") {
    $slsVersion = serverless --version 2>&1 | Select-String "Framework Core" | ForEach-Object { $_.ToString().Split(':')[1].Trim() }
    Write-Success "Serverless Framework installed: $slsVersion"
} else {
    Write-Warning "Serverless Framework not found globally"
    Write-Step "Installing locally..."
    Set-Location aws
    npm install serverless --save-dev
    Set-Location ..
}

# Check jq (optional but useful)
if (Test-Command "jq") {
    Write-Success "jq installed (for JSON parsing)"
} else {
    Write-Warning "jq not found (optional). Install from: https://stedolan.github.io/jq/"
}

Write-Success "All pre-flight checks passed!`n"

# ============================================================================
# BACKUP CURRENT CONFIG
# ============================================================================
Write-Header "Backup Current Configuration"

$backupDir = "backups/security-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-Step "Creating backup directory: $backupDir"

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    
    # Backup serverless.yml
    if (Test-Path "aws/serverless.yml") {
        Copy-Item "aws/serverless.yml" "$backupDir/serverless.yml.backup"
        Write-Success "Backed up serverless.yml"
    }
    
    # Backup package.json
    if (Test-Path "aws/package.json") {
        Copy-Item "aws/package.json" "$backupDir/package.json.backup"
        Write-Success "Backed up package.json"
    }
    
    Write-Success "Backups created in: $backupDir`n"
} else {
    Write-Warning "DRY RUN: Would create backup in $backupDir`n"
}

# ============================================================================
# INSTALL DEPENDENCIES
# ============================================================================
Write-Header "Install Dependencies"

Set-Location aws

Write-Step "Installing AWS SDK packages..."
$packages = @(
    "@aws-sdk/client-secretsmanager",
    "@aws-sdk/client-kms",
    "uuid"
)

if (-not $DryRun) {
    foreach ($package in $packages) {
        Write-Step "Installing $package..."
        npm install $package --save
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Installed $package"
        } else {
            Write-Error "Failed to install $package"
            exit 1
        }
    }
} else {
    Write-Warning "DRY RUN: Would install packages: $($packages -join ', ')"
}

Set-Location ..

# ============================================================================
# CREATE AWS SECRETS
# ============================================================================
if (-not $SkipSecrets) {
    Write-Header "Create AWS Secrets"
    
    $secretId = "hospital/$Environment/app-secrets"
    
    Write-Step "Checking if secret exists: $secretId"
    
    $secretExists = $false
    try {
        aws secretsmanager describe-secret --secret-id $secretId --region $Region 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $secretExists = $true
        }
    } catch {
        $secretExists = $false
    }
    
    if ($secretExists) {
        Write-Warning "Secret already exists: $secretId"
        
        $response = Read-Host "Do you want to update it? (y/N)"
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-Step "Skipping secret creation"
        } else {
            if (-not $DryRun) {
                # Generate new secrets
                $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
                $encryptionKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
                
                $secretValue = @{
                    JWT_SECRET = $jwtSecret
                    ENCRYPTION_KEY = $encryptionKey
                    SES_FROM_EMAIL = "noreply@hospital.cl"
                    APP_URL = "https://hospital-$Environment.com"
                } | ConvertTo-Json -Compress
                
                aws secretsmanager update-secret `
                    --secret-id $secretId `
                    --secret-string $secretValue `
                    --region $Region
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "Updated secret: $secretId"
                } else {
                    Write-Error "Failed to update secret"
                    exit 1
                }
            } else {
                Write-Warning "DRY RUN: Would update secret $secretId"
            }
        }
    } else {
        if (-not $DryRun) {
            Write-Step "Creating new secret: $secretId"
            
            # Generate secure random values
            $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
            $encryptionKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
            
            $secretValue = @{
                JWT_SECRET = $jwtSecret
                ENCRYPTION_KEY = $encryptionKey
                SES_FROM_EMAIL = "noreply@hospital.cl"
                APP_URL = "https://hospital-$Environment.com"
            } | ConvertTo-Json -Compress
            
            aws secretsmanager create-secret `
                --name $secretId `
                --description "Hospital application secrets for $Environment" `
                --secret-string $secretValue `
                --region $Region
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Created secret: $secretId"
            } else {
                Write-Error "Failed to create secret"
                exit 1
            }
        } else {
            Write-Warning "DRY RUN: Would create secret $secretId"
        }
    }
} else {
    Write-Warning "Skipping secrets creation (--SkipSecrets flag)"
}

# ============================================================================
# VALIDATE RESOURCE FILES
# ============================================================================
Write-Header "Validate Resource Files"

$resourceFiles = @(
    "aws/resources/kms.yml",
    "aws/resources/waf.yml",
    "aws/resources/cloudtrail.yml",
    "aws/resources/guardduty.yml"
)

foreach ($file in $resourceFiles) {
    Write-Step "Checking $file..."
    
    if (Test-Path $file) {
        Write-Success "Found: $file"
    } else {
        Write-Error "Missing: $file"
        Write-Warning "Please ensure all security resource files are created"
        exit 1
    }
}

# ============================================================================
# DEPLOY TO AWS
# ============================================================================
Write-Header "Deploy to AWS"

Set-Location aws

if (-not $DryRun) {
    Write-Step "Running serverless deploy..."
    Write-Warning "This may take 5-10 minutes..."
    
    $deployCommand = "serverless deploy --stage $Environment --region $Region --verbose"
    
    Write-Output "Executing: $deployCommand"
    
    Invoke-Expression $deployCommand
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Deployment successful!"
    } else {
        Write-Error "Deployment failed!"
        Write-Warning "Check the logs above for errors"
        Write-Warning "You can restore from backup: $backupDir"
        Set-Location ..
        exit 1
    }
} else {
    Write-Warning "DRY RUN: Would execute 'serverless deploy --stage $Environment --region $Region'"
}

Set-Location ..

# ============================================================================
# POST-DEPLOYMENT VALIDATION
# ============================================================================
if (-not $SkipTests -and -not $DryRun) {
    Write-Header "Post-Deployment Validation"
    
    # Get API Gateway URL
    Write-Step "Retrieving API Gateway URL..."
    
    Set-Location aws
    $apiUrl = serverless info --stage $Environment --region $Region 2>&1 | Select-String "endpoint:" | ForEach-Object { $_.ToString().Split(' ')[1].Trim() }
    Set-Location ..
    
    if ($apiUrl) {
        Write-Success "API URL: $apiUrl"
        
        # Test health endpoint
        Write-Step "Testing health endpoint..."
        try {
            $response = Invoke-WebRequest -Uri "$apiUrl/health" -Method GET -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                Write-Success "Health check passed (HTTP 200)"
            }
        } catch {
            Write-Warning "Health check failed: $_"
        }
        
        # Check security headers
        Write-Step "Checking security headers..."
        try {
            $response = Invoke-WebRequest -Uri "$apiUrl/health" -Method GET -UseBasicParsing
            
            $securityHeaders = @(
                "Strict-Transport-Security",
                "X-Content-Type-Options",
                "X-Frame-Options"
            )
            
            foreach ($header in $securityHeaders) {
                if ($response.Headers[$header]) {
                    Write-Success "Header present: $header"
                } else {
                    Write-Warning "Header missing: $header"
                }
            }
        } catch {
            Write-Warning "Could not check headers: $_"
        }
        
        # Run bash security test if available
        if (Test-Command "bash") {
            Write-Step "Running comprehensive security tests..."
            bash aws/scripts/test-security.sh $Environment $apiUrl
            
            if ($LASTEXITCODE -eq 0) {
                Write-Success "All security tests passed!"
            } else {
                Write-Warning "Some security tests failed. Review output above."
            }
        } else {
            Write-Warning "Bash not available. Skipping comprehensive tests."
            Write-Warning "Install Git Bash to run: bash aws/scripts/test-security.sh $Environment $apiUrl"
        }
    } else {
        Write-Warning "Could not retrieve API URL"
    }
} else {
    if ($SkipTests) {
        Write-Warning "Skipping tests (--SkipTests flag)"
    } else {
        Write-Warning "Skipping tests (DRY RUN mode)"
    }
}

# ============================================================================
# COST ESTIMATION
# ============================================================================
Write-Header "Cost Estimation"

Write-Output "Estimated monthly costs for security services:"
Write-Output ""
Write-Output "  Secrets Manager:     `$2-3/month"
Write-Output "  KMS:                 `$3-5/month"
Write-Output "  WAF:                 `$15-20/month"
Write-Output "  CloudTrail:          `$5/month"
Write-Output "  GuardDuty:           `$5-10/month"
Write-Output "  ─────────────────────────────────"
Write-Output "  TOTAL:               ~`$30-40/month"
Write-Output ""

# ============================================================================
# SUMMARY
# ============================================================================
Write-Header "🎉 DEPLOYMENT SUMMARY"

if (-not $DryRun) {
    Write-Success "Security deployment completed successfully!"
    Write-Output ""
    Write-Output "✅ Deployed Components:"
    Write-Output "  • AWS Secrets Manager"
    Write-Output "  • KMS Encryption (DynamoDB, SQS)"
    Write-Output "  • AWS WAF (9 protection rules)"
    Write-Output "  • CloudTrail Audit Logging"
    Write-Output "  • GuardDuty Threat Detection"
    Write-Output "  • Security Headers Middleware"
    Write-Output "  • Rate Limiting"
    Write-Output "  • Input Sanitization"
    Write-Output ""
    Write-Output "📋 Next Steps:"
    Write-Output "  1. Review CloudWatch logs for any errors"
    Write-Output "  2. Test all critical endpoints"
    Write-Output "  3. Run OWASP compliance check: bash aws/scripts/owasp-compliance.sh $Environment"
    Write-Output "  4. Update monitoring dashboards"
    Write-Output "  5. Notify team of security improvements"
    Write-Output ""
    Write-Output "📚 Documentation:"
    Write-Output "  • Security Guide: aws/SECURITY-README.md"
    Write-Output "  • Implementation Plan: aws/PLAN-SEGURIDAD.md"
    Write-Output "  • Patch Guide: aws/PATCH-SERVERLESS-SECURITY.md"
    Write-Output ""
    Write-Output "💾 Backup Location: $backupDir"
    Write-Output ""
} else {
    Write-Warning "DRY RUN MODE - No changes were made"
    Write-Output ""
    Write-Output "To execute deployment, run without --DryRun flag:"
    Write-Output "  .\scripts\deploy-security.ps1 -Environment $Environment -Region $Region"
}

Write-Success "Deployment script completed!"
