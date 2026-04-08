@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%server\start-translator.ps1"

if not exist "%PS_SCRIPT%" (
  echo Could not find "%PS_SCRIPT%".
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

if errorlevel 1 (
  echo.
  echo The translator server did not start correctly.
  pause
)

endlocal
