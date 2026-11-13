@echo off
setlocal
set "SKELLY_ROOT=%~dp0"
set "SKELLY_PY=%SKELLY_ROOT%.skelly-build\voice-research-env\Scripts\python.exe"
if not exist "%SKELLY_PY%" (
  echo Skelly Live could not find its local Python environment.
  echo See docs\skelly-live-operator.md for setup.
  echo Keep this file in the project folder. To use it from the desktop, create a shortcut to it.
  pause
  exit /b 1
)
if not exist "%SKELLY_ROOT%.skelly-build\voice-research-env\Scripts\pythonw.exe" (
  echo The local Python windowed runtime is missing. Recreate the environment using the setup notes.
  pause
  exit /b 1
)
"%SKELLY_PY%" -c "import tkinter, ctypes, socket" >nul 2>&1
if errorlevel 1 (
  echo The local Python environment is incomplete. Check the setup notes.
  pause
  exit /b 1
)
start "" "%SKELLY_ROOT%.skelly-build\voice-research-env\Scripts\pythonw.exe" "%SKELLY_ROOT%scripts\skelly-live-launcher.py"
