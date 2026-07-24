# 0xAgent Process Cleanup Script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       0xAgent Stale Process Cleanup Engine" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Kill processes bound to ports 3001 (Backend) and 5173 (Client UI)
$ports = @(3001, 5173)
foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($conn in $conns) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -and $pidToKill -gt 4) {
                    Write-Host "[-] Terminating process (PID: $pidToKill) bound to port $port..." -ForegroundColor Yellow
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        # Ignore permission/lookup errors
    }
}

# 2. Terminate background llama.cpp servers
$llamaProcs = Get-Process -Name "llama-server", "llama" -ErrorAction SilentlyContinue
if ($llamaProcs) {
    foreach ($proc in $llamaProcs) {
        Write-Host "[-] Terminating llama.cpp process (PID: $($proc.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
}

# 3. Clean up orphaned node / tsx processes in current project path
$currentPath = (Get-Location).Path.ToLower()
$nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    foreach ($proc in $nodeProcs) {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($proc.Id)").CommandLine
            if ($cmd -and ($cmd.ToLower().Contains("0xagent") -or $cmd.ToLower().Contains("server/index.ts"))) {
                Write-Host "[-] Terminating stale 0xAgent Node process (PID: $($proc.Id))..." -ForegroundColor Yellow
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {
            # Skip process if access denied
        }
    }
}

Write-Host "[OK] All stale processes cleared successfully." -ForegroundColor Green
Write-Host ""
