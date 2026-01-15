@echo off
REM ============================================================================
REM TwitCanva - Local Models Setup Script (Windows)
REM 
REM This script sets up the Python virtual environment for local AI model support.
REM Run this once after cloning the repo if you want to use local models.
REM ============================================================================

echo.
echo ========================================
echo  TwitCanva Local Models Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo [1/4] Creating Python virtual environment...
if exist venv (
    echo       venv already exists, skipping...
) else (
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo [2/4] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/4] Installing PyTorch with CUDA support...
echo       This may take several minutes (downloading ~2.8GB)...
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

if errorlevel 1 (
    echo [WARNING] CUDA installation failed. Trying CPU-only version...
    pip install torch torchvision
)

echo [4/4] Creating models directory structure...
if not exist models\checkpoints mkdir models\checkpoints
if not exist models\loras mkdir models\loras
if not exist models\controlnet mkdir models\controlnet
if not exist models\video mkdir models\video

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Download models from HuggingFace
echo   2. Place them in the models/ folder
echo   3. Start the app with: npm run dev
echo.
echo Testing GPU...
venv\Scripts\python -c "import torch; print('CUDA Available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None (CPU mode)')"
echo.
pause
