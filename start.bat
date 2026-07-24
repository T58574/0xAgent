@echo off
chcp 65001 > nul
title 0xAgent Test and Launcher

echo ========================================================
echo               0xAgent AI Platform Launcher
echo ========================================================
echo.

echo [0/3] Clearing stale processes on port 3001 and 5173...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo.

echo [1/3] Testing TypeScript Compilation (Frontend and Backend)...
call npx tsc --noEmit
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] TypeScript compilation failed!
    echo Launch aborted. Please fix the errors above.
    pause
    exit /b %errorlevel%
)
echo [SUCCESS] TypeScript type check passed cleanly.
echo.

echo [2/3] Testing Vite Production Build...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Vite build failed!
    echo Launch aborted.
    pause
    exit /b %errorlevel%
)
echo [SUCCESS] Vite production build passed cleanly.
echo.

echo [3/3] Launching 0xAgent Server and Client...
echo App UI: http://localhost:5173
echo API Server: http://localhost:3001
echo.
echo Press Ctrl+C to stop.
echo ========================================================
echo.

call npm run dev
