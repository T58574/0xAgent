# Build native 0xAgent Windows Tray Launcher (.exe)
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $cscPath)) {
    Write-Host "[ERROR] C# Compiler (csc.exe) not found in Windows directory." -ForegroundColor Red
    exit 1
}

$rootDir = Get-Item $PSScriptRoot\..
$sourceFile = Join-Path $rootDir.FullName "launcher\TrayLauncher.cs"
$outFile = Join-Path $rootDir.FullName "0xAgent.exe"

# Stop existing running 0xAgent.exe if necessary to allow overwriting
Get-Process -Name "0xAgent" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "[INFO] Stopping running 0xAgent.exe (PID: $($_.Id)) to allow compilation..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500

Write-Host "Compiling 0xAgent.exe (Windows Tray Launcher)..." -ForegroundColor Cyan
& $cscPath /target:winexe /optimize+ /out:$outFile /r:System.dll,System.Windows.Forms.dll,System.Drawing.dll $sourceFile

if ($LASTEXITCODE -eq 0) {
    $size = (Get-Item $outFile).Length / 1024
    Write-Host "[SUCCESS] 0xAgent.exe compiled successfully ($([Math]::Round($size, 1)) KB) -> $outFile" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to compile 0xAgent.exe" -ForegroundColor Red
    exit $LASTEXITCODE
}
