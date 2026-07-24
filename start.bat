@echo off
chcp 65001 > nul
title 0xAgent AI Platform Launcher

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [0xAgent] Launcher exited with code %errorlevel%.
    pause
)
