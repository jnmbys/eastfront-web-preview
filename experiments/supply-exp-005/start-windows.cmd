@echo off
setlocal
cd /d "%~dp0"
set "EF_VENV=%LOCALAPPDATA%\EF007\venv"
if not exist "%EF_VENV%\Scripts\python.exe" goto missing
if not exist "core\dist\index.js" goto missing
where node >nul 2>nul
if errorlevel 1 goto missing
echo Open http://127.0.0.1:8765 after the ready message. Keep this window open.
"%EF_VENV%\Scripts\python.exe" server.py
if errorlevel 1 goto failed
exit /b 0
:missing
echo Dependencies missing. Run install-windows.cmd first.
:failed
echo Start stopped. Read the error above.
pause
exit /b 1
