# Script para corregir imports de Logger en todos los archivos
# Cambia: const Logger = require("...")
# Por:    const { Logger } = require("...")

$ErrorActionPreference = "Stop"

# Lista de archivos a corregir
$files = @(
    # Handlers - Especialidades
    "aws\src\handlers\especialidades\createEspecialidad.js",
    "aws\src\handlers\especialidades\deleteEspecialidad.js",
    "aws\src\handlers\especialidades\listEspecialidades.js",
    "aws\src\handlers\especialidades\updateEspecialidad.js",
    
    # Handlers - Instrumentos
    "aws\src\handlers\instrumentos\createInstrumento.js",
    "aws\src\handlers\instrumentos\deleteInstrumento.js",
    "aws\src\handlers\instrumentos\listInstrumentos.js",
    "aws\src\handlers\instrumentos\updateInstrumento.js",
    
    # Handlers - Tipos Instrumentos
    "aws\src\handlers\tipos-instrumentos\createTipoInstrumento.js",
    "aws\src\handlers\tipos-instrumentos\deleteTipoInstrumento.js",
    "aws\src\handlers\tipos-instrumentos\listTiposInstrumentos.js",
    "aws\src\handlers\tipos-instrumentos\updateTipoInstrumento.js",
    
    # Handlers - WebSocket
    "aws\src\handlers\websocket\connect.js",
    "aws\src\handlers\websocket\disconnect.js",
    "aws\src\handlers\websocket\groupMembersStreamProcessor.js",
    "aws\src\handlers\websocket\occupantsStreamProcessor.js",
    "aws\src\handlers\websocket\operationsStreamProcessor.js",
    "aws\src\handlers\websocket\spacesStreamProcessor.js",
    "aws\src\handlers\websocket\streamProcessor.js",
    "aws\src\handlers\websocket\subscribeOperation.js",
    
    # Handlers - Notifications
    "aws\src\handlers\notifications\listNotifications.js",
    "aws\src\handlers\notifications\markAsRead.js",
    
    # Handlers - Appointments
    "aws\src\handlers\appointments\checkConflict.js",
    "aws\src\handlers\appointments\createAppointment.js",
    "aws\src\handlers\appointments\createAppointmentCQRS.js",
    "aws\src\handlers\appointments\deleteAppointment.js",
    "aws\src\handlers\appointments\listAppointments.js",
    "aws\src\handlers\appointments\updateAppointment.js",
    
    # Handlers - Groups
    "aws\src\handlers\groups\createSpace.js",
    "aws\src\handlers\groups\deleteSpace.js",
    "aws\src\handlers\groups\inviteMember.js",
    "aws\src\handlers\groups\inviteToGroup.js",
    "aws\src\handlers\groups\updateSpace.js",
    "aws\src\handlers\groups\verifyInvitation.js",
    
    # Handlers - DB
    "aws\src\handlers\db\obtenerEspaciosEspecificos.js",
    "aws\src\handlers\db\obtenerEspaciosGenerales.js",
    "aws\src\handlers\db\obtenerOcupantes.js",
    
    # Handlers - Otros
    "aws\src\handlers\espacios\configuracion.js",
    "aws\src\handlers\personalization\personalization.js",
    "aws\src\handlers\permissions\permissions.js",
    "aws\src\handlers\operations\getOperationStatus.js",
    "aws\src\handlers\login\login.js",
    "aws\src\handlers\login\me.js",
    "aws\src\handlers\login\refresh.js",
    "aws\src\handlers\health.js",
    "aws\src\handlers\logs.js",
    "aws\src\handlers\events.js",
    "aws\src\handlers\events\eventProjection.js",
    "aws\src\handlers\outbox\outboxProcessor.js",
    "aws\src\handlers\dbProxy.js",
    
    # Utils
    "aws\src\utils\commandBus.js",
    "aws\src\utils\eventStore.js",
    "aws\src\utils\operationStore.js",
    "aws\src\utils\outboxStore.js",
    "aws\src\utils\projections.js",
    "aws\src\utils\serviceRegistry.js",
    "aws\src\utils\telemetryCollector.js"
)

$rootPath = "F:\Descargas\Git\Proyecto-Hospital-Padre-Hurtado"
$fixedCount = 0
$errorCount = 0

Write-Host "Iniciando correccion de imports de Logger..." -ForegroundColor Cyan
Write-Host "Archivos a procesar: $($files.Count)" -ForegroundColor Yellow
Write-Host ""

foreach ($file in $files) {
    $fullPath = Join-Path $rootPath $file
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "No existe: $file" -ForegroundColor Yellow
        $errorCount++
        continue
    }
    
    try {
        $content = Get-Content $fullPath -Raw -Encoding UTF8
        
        # Verificar si ya está corregido
        if ($content -match 'const \{ Logger \} = require\(') {
            Write-Host "Ya corregido: $file" -ForegroundColor Green
            continue
        }
        
        # Verificar si necesita corrección
        if ($content -notmatch 'const Logger = require\(') {
            Write-Host "No necesita: $file" -ForegroundColor Gray
            continue
        }
        
        # Hacer el reemplazo
        # Busca: const Logger = require("../../utils/logger");
        # Reemplaza: const { Logger } = require("../../utils/logger");
        $newContent = $content -replace 'const Logger = require\(([^)]+)\);', 'const { Logger } = require($1);'
        
        # Guardar el archivo
        Set-Content -Path $fullPath -Value $newContent -Encoding UTF8 -NoNewline
        
        Write-Host "Corregido: $file" -ForegroundColor Green
        $fixedCount++
    }
    catch {
        Write-Host "Error en: $file" -ForegroundColor Red
        Write-Host "   $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Corregidos: $fixedCount" -ForegroundColor Green
Write-Host "Errores: $errorCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
