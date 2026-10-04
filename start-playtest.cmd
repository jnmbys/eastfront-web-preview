@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 22 or newer first. & pause & exit /b 1)
if not exist node_modules\typescript\bin\tsc (call npm ci & if errorlevel 1 exit /b 1)
node ai/local/build.mjs
if errorlevel 1 (pause & exit /b 1)
set PORT=4183
echo Open http://127.0.0.1:4183/ -- Ctrl+C stops the local server.
node scripts/serve.mjs .ai003-preview
