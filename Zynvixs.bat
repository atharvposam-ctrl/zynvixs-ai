@echo off
rem Zynvixs launcher: starts the local server and opens the app in your browser.
rem Close this window (or press Ctrl+C) to stop Zynvixs and free the GPU.
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo Zynvixs is not set up yet. Double-click Setup.bat first.
  pause
  exit /b 1
)
if not exist "frontend\dist\index.html" (
  echo The interface has not been built. Double-click Setup.bat first.
  pause
  exit /b 1
)

title Zynvixs
set PYTHONIOENCODING=utf-8
cd backend
"..\.venv\Scripts\python.exe" -X utf8 -m zynvixs
