# 0xAgent 1-Click Universal Windows Installer & CLI Setup
# Usage: irm https://raw.githubusercontent.com/T58574/0xAgent/main/install.ps1 | iex
# Or: .\install.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

function Print-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Cyan
    Write-Host "  |   0xAgent — Autonomous AI Developer & Web-IDE Platform       |" -ForegroundColor Cyan
    Write-Host "  |   1-Click Interactive Setup & Native Tray Launcher Engine    |" -ForegroundColor DarkCyan
    Write-Host "  ================================================================" -ForegroundColor Cyan
    Write-Host ""
}

Print-Banner

$userHome = [Environment]::GetFolderPath([Environment]::SpecialFolder.UserProfile)
$oxAgentDir = Join-Path $userHome ".0xagent"
$appDir = Join-Path $oxAgentDir "app"
$binDir = Join-Path $oxAgentDir "bin"
$repoUrl = "https://github.com/T58574/0xAgent.git"

# If script is run inside an existing cloned repo, use current directory
if (Test-Path "package.json") {
    $currentPkg = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($currentPkg.name -eq "0xagent") {
        $appDir = (Get-Item .).FullName
        Write-Host "  [+] Detected local 0xAgent repository at: $appDir" -ForegroundColor Green
    }
}

# 1. Ensure Directories
if (-not (Test-Path $oxAgentDir)) { New-Item -ItemType Directory -Path $oxAgentDir | Out-Null }
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }
if (-not (Test-Path (Join-Path $oxAgentDir "models"))) { New-Item -ItemType Directory -Path (Join-Path $oxAgentDir "models") | Out-Null }
if (-not (Test-Path (Join-Path $oxAgentDir "llama"))) { New-Item -ItemType Directory -Path (Join-Path $oxAgentDir "llama") | Out-Null }

# 2. Check Prerequisites
Write-Host "  [1/6] Verifying System Prerequisites..." -ForegroundColor Yellow

# Check Git
$gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host "  [!] Git is not installed." -ForegroundColor Yellow
    $installGit = Read-Host "  Would you like to install Git via winget? (Y/n)"
    if ($installGit -ne "n" -and $installGit -ne "N") {
        winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Host "  [ERR] Git is required to clone and update 0xAgent. Aborting." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  [OK] Git is available." -ForegroundColor Green

# Check Node.js
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "  [!] Node.js (>=20) is not installed." -ForegroundColor Yellow
    $installNode = Read-Host "  Would you like to install Node.js LTS via winget? (Y/n)"
    if ($installNode -ne "n" -and $installNode -ne "N") {
        winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    } else {
        Write-Host "  [ERR] Node.js is required to run 0xAgent. Aborting." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  [OK] Node.js is available." -ForegroundColor Green

# 3. Clone or Update Repository
Write-Host ""
Write-Host "  [2/6] Synchronizing 0xAgent Codebase..." -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $appDir "package.json"))) {
    Write-Host "  [+] Cloning repository into: $appDir" -ForegroundColor Cyan
    git clone $repoUrl $appDir
} else {
    Write-Host "  [+] Existing installation found. Updating to latest version..." -ForegroundColor Cyan
    Push-Location $appDir
    try {
        git fetch origin main | Out-Null
        git pull --rebase origin main | Out-Null
    } catch {
        Write-Host "  [*] Using existing local workspace." -ForegroundColor Gray
    }
    Pop-Location
}

# 4. Install NPM Dependencies
Write-Host ""
Write-Host "  [3/6] Installing Dependencies (npm install)..." -ForegroundColor Yellow
Push-Location $appDir
npm install --no-audit --no-fund
Pop-Location
Write-Host "  [OK] Dependencies installed successfully." -ForegroundColor Green

# 5. Build Web Client & Generate SSL Certificates
Write-Host ""
Write-Host "  [4/6] Building Production Client & Generating Local SSL..." -ForegroundColor Yellow
Push-Location $appDir
node ./scripts/ensure-ssl.cjs
npm run build
Pop-Location
Write-Host "  [OK] Client and security certificates ready." -ForegroundColor Green

# 6. Compile Native C# Windows Tray Launcher
Write-Host ""
Write-Host "  [5/6] Compiling Native C# Tray Launcher (0xAgent.exe)..." -ForegroundColor Yellow
Push-Location $appDir
& powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/build-launcher.ps1"
Pop-Location

# 7. Setup Global CLI Command & Path
Write-Host ""
Write-Host "  [6/6] Configuring Global '0xagent' CLI & Shortcuts..." -ForegroundColor Yellow

# Create 0xagent.cmd wrapper
$cliCmdContent = @"
@echo off
node "$appDir\bin\0xagent.js" %*
"@
$cliCmdPath = Join-Path $binDir "0xagent.cmd"
Set-Content -Path $cliCmdPath -Value $cliCmdContent -Encoding ASCII

# Create 0xagent.ps1 wrapper
$cliPs1Content = @"
param([Parameter(ValueFromRemainingArguments=`$true)] `$args)
& node "$appDir\bin\0xagent.js" @args
"@
$cliPs1Path = Join-Path $binDir "0xagent.ps1"
Set-Content -Path $cliPs1Path -Value $cliPs1Content -Encoding UTF8

# Add to User PATH if not present
$userPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
if ($userPath -notlike "*$binDir*") {
    $newPath = "$userPath;$binDir"
    [Environment]::SetEnvironmentVariable("Path", $newPath, [EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$binDir"
    Write-Host "  [+] Added '$binDir' to User PATH." -ForegroundColor Green
}

# Create Desktop Shortcut
try {
    $wscript = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath([Environment]::SpecialFolder.DesktopDirectory)
    $shortcutPath = Join-Path $desktopPath "0xAgent.lnk"
    $shortcut = $wscript.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path $appDir "0xAgent.exe"
    $shortcut.WorkingDirectory = $appDir
    $shortcut.Description = "0xAgent Autonomous AI Developer Platform"
    $iconFile = Join-Path $appDir "0xAgent-icon.jpg"
    if (Test-Path $iconFile) {
        $shortcut.IconLocation = "$appDir\0xAgent.exe,0"
    }
    $shortcut.Save()
    Write-Host "  [+] Created Desktop Shortcut: 0xAgent.lnk" -ForegroundColor Green
} catch {}

Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] 0xAgent has been successfully installed!" -ForegroundColor Green
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  You can now manage and launch 0xAgent from ANY terminal:" -ForegroundColor Cyan
Write-Host "    - 0xagent          : Launch platform in Windows System Tray (Zero RAM/VRAM bloat)" -ForegroundColor White
Write-Host "    - 0xagent config   : Interactive settings, API keys & GGUF models hub" -ForegroundColor White
Write-Host "    - 0xagent update   : Update to latest version from GitHub" -ForegroundColor White
Write-Host "    - 0xagent status   : View health, server status & telemetry" -ForegroundColor White
Write-Host "    - 0xagent stop     : Stop all processes and release GPU memory" -ForegroundColor White
Write-Host ""

$postAction = Read-Host "  Launch 0xAgent in System Tray now? (Y/n)"
if ($postAction -ne "n" -and $postAction -ne "N") {
    Write-Host "  Starting 0xAgent..." -ForegroundColor Cyan
    Push-Location $appDir
    Start-Process -FilePath (Join-Path $appDir "0xAgent.exe") -WorkingDirectory $appDir
    Pop-Location
    Write-Host "  [OK] 0xAgent is running in your System Tray!" -ForegroundColor Green
}
