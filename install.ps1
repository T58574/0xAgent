# 0xAgent 1-Click Universal Windows Installer & CLI Setup
# Usage: irm https://raw.githubusercontent.com/T58574/0xAgent/main/install.ps1 | iex
# Or: .\install.ps1

try {
    chcp 65001 >$null 2>&1
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ErrorActionPreference = "Stop"

# User profile and destination folders
$userHome = [Environment]::GetFolderPath([Environment]::SpecialFolder.UserProfile)
$oxAgentDir = Join-Path $userHome ".0xagent"
$appDir = Join-Path $oxAgentDir "app"
$binDir = Join-Path $oxAgentDir "bin"
$logFile = Join-Path $oxAgentDir "install.log"
$repoUrl = "https://github.com/T58574/0xAgent.git"

# Ensure core log directory
if (-not (Test-Path $oxAgentDir)) {
    New-Item -ItemType Directory -Path $oxAgentDir -Force | Out-Null
}

function Write-InstallLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] [$Level] $Message"
    try {
        Add-Content -Path $logFile -Value $logLine -Encoding UTF8 -ErrorAction SilentlyContinue
    } catch {}
}

function Safe-Exit {
    param(
        [string]$Message = "Setup aborted due to an error.",
        [string]$Category = "CRITICAL ERROR",
        [string]$Recommendation = "Please check the requirements and try again.",
        [string]$HelpUrl = ""
    )
    
    Write-InstallLog "INSTALLATION FAILED: $Message" "ERROR"
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Red
    Write-Host "  |                    [!] $Category                     |" -ForegroundColor Red
    Write-Host "  ================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  [ERR] $Message" -ForegroundColor Yellow
    if ($Recommendation) {
        Write-Host ""
        Write-Host "  [RECOMMENDATION] $Recommendation" -ForegroundColor Cyan
    }
    if ($HelpUrl) {
        Write-Host "  [LINK] $HelpUrl" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "  Detailed installation log saved to: $logFile" -ForegroundColor DarkGray
    Write-Host "  ================================================================" -ForegroundColor Red
    Write-Host ""
    
    # Critical: Pause so console window never closes unexpectedly on user!
    Write-Host "  Press Enter to exit..." -ForegroundColor Green
    [void](Read-Host)
    exit 1
}

function Refresh-SessionEnvPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;$binDir;C:\Program Files\nodejs;C:\Program Files\Git\cmd;$env:LOCALAPPDATA\Programs\Git\cmd"
}

function Print-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Cyan
    Write-Host "  |   0xAgent — Autonomous AI Developer & Web-IDE Platform       |" -ForegroundColor Cyan
    Write-Host "  |   1-Click Interactive Setup & Native Tray Launcher Engine    |" -ForegroundColor DarkCyan
    Write-Host "  ================================================================" -ForegroundColor Cyan
    Write-Host ""
}

try {
    Print-Banner
    Write-InstallLog "0xAgent Installation started." "INFO"

    # Detect if run from inside an existing cloned repo
    if (Test-Path "package.json") {
        try {
            $currentPkg = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($currentPkg.name -eq "0xagent") {
                $appDir = (Get-Item .).FullName
                Write-Host "  [+] Detected local 0xAgent workspace at: $appDir" -ForegroundColor Green
                Write-InstallLog "Using local workspace: $appDir" "INFO"
            }
        } catch {}
    }

    # 1. Ensure Directories
    try {
        if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }
        if (-not (Test-Path (Join-Path $oxAgentDir "models"))) { New-Item -ItemType Directory -Path (Join-Path $oxAgentDir "models") -Force | Out-Null }
        if (-not (Test-Path (Join-Path $oxAgentDir "llama"))) { New-Item -ItemType Directory -Path (Join-Path $oxAgentDir "llama") -Force | Out-Null }
    } catch {
        Safe-Exit -Message "Failed to create installation directories in $($oxAgentDir): $_" -Category "FILESYSTEM ERROR" -Recommendation "Check folder write permissions or antivirus locks."
    }

    # 2. Check Windows Long Paths
    try {
        $longPathKey = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
        $longPathVal = Get-ItemPropertyValue -Path $longPathKey -Name "LongPathsEnabled" -ErrorAction SilentlyContinue
        if ($longPathVal -ne 1) {
            Write-InstallLog "LongPathsEnabled is disabled or not set." "WARN"
        }
    } catch {}

    # 3. Check System Prerequisites
    Write-Host "  [1/6] Verifying System Prerequisites..." -ForegroundColor Yellow
    $hasWinget = (Get-Command "winget" -ErrorAction SilentlyContinue) -ne $null

    # 3.1. Check Git
    $gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
    if (-not $gitCmd) {
        Refresh-SessionEnvPath
        $gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
    }

    if (-not $gitCmd) {
        Write-Host ""
        Write-Host "  [!] Git is not found on your system." -ForegroundColor Yellow
        Write-Host "      Git is required to download 0xAgent and pull semi-automatic updates." -ForegroundColor Gray
        Write-Host "      Official site: https://git-scm.com/download/win" -ForegroundColor Cyan
        Write-Host ""

        $installedGit = $false
        if ($hasWinget) {
            $choice = Read-Host "  Install Git automatically via winget now? (Y/n)"
            if ($choice -ne "n" -and $choice -ne "N") {
                Write-Host "  [+] Installing Git via winget. If a Windows UAC prompt appears, please click YES..." -ForegroundColor Cyan
                try {
                    Start-Process winget -ArgumentList "install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements" -Wait -NoNewWindow
                    Refresh-SessionEnvPath
                    $gitCmd = Get-Command "git" -ErrorAction SilentlyContinue
                    if ($gitCmd) { $installedGit = $true }
                } catch {
                    Write-InstallLog "Winget git install failed: $_" "WARN"
                }
            }
        }

        if (-not $installedGit -and -not (Get-Command "git" -ErrorAction SilentlyContinue)) {
            Safe-Exit -Message "Git is required to install and run 0xAgent." `
                      -Category "MISSING DEPENDENCY: GIT" `
                      -Recommendation "1. Download and install Git from the official link below.`n  2. Keep all default installer settings.`n  3. Re-run this 0xAgent installation script." `
                      -HelpUrl "https://git-scm.com/download/win"
        }
    }
    Write-Host "  [OK] Git is available." -ForegroundColor Green
    Write-InstallLog "Git check passed." "INFO"

    # 3.2. Check Node.js (>= 24)
    $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Refresh-SessionEnvPath
        $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
    }

    $needNodeInstall = $false
    if (-not $nodeCmd) {
        $needNodeInstall = $true
    } else {
        try {
            $nodeVerStr = & node -v
            $majorVer = [int]($nodeVerStr -replace '^v','' -split '\.')[0]
            if ($majorVer -lt 24) {
                Write-Host "  [!] Detected Node.js $nodeVerStr. 0xAgent requires Node.js >= 24.0.0." -ForegroundColor Yellow
                $needNodeInstall = $true
            } else {
                Write-Host "  [OK] Node.js $nodeVerStr is available (>=24.0.0)." -ForegroundColor Green
                Write-InstallLog "Node.js check passed: $nodeVerStr" "INFO"
            }
        } catch {
            $needNodeInstall = $true
        }
    }

    if ($needNodeInstall) {
        Write-Host ""
        Write-Host "  [!] Node.js (>= 24.0.0) is required (Node 20 is deprecated)." -ForegroundColor Yellow
        Write-Host "      Node.js is the JavaScript runtime engine that powers 0xAgent." -ForegroundColor Gray
        Write-Host "      Official site: https://nodejs.org/" -ForegroundColor Cyan
        Write-Host ""

        $installedNode = $false
        if ($hasWinget) {
            $choice = Read-Host "  Install latest Node.js (v24+) automatically via winget now? (Y/n)"
            if ($choice -ne "n" -and $choice -ne "N") {
                Write-Host "  [+] Installing Node.js via winget. If a Windows UAC prompt appears, please click YES..." -ForegroundColor Cyan
                try {
                    Start-Process winget -ArgumentList "install --id OpenJS.NodeJS -e --source winget --accept-source-agreements --accept-package-agreements" -Wait -NoNewWindow
                    Refresh-SessionEnvPath
                    $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
                    if ($nodeCmd) { $installedNode = $true }
                } catch {
                    Write-InstallLog "Winget node install failed: $_" "WARN"
                }
            }
        }

        if (-not $installedNode -and -not (Get-Command "node" -ErrorAction SilentlyContinue)) {
            Safe-Exit -Message "Node.js >= 24.0.0 is required to run 0xAgent." `
                      -Category "MISSING DEPENDENCY: NODE.JS" `
                      -Recommendation "1. Download and run the Node.js Windows Installer (.msi) from the official website (>= v24).`n  2. Finish the setup wizard with standard settings.`n  3. Re-run this 0xAgent installation script." `
                      -HelpUrl "https://nodejs.org/en/download"
        }
    }


    # 4. Synchronize 0xAgent Codebase
    Write-Host ""
    Write-Host "  [2/6] Synchronizing 0xAgent Codebase..." -ForegroundColor Yellow

    $pkgJsonPath = Join-Path $appDir "package.json"

    if (-not (Test-Path $pkgJsonPath)) {
        if (Test-Path $appDir) {
            # Directory exists but package.json missing (broken/partial clone)
            Write-Host "  [*] Cleaning incomplete directory from previous attempt..." -ForegroundColor Gray
            $backupDir = Join-Path $oxAgentDir ("app_backup_" + (Get-Date -Format "yyyyMMddHHmmss"))
            try {
                Rename-Item -Path $appDir -NewName $backupDir -ErrorAction SilentlyContinue
            } catch {
                Remove-Item -Path $appDir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }

        Write-Host "  [+] Cloning repository into: $appDir" -ForegroundColor Cyan
        Write-InstallLog "Cloning $repoUrl into $appDir" "INFO"
        
        $cloneProc = Start-Process git -ArgumentList "clone $repoUrl `"$appDir`"" -NoNewWindow -PassThru -Wait
        if ($cloneProc.ExitCode -ne 0 -or -not (Test-Path (Join-Path $appDir "package.json"))) {
            Safe-Exit -Message "Failed to clone 0xAgent repository from GitHub. Check your internet connection or proxy." `
                      -Category "GIT CLONE ERROR" `
                      -Recommendation "Check if https://github.com/T58574/0xAgent is accessible from your network." `
                      -HelpUrl "https://github.com/T58574/0xAgent"
        }
    } else {
        Write-Host "  [+] Existing workspace found. Checking for updates..." -ForegroundColor Cyan
        Push-Location $appDir
        try {
            & git fetch origin main 2>$null
            & git pull --rebase origin main 2>$null
            Write-Host "  [OK] Codebase updated to latest release." -ForegroundColor Green
        } catch {
            Write-Host "  [*] Using existing local workspace." -ForegroundColor Gray
        }
        Pop-Location
    }

    # 5. Install NPM Dependencies
    Write-Host ""
    Write-Host "  [3/6] Installing Dependencies (npm install)..." -ForegroundColor Yellow
    Push-Location $appDir
    Write-InstallLog "Running npm install in $appDir" "INFO"

    $npmProc = Start-Process npm -ArgumentList "install --no-audit --no-fund" -WorkingDirectory $appDir -NoNewWindow -PassThru -Wait
    if ($npmProc.ExitCode -ne 0) {
        Write-Host "  [*] Retrying npm install with standard flags..." -ForegroundColor Yellow
        $npmRetry = Start-Process npm -ArgumentList "install" -WorkingDirectory $appDir -NoNewWindow -PassThru -Wait
        if ($npmRetry.ExitCode -ne 0) {
            Pop-Location
            Safe-Exit -Message "NPM dependencies failed to install." `
                      -Category "NPM INSTALL ERROR" `
                      -Recommendation "Check your internet connection or run 'npm cache clean --force' and retry."
        }
    }
    Write-Host "  [OK] Dependencies installed successfully." -ForegroundColor Green
    Pop-Location

    # 6. Build Web Client & Generate SSL
    Write-Host ""
    Write-Host "  [4/6] Building Production Client & Generating Local SSL..." -ForegroundColor Yellow
    Push-Location $appDir
    try {
        & node ./scripts/ensure-ssl.cjs
        $buildProc = Start-Process npm -ArgumentList "run build" -WorkingDirectory $appDir -NoNewWindow -PassThru -Wait
        if ($buildProc.ExitCode -eq 0) {
            Write-Host "  [OK] Production web client compiled successfully." -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Production build had a non-zero exit code. Live dev server will run on launch." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [WARN] Build step reported a warning: $_" -ForegroundColor Yellow
    }
    Pop-Location

    # 7. Compile Native C# Windows Tray Launcher
    Write-Host ""
    Write-Host "  [5/6] Compiling Native C# Tray Launcher (0xAgent.exe)..." -ForegroundColor Yellow
    Push-Location $appDir
    $buildPs1 = Join-Path $appDir "scripts\build-launcher.ps1"
    if (Test-Path $buildPs1) {
        try {
            & powershell -NoProfile -ExecutionPolicy Bypass -File $buildPs1
        } catch {
            Write-Host "  [WARN] Native C# build skipped. Standard CLI launcher will be active." -ForegroundColor Yellow
        }
    }
    Pop-Location

    # 8. Setup Global CLI Command & Path (Preserving Cyrillic & UTF-8)
    Write-Host ""
    Write-Host "  [6/6] Configuring Global '0xagent' CLI & Desktop Shortcuts..." -ForegroundColor Yellow

    try {
        # Create 0xagent.cmd wrapper with UTF-8 encoding (no BOM) to prevent Cyrillic path corruption
        $cliCmdContent = "@echo off`r`nnode `"$appDir\bin\0xagent.js`" %*"
        $cliCmdPath = Join-Path $binDir "0xagent.cmd"
        [System.IO.File]::WriteAllText($cliCmdPath, $cliCmdContent, [System.Text.UTF8Encoding]::new($false))

        # Create 0xagent.ps1 wrapper
        $cliPs1Content = "param([Parameter(ValueFromRemainingArguments=`$true)] `$args)`r`n& node `"$appDir\bin\0xagent.js`" @args"
        $cliPs1Path = Join-Path $binDir "0xagent.ps1"
        [System.IO.File]::WriteAllText($cliPs1Path, $cliPs1Content, [System.Text.UTF8Encoding]::new($false))

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
        Write-Host "  [WARN] Shortcut or PATH registration notice: $_" -ForegroundColor Yellow
    }

    Write-InstallLog "Installation completed successfully." "SUCCESS"

    Write-Host ""
    Write-Host "  ================================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] 0xAgent has been successfully installed!" -ForegroundColor Green
    Write-Host "  ================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  You can now manage and launch 0xAgent from ANY terminal:" -ForegroundColor Cyan
    Write-Host "    - 0xagent          : Launch platform in Windows System Tray" -ForegroundColor White
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
        Write-Host "  [OK] 0xAgent is running in background!" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  Press Enter to close installer..." -ForegroundColor Green
    [void](Read-Host)

} catch {
    Safe-Exit -Message "Unexpected installer exception: $_" -Category "UNHANDLED ERROR" -Recommendation "Check install.log at $logFile for technical trace."
}
