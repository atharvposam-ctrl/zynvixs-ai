@echo off
setlocal
cd /d "%~dp0"
title Zynvixs AI - RTX 3060
set CUDA_VISIBLE_DEVICES=0
set PYTHONIOENCODING=utf-8
if not exist "runtime\llama.cpp\llama-server.exe" (
    echo Runtime missing. Run Setup.bat first.
    pause
    exit /b 1
)
if not exist "Zynvixs.bat" (
    echo Place this file beside Zynvixs.bat in your application folder.
    pause
    exit /b 1
)
call "%~dp0Zynvixs.bat"
pause
