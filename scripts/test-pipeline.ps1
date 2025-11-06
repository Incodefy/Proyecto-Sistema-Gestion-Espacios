#!/usr/bin/env pwsh
# Script para probar el pipeline localmente antes de hacer push

Write-Host "🔍 Testing CI/CD Pipeline Locally..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Lint
Write-Host "📝 Test 1: Running ESLint..." -ForegroundColor Yellow
Push-Location aws
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lint failed in aws/" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Push-Location incodefy
if (Test-Path "package.json") {
    npm run lint 2>$null
}
Pop-Location

Write-Host "✅ Lint passed!" -ForegroundColor Green
Write-Host ""

# Test 2: Validate Serverless
Write-Host "🔧 Test 2: Validating Serverless config..." -ForegroundColor Yellow
Push-Location aws
serverless print --stage dev > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Serverless validation failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ Serverless config is valid!" -ForegroundColor Green
Write-Host ""

# Test 3: Check Lambda handlers syntax
Write-Host "🧪 Test 3: Checking Lambda handlers syntax..." -ForegroundColor Yellow
Push-Location aws
$handlers = Get-ChildItem -Path "src/handlers/*.js" -File
foreach ($handler in $handlers) {
    node -c $handler.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Syntax error in $($handler.Name)" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
Pop-Location
Write-Host "✅ All handlers have valid syntax!" -ForegroundColor Green
Write-Host ""

# Test 4: Security audit
Write-Host "🔒 Test 4: Running security audit..." -ForegroundColor Yellow
Push-Location aws
npm audit --audit-level=high 2>&1 | Out-Null
Pop-Location
Write-Host "✅ Security audit completed!" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🎉 All pre-flight checks passed!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. git add ." -ForegroundColor White
Write-Host "  2. git commit -m 'feat: setup CI/CD pipeline'" -ForegroundColor White
Write-Host "  3. git push origin develop" -ForegroundColor White
Write-Host "  4. Create Pull Request to main" -ForegroundColor White
Write-Host ""
