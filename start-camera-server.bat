@echo off
REM Start Camera Angle Control Server (Windows)
REM Runs the FastAPI server for Qwen Image Edit camera angle control

echo ========================================
echo Camera Angle Control Server
echo ========================================

REM Navigate to project root
cd /d "%~dp0"

REM Set HuggingFace cache to D: drive (prevents filling C: drive)
set HF_HOME=D:\HuggingFace_Cache
echo Using cache: %HF_HOME%

REM Activate virtual environment
echo Activating Python virtual environment...
call venv\Scripts\activate.bat

REM Check if model is downloaded (optional check)
if not exist "models\camera-control\qwen-rapid-aio\transformer" (
    echo.
    echo WARNING: Models not found!
    echo Please download models first:
    echo   huggingface-cli download linoyts/Qwen-Image-Edit-Rapid-AIO ^
    echo       --local-dir models\camera-control\qwen-rapid-aio ^
    echo       --include "transformer/*"
    echo.
    echo Continuing anyway - models will download on first run...
    echo.
)

REM Start the server
echo Starting FastAPI server on http://localhost:8100 ...
echo Press Ctrl+C to stop
echo.

python server\python\camera-angle\app.py
