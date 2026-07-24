# 0xAgent Core PowerShell Launcher & Process Supervisor
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Item $PSScriptRoot\..
$logsDir = Join-Path $rootDir.FullName "logs"
$archiveDir = Join-Path $logsDir "archive"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}
if (-not (Test-Path $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir | Out-Null
}

# --- Log Rotation & Archive Cycle ---
$maxRawLogs = 10
$existingLogs = Get-ChildItem -Path $logsDir -Filter "*.log" -File | Sort-Object CreationTime

if ($existingLogs.Count -ge $maxRawLogs) {
    Write-Host "[LOG ARCHIVER] Rotating log history (found $($existingLogs.Count) logs, limit is $maxRawLogs)..." -ForegroundColor Yellow
    $logsToArchive = $existingLogs | Select-Object -First ($existingLogs.Count - $maxRawLogs + 1)
    
    $archiveTimestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $archiveZip = Join-Path $archiveDir "logs_archive_$archiveTimestamp.zip"
    
    try {
        Compress-Archive -Path $logsToArchive.FullName -DestinationPath $archiveZip -Force
        foreach ($logFile in $logsToArchive) {
            Remove-Item -Path $logFile.FullName -Force -ErrorAction SilentlyContinue
        }
        Write-Host "[LOG ARCHIVER] Archived $($logsToArchive.Count) old log(s) into: $archiveZip" -ForegroundColor Green
    } catch {
        Write-Host "[LOG ARCHIVER] Warning: Failed to compress log archive: $_" -ForegroundColor DarkYellow
    }
}

# Keep only max 5 zip archives in logs/archive
$archiveZips = Get-ChildItem -Path $archiveDir -Filter "*.zip" -File | Sort-Object CreationTime
if ($archiveZips.Count -gt 5) {
    $zipsToDelete = $archiveZips | Select-Object -First ($archiveZips.Count - 5)
    foreach ($z in $zipsToDelete) {
        Remove-Item -Path $z.FullName -Force -ErrorAction SilentlyContinue
    }
}

# Generate current log file name
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logPath = Join-Path $logsDir "0xAgent_$timestamp.log"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "               0xAgent AI Platform Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "[LOG] Session log file: $logPath" -ForegroundColor Gray
Write-Host ""

# Start transcript recording
try {
    Start-Transcript -Path $logPath -Encoding utf8 -Append | Out-Null
} catch {
    # Fallback if transcript fails
}

function Cleanup-AllProcesses {
    Write-Host ""
    Write-Host "[STOP TRAP] Cleaning up background processes and servers..." -ForegroundColor Yellow
    $cleanupScript = Join-Path $PSScriptRoot "cleanup.ps1"
    if (Test-Path $cleanupScript) {
        & $cleanupScript
    }
}

try {
    # 0. Clear stale processes
    Write-Host "[0/3] Clearing stale processes on ports 3001, 5173 and old servers..." -ForegroundColor Cyan
    Cleanup-AllProcesses

    # 1. Test TypeScript compilation
    Write-Host "[1/3] Testing TypeScript Compilation (Frontend and Backend)..." -ForegroundColor Cyan
    & npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] TypeScript compilation failed!" -ForegroundColor Red
        Write-Host "Launch aborted. Please fix type errors." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "[SUCCESS] TypeScript type check passed cleanly." -ForegroundColor Green
    Write-Host ""

    # 2. Test Vite Production Build
    Write-Host "[2/3] Testing Vite Production Build..." -ForegroundColor Cyan
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERROR] Vite build failed!" -ForegroundColor Red
        Write-Host "Launch aborted." -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host "[SUCCESS] Vite production build passed cleanly." -ForegroundColor Green
    Write-Host ""

    # 3. Launching 0xAgent
    Write-Host "[3/3] Launching 0xAgent Server and Client..." -ForegroundColor Cyan
    Write-Host "App UI:     http://localhost:5173" -ForegroundColor Green
    Write-Host "API Server: http://localhost:3001" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop platform and terminate all processes." -ForegroundColor Gray
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""

    & npm run dev
}
finally {
    Cleanup-AllProcesses
    try {
        Stop-Transcript | Out-Null
    } catch {}
}
