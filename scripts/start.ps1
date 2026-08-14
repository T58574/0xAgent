# 0xAgent Core PowerShell Launcher & Process Supervisor
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "0xAgent AI Platform"

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
    $logsToArchive = $existingLogs | Select-Object -First ($existingLogs.Count - $maxRawLogs + 1)
    $archiveTimestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $archiveZip = Join-Path $archiveDir "logs_archive_$archiveTimestamp.zip"
    
    try {
        Compress-Archive -Path $logsToArchive.FullName -DestinationPath $archiveZip -Force
        foreach ($logFile in $logsToArchive) {
            Remove-Item -Path $logFile.FullName -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # Silent ignore
    }
}

# Keep max 5 zip archives
$archiveZips = Get-ChildItem -Path $archiveDir -Filter "*.zip" -File | Sort-Object CreationTime
if ($archiveZips.Count -gt 5) {
    $zipsToDelete = $archiveZips | Select-Object -First ($archiveZips.Count - 5)
    foreach ($z in $zipsToDelete) {
        Remove-Item -Path $z.FullName -Force -ErrorAction SilentlyContinue
    }
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logPath = Join-Path $logsDir "0xAgent_$timestamp.log"

try {
    Start-Transcript -Path $logPath -Encoding utf8 -Append | Out-Null
} catch {
    # Fallback if transcript fails
}

function Cleanup-AllProcesses {
    $cleanupScript = Join-Path $PSScriptRoot "cleanup.ps1"
    if (Test-Path $cleanupScript) {
        & $cleanupScript -Quiet
    }
}

try {
    Clear-Host

    Write-Host ""
    Write-Host "  =============================================================" -ForegroundColor Cyan
    Write-Host "  |   0xAgent - Autonomous AI Developer & IDE Platform        |" -ForegroundColor Cyan
    Write-Host "  |   Windows PowerShell  *  React 19 + Express + llama.cpp   |" -ForegroundColor DarkCyan
    Write-Host "  =============================================================" -ForegroundColor Cyan
    Write-Host ""

    # 1. Quick Port & Process Cleanup
    Write-Host "  [1/2] Checking and cleaning stale ports (3001, 5173)..." -ForegroundColor Yellow
    Cleanup-AllProcesses
    Write-Host "  [OK] Ports and background supervisors are ready." -ForegroundColor Green
    Write-Host ""

    # 2. Launching Services
    Write-Host "  [2/2] Launching 0xAgent Client and Server..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  +-----------------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "  |  [+] Client UI:   http://localhost:5173                   |" -ForegroundColor Cyan
    Write-Host "  |  [+] API Server:  http://localhost:3001                   |" -ForegroundColor Cyan
    Write-Host "  |  [+] Health API:  http://localhost:3001/api/health        |" -ForegroundColor Cyan
    Write-Host "  |                                                           |" -ForegroundColor DarkCyan
    Write-Host "  |  [Ctrl+C] Stop platform and terminate all processes       |" -ForegroundColor Gray
    Write-Host "  +-----------------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host ""

    & npm run dev
}
finally {
    Write-Host ""
    Write-Host "  [STOP] Terminating all 0xAgent processes and releasing ports..." -ForegroundColor Yellow
    Cleanup-AllProcesses
    try {
        Stop-Transcript | Out-Null
    } catch {}
    Write-Host "  [OK] 0xAgent stopped cleanly." -ForegroundColor Green
}
