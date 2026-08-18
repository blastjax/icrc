@echo off
setlocal

rem This script can be moved anywhere (e.g. the Desktop) - it always
rem points back at the real project folder and its virtual environment.
set "PROJECT_DIR=C:\Users\MicahLuis.Cruz\thea.icrc"
set "VENV_DIR=%PROJECT_DIR%\venv"
set "PYTHON=%VENV_DIR%\Scripts\python.exe"

title ICRC Contract Generator

if not exist "%PYTHON%" (
    echo Virtual environment not found. Creating it now...
    where python >nul 2>nul
    if errorlevel 1 (
        echo Python was not found on PATH. Please install Python and try again.
        pause
        exit /b 1
    )
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo Failed to create the virtual environment.
        pause
        exit /b 1
    )
    "%PYTHON%" -m pip install --upgrade pip
    "%PYTHON%" -m pip install -r "%PROJECT_DIR%\requirements.txt"
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
)

cd /d "%PROJECT_DIR%"

echo Checking for updates...
git pull
if errorlevel 1 (
    echo Warning: git pull failed. Continuing with the current version.
)
echo.

rem Open the browser a couple seconds after launch, once the server is up.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:5000/"

echo Starting ICRC Contract Generator...
echo Close this window to stop the server.
echo.

"%PYTHON%" app.py

echo.
echo Server stopped.
pause
