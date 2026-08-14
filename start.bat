@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title 0xAgent AI Platform

cd /d "%~dp0"

:: If Windows Terminal (wt.exe) is installed and we are not already inside it, launch in Windows Terminal
if "%WT_SESSION%"=="" (
    where wt.exe >nul 2>nul
    if !errorlevel! equ 0 (
        start "" wt.exe -d "%~dp0" powershell.exe -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"
        exit /b 0
    )
)

:: Fallback: Direct PowerShell invocation
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1"

if %errorlevel% neq 0 (
    echo.
    echo [0xAgent] Platform session ended with code %errorlevel%.
    pause
)
