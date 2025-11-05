# Script para actualizar secrets de AWS Academy en GitHub
# Uso: .\scripts\update-aws-secrets.ps1 -AccessKeyId "ASIA..." -SecretAccessKey "..." -SessionToken "IQoJ..."

param(
    [Parameter(Mandatory=$true, HelpMessage="AWS Access Key ID (empieza con ASIA)")]
    [string]$AccessKeyId,
    
    [Parameter(Mandatory=$true, HelpMessage="AWS Secret Access Key")]
    [string]$SecretAccessKey,
    
    [Parameter(Mandatory=$true, HelpMessage="AWS Session Token (muy largo, empieza con IQoJ)")]
    [string]$SessionToken
)

$repo = "felivazpro/Proyecto-Hospital-Padre-Hurtado"

Write-Host ""
Write-Host "🔐 Actualizando secrets de AWS Academy..." -ForegroundColor Cyan
Write-Host "📦 Repositorio: $repo" -ForegroundColor Gray
Write-Host ""

# Verificar que gh CLI está instalado
try {
    $ghVersion = gh --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI no encontrado"
    }
} catch {
    Write-Host "❌ Error: GitHub CLI (gh) no está instalado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instala GitHub CLI desde: https://cli.github.com/" -ForegroundColor Yellow
    Write-Host "O usa: winget install --id GitHub.cli" -ForegroundColor Yellow
    exit 1
}

# Verificar autenticación
Write-Host "🔍 Verificando autenticación..." -ForegroundColor Gray
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ No estás autenticado en GitHub CLI" -ForegroundColor Red
        Write-Host "Ejecuta: gh auth login" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Error al verificar autenticación" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Autenticación verificada" -ForegroundColor Green
Write-Host ""

# Actualizar secrets
Write-Host "📝 Actualizando AWS_ACCESS_KEY_ID..." -ForegroundColor Gray
gh secret set AWS_ACCESS_KEY_ID --body $AccessKeyId --repo $repo
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ AWS_ACCESS_KEY_ID actualizado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error al actualizar AWS_ACCESS_KEY_ID" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Actualizando AWS_SECRET_ACCESS_KEY..." -ForegroundColor Gray
gh secret set AWS_SECRET_ACCESS_KEY --body $SecretAccessKey --repo $repo
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ AWS_SECRET_ACCESS_KEY actualizado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error al actualizar AWS_SECRET_ACCESS_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "📝 Actualizando AWS_SESSION_TOKEN..." -ForegroundColor Gray
gh secret set AWS_SESSION_TOKEN --body $SessionToken --repo $repo
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ AWS_SESSION_TOKEN actualizado" -ForegroundColor Green
} else {
    Write-Host "   ❌ Error al actualizar AWS_SESSION_TOKEN" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 ¡Todos los secrets actualizados correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Próximos pasos:" -ForegroundColor Cyan
Write-Host "   1. Ve a: https://github.com/$repo/actions" -ForegroundColor White
Write-Host "   2. Selecciona 'CD Pipeline - Deploy to AWS EC2'" -ForegroundColor White
Write-Host "   3. Haz clic en 'Run workflow'" -ForegroundColor White
Write-Host "   4. Selecciona branch 'main' y ejecuta" -ForegroundColor White
Write-Host ""
