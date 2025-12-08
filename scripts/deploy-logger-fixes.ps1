# Deploy de funciones con Logger corregido
$ErrorActionPreference = "Stop"

$stage = "dev"
$region = "us-east-1"

# Lista de funciones a desplegar (nombres de serverless.yml)
$functions = @(
    # Especialidades
    "listEspecialidades",
    "createEspecialidad",
    "updateEspecialidad",
    "deleteEspecialidad",
    
    # Instrumentos
    "listInstrumentos",
    "createInstrumento",
    "updateInstrumento",
    "deleteInstrumento",
    
    # Tipos Instrumentos
    "listTiposInstrumentos",
    "createTipoInstrumento",
    "updateTipoInstrumento",
    "deleteTipoInstrumento",
    
    # WebSocket
    "connectWebSocket",
    "disconnectWebSocket",
    "subscribeOperation",
    "streamProcessor",
    "occupantsStreamProcessor",
    "spacesStreamProcessor",
    "operationsStreamProcessor",
    "groupMembersStreamProcessor",
    
    # Notifications
    "listNotifications",
    "markNotificationAsRead",
    
    # Appointments
    "listAppointments",
    "createAppointment",
    "updateAppointment",
    "deleteAppointment",
    "checkAppointmentConflict",
    
    # Groups
    "createSpace",
    "deleteSpace",
    "updateSpace",
    "inviteToGroup",
    "verifyInvitation",
    
    # DB
    "obtenerOcupantes",
    "obtenerEspaciosGenerales",
    "obtenerEspaciosEspecificos",
    
    # Otros críticos
    "getEspaciosConfiguracion",
    "getMyPermissions",
    "getPersonalization",
    "login",
    "refreshToken",
    "me"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploy de $($functions.Count) funciones Lambda" -ForegroundColor Yellow
Write-Host "Stage: $stage | Region: $region" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cambiar al directorio aws
$awsDir = "F:\Descargas\Git\Proyecto-Hospital-Padre-Hurtado\aws"
Set-Location $awsDir
Write-Host "Directorio de trabajo: $awsDir" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$errorCount = 0
$startTime = Get-Date

foreach ($func in $functions) {
    try {
        Write-Host "Desplegando: $func..." -ForegroundColor Cyan
        
        $output = serverless deploy function `
            -f $func `
            --stage $stage `
            --region $region `
            2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK: $func" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  ERROR: $func" -ForegroundColor Red
            Write-Host "  $output" -ForegroundColor Red
            $errorCount++
        }
    }
    catch {
        Write-Host "  EXCEPCION: $func - $_" -ForegroundColor Red
        $errorCount++
    }
}

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Exitosos: $successCount" -ForegroundColor Green
Write-Host "Errores: $errorCount" -ForegroundColor Red
Write-Host "Duracion: $([math]::Round($duration, 2)) segundos" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
