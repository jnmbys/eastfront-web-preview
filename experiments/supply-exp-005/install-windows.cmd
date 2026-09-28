@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto missingpython
where node >nul 2>nul
if errorlevel 1 goto missingnode
where npm >nul 2>nul
if errorlevel 1 goto missingnode
set "EF_VENV=%LOCALAPPDATA%\EF007\venv"
py -3.12 -m venv "%EF_VENV%"
if errorlevel 1 goto failed
"%EF_VENV%\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed
"%EF_VENV%\Scripts\python.exe" restore-fixtures.py
if errorlevel 1 goto failed
call npm exec --yes --package typescript@5.7.3 -- tsc -p core\tsconfig.json
if errorlevel 1 goto failed
"%EF_VENV%\Scripts\python.exe" -c "import pathlib; assert pathlib.Path('core/dist/index.js').is_file()"
if errorlevel 1 goto failed
echo Installation complete. Run start-windows.cmd next.
pause
exit /b 0
:missingpython
echo Python launcher missing. Install Python 3.12 for this user, then retry.
goto failed
:missingnode
echo Node.js or npm missing. Install Node.js 22 or newer, then retry.
:failed
echo Installation stopped. Read the error above. No global configuration was changed.
pause
exit /b 1
