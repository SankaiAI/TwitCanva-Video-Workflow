#!/bin/bash
# Start Camera Angle Control Server (Linux/macOS)
# Runs the FastAPI server for Qwen Image Edit camera angle control

echo "========================================"
echo "Camera Angle Control Server"
echo "========================================"

# Navigate to project root
cd "$(dirname "$0")"

# Activate virtual environment
echo "Activating Python virtual environment..."
source venv/bin/activate

# Check if model is downloaded (optional check)
if [ ! -d "models/camera-control/qwen-rapid-aio/transformer" ]; then
    echo ""
    echo "WARNING: Models not found!"
    echo "Please download models first:"
    echo "  huggingface-cli download linoyts/Qwen-Image-Edit-Rapid-AIO \\"
    echo "      --local-dir models/camera-control/qwen-rapid-aio \\"
    echo "      --include 'transformer/*'"
    echo ""
    echo "Continuing anyway - models will download on first run..."
    echo ""
fi

# Start the server
echo "Starting FastAPI server on http://localhost:8100 ..."
echo "Press Ctrl+C to stop"
echo ""

python server/python/camera-angle/app.py
