#!/bin/bash
# ============================================================================
# TwitCanva - Local Models Setup Script (Linux/macOS)
# 
# This script sets up the Python virtual environment for local AI model support.
# Run this once after cloning the repo if you want to use local models.
# ============================================================================

echo ""
echo "========================================"
echo " TwitCanva Local Models Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed."
    echo "Please install Python 3.10+ first."
    exit 1
fi

echo "[1/4] Creating Python virtual environment..."
if [ -d "venv" ]; then
    echo "      venv already exists, skipping..."
else
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to create virtual environment."
        exit 1
    fi
fi

echo "[2/4] Activating virtual environment..."
source venv/bin/activate

echo "[3/4] Installing PyTorch with CUDA support..."
echo "      This may take several minutes..."

# Detect OS for appropriate PyTorch installation
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use MPS (Metal) or CPU
    pip install torch torchvision
else
    # Linux - try CUDA first
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
    if [ $? -ne 0 ]; then
        echo "[WARNING] CUDA installation failed. Trying CPU-only version..."
        pip install torch torchvision
    fi
fi

echo "[4/4] Creating models directory structure..."
mkdir -p models/checkpoints
mkdir -p models/loras
mkdir -p models/controlnet
mkdir -p models/video

echo ""
echo "========================================"
echo " Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Download models from HuggingFace"
echo "  2. Place them in the models/ folder"
echo "  3. Start the app with: npm run dev"
echo ""
echo "Testing GPU..."
venv/bin/python -c "import torch; print('CUDA Available:', torch.cuda.is_available()); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None (CPU mode)')"
