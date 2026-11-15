@echo off
rem Zynvixs first-time setup. Installs everything inside this folder only.
setlocal
cd /d "%~dp0"
title Zynvixs setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" %*
if errorlevel 1 (
  echo.
  echo Setup did not finish. Read the message above, fix it, and run Setup.bat again.
) else (
  echo.
  echo Setup finished. Double-click Zynvixs.bat to start Zynvixs.
)
echo.
pause
