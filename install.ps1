# 0xAgent 1-Click Universal Windows Installer & CLI Setup
# Usage: irm https://raw.githubusercontent.com/T58574/0xAgent/main/install.ps1 | iex
# Or: .\install.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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
    try {
        $currentPkg = Get-Content "package.json" -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($currentPkg.name -eq "0xagent") {
            $appDir = (Get-Item .).FullName
            Write-Host "  [+] Detected local 0xAgent workspace at: $appDir" -ForegroundColor Green
        }
    } catch {}
}

# 1. Ensure Directories
try {
    if (-not (Test-Path $oxAgentDir)) { New-Item -ItemType Directory -Path $oxAgentDir | Out-Null }
    if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }
    if (-not (Test-Path (Join-Path $oxAgentDir "models"))) { New-Item -ItemType Directory -Path (Join-Path $oxAgentDir "models") | Out-Null }
    if (-not (Test-Path (Join-Path $oxAgentDir "llama"))) { New-Item -ItemType Directory -Path (Join-Path $oxAgentDir "llama") | Out-Null }
} catch {
    Write-Host "  [ERR] Failed to create directories in $oxAgentDir : $_" -ForegroundColor Red
    exit 1
}

# 2. Check Prerequisites
Write-Host "  [1/6] Verifying System Prerequisites..." -ForegroundColor Yellow

# Helper for winget
$hasWinget = (Get-Command "winget" -ErrorAction SilentlyContinue) -ne $null

# Check Git
$gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    Write-Host "  [!] Git is not found in PATH." -ForegroundColor Yellow
    if ($hasWinget) {
        $installGit = Read-Host "  Install Git via winget now? (Y/n)"
        if ($installGit -ne "n" -and $installGit -ne "N") {
            winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        } else {
            Write-Host "  [!] Please install Git manually from https://git-scm.com/download/win and rerun setup." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  [!] Please download and install Git from: https://git-scm.com/download/win" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  [OK] Git is available." -ForegroundColor Green

# Check Node.js & Version (>= 20)
$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
$needNodeInstall = $false

if (-not $nodeCmd) {
    $needNodeInstall = $true
} else {
    try {
        $nodeVerStr = & node -v
        $majorVer = [int]($nodeVerStr -replace '^v','' -split '\.')[0]
        if ($majorVer -lt 20) {
            Write-Host "  [!] Detected Node.js $nodeVerStr. 0xAgent requires Node.js >= 20.0.0." -ForegroundColor Yellow
            $needNodeInstall = $true
        } else {
            Write-Host "  [OK] Node.js $nodeVerStr is available (>=20.0.0)." -ForegroundColor Green
        }
    } catch {
        $needNodeInstall = $true
    }
}

if ($needNodeInstall) {
    if ($hasWinget) {
        $installNode = Read-Host "  Install Node.js LTS (v22) via winget now? (Y/n)"
        if ($installNode -ne "n" -and $installNode -ne "N") {
            winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-source-agreements --accept-package-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        } else {
            Write-Host "  [!] Please install Node.js >= 20 LTS from https://nodejs.org/ and rerun setup." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  [!] Please download and install Node.js >= 20 from: https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
}

# 3. Clone or Update Repository
Write-Host ""
Write-Host "  [2/6] Synchronizing 0xAgent Codebase..." -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $appDir "package.json"))) {
    Write-Host "  [+] Cloning repository into: $appDir" -ForegroundColor Cyan
    try {
        git clone $repoUrl $appDir
    } catch {
        Write-Host "  [ERR] Failed to clone repository. Check internet connection or proxy settings." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [+] Existing workspace found. Updating to latest release..." -ForegroundColor Cyan
    Push-Location $appDir
    try {
        git fetch origin main 2>$null | Out-Null
        git pull --rebase origin main 2>$null | Out-Null
    } catch {
        Write-Host "  [*] Using existing local workspace." -ForegroundColor Gray
    }
    Pop-Location
}

# 4. Install NPM Dependencies
Write-Host ""
Write-Host "  [3/6] Installing Dependencies (npm install)..." -ForegroundColor Yellow
Push-Location $appDir
try {
    npm install --no-audit --no-fund
    Write-Host "  [OK] Dependencies installed successfully." -ForegroundColor Green
} catch {
    Write-Host "  [ERR] npm install encountered an issue. Running retry..." -ForegroundColor Yellow
    npm install
}
Pop-Location

# 5. Build Web Client & Generate SSL Certificates
Write-Host ""
Write-Host "  [4/6] Building Production Client & Generating Local SSL..." -ForegroundColor Yellow
Push-Location $appDir
try {
    node ./scripts/ensure-ssl.cjs
    npm run build
    Write-Host "  [OK] Client and SSL certificates ready." -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Build step reported a warning: $_" -ForegroundColor Yellow
}
Pop-Location

# 6. Compile Native C# Windows Tray Launcher
Write-Host ""
Write-Host "  [5/6] Compiling Native C# Tray Launcher (0xAgent.exe)..." -ForegroundColor Yellow
Push-Location $appDir
$buildPs1 = Join-Path $appDir "scripts\build-launcher.ps1"
if (Test-Path $buildPs1) {
    try {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $buildPs1
    } catch {
        Write-Host "  [WARN] Native C# build skipped (csc.exe). Node CLI fallback active." -ForegroundColor Yellow
    }
}
Pop-Location

# 7. Setup Global CLI Command & Path
Write-Host ""
Write-Host "  [6/6] Configuring Global '0xagent' CLI & Shortcuts..." -ForegroundColor Yellow

try {
    # Create 0xagent.cmd wrapper
    $cliCmdContent = "@echo off`r`nnode `"$appDir\bin\0xagent.js`" %*"
    $cliCmdPath = Join-Path $binDir "0xagent.cmd"
    Set-Content -Path $cliCmdPath -Value $cliCmdContent -Encoding ASCII

    # Create 0xagent.ps1 wrapper
    $cliPs1Content = "param([Parameter(ValueFromRemainingArguments=`$true)] `$args)`r`n& node `"$appDir\bin\0xagent.js`" @args"
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
    $wscript = New-Object -ComObject WScript.Shell
    $desktopPath = [Environment]::GetFolderPath([Environment]::SpecialFolder.DesktopDirectory)
    $shortcutPath = Join-Path $desktopPath "0xAgent.lnk"
    $shortcut = $wscript.CreateShortcut($shortcutPath)
    $exePath = Join-Path $appDir "0xAgent.exe"
    if (Test-Path $exePath) {
        $shortcut.TargetPath = $exePath
        $shortcut.IconLocation = "$exePath,0"
    } else {
        $shortcut.TargetPath = Join-Path $binDir "0xagent.cmd"
    }
    $shortcut.WorkingDirectory = $appDir
    $shortcut.Description = "0xAgent Autonomous AI Developer Platform"
    $shortcut.Save()
    Write-Host "  [+] Created Desktop Shortcut: 0xAgent.lnk" -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Shortcut or PATH registration warning: $_" -ForegroundColor Yellow
}

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
    $trayExecutable = Join-Path $appDir "0xAgent.exe"
    if (Test-Path $trayExecutable) {
        Start-Process -FilePath $trayExecutable -WorkingDirectory $appDir
    } else {
        Start-Process -FilePath "node" -ArgumentList "bin\0xagent.js" -WorkingDirectory $appDir
    }
    Pop-Location
    Write-Host "  [OK] 0xAgent is running!" -ForegroundColor Green
}
