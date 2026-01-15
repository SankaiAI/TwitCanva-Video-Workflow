# Camera Angle Control - Local Model Integration

Enable camera angle manipulation for generated images using the Qwen Image Edit model with FastAPI-based local inference.

---

## Overview

| Feature | Details |
|---------|---------|
| **Model** | Qwen Image Edit 2509 + Camera Angle LoRA |
| **Inference** | 4-step fast inference via Rapid-AIO transformer |
| **Backend** | FastAPI Python server (separate from Node.js) |
| **GPU VRAM** | 20-24GB required |

---

## Architecture

```
┌─────────────────┐    HTTP     ┌─────────────────────┐
│   TwitCanva     │ ─────────▶ │   FastAPI Server    │
│   Frontend      │  :8100     │   (camera-angle)    │
└─────────────────┘            └──────────┬──────────┘
         │                                │
         │                                ▼
         │                       ┌─────────────────────┐
         │                       │   Qwen Model        │
         │                       │   (GPU Inference)   │
         │ :3001                 └─────────────────────┘
         ▼
┌─────────────────┐
│   Node.js       │
│   Server        │
└─────────────────┘
```

---

## Model Download

### Required Models (~45GB total)

```
models/
└── camera-control/
    ├── qwen-image-edit-2509/       # Base model (~15GB)
    │   └── (auto-downloaded by diffusers)
    ├── qwen-rapid-aio/             # Fast transformer (~20GB)
    │   └── transformer/
    │       └── transformer_weights.safetensors
    └── loras/
        └── 镜头转换.safetensors    # Angle LoRA (~236MB)
```

### Download Commands

```bash
# Activate venv first!
.\venv\Scripts\activate    # Windows
source venv/bin/activate   # Linux/macOS

# Install huggingface-cli if needed
pip install -U huggingface-hub

# Download fast transformer (~20GB)
huggingface-cli download linoyts/Qwen-Image-Edit-Rapid-AIO \
    --local-dir models/camera-control/qwen-rapid-aio \
    --include "transformer/*"

# Download camera angle LoRA (~236MB)
huggingface-cli download dx8152/Qwen-Edit-2509-Multiple-angles \
    镜头转换.safetensors \
    --local-dir models/camera-control/loras
```

> [!NOTE]
> The base model `Qwen/Qwen-Image-Edit-2509` will auto-download on first run (~15GB).

---

## HuggingFace Cache Configuration

By default, HuggingFace caches downloaded models to your **C: drive** at:
```
C:\Users\<username>\.cache\huggingface\hub\
```

This can quickly fill up your system drive. We recommend moving the cache to another drive.

### Change Cache Location (Recommended)

**Windows (PowerShell):**
```powershell
# Set HF_HOME to your preferred location
[System.Environment]::SetEnvironmentVariable("HF_HOME", "D:\HuggingFace_Cache", "User")

# Restart terminal, then verify
$env:HF_HOME
```

**Linux/macOS:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export HF_HOME="/path/to/your/cache"

# Apply changes
source ~/.bashrc
```

### Clear Existing Cache

If you've already downloaded models and want to free up C: drive space:

```powershell
# Check cache size
(Get-ChildItem -Path "$env:USERPROFILE\.cache\huggingface" -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB

# Delete cache (safe if models are in models/camera-control/)
Remove-Item -Recurse -Force "$env:USERPROFILE\.cache\huggingface\hub"
```

---

## FastAPI Server

### File Structure

```
server/
└── python/                 # Python-based services (separate from Node.js)
    └── camera-angle/
        ├── app.py          # FastAPI application
        ├── inference.py    # Model loading & inference
        └── prompts.py      # Camera prompt construction
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/generate` | POST | Generate new camera angle |
| `/status` | GET | GPU/model status |

### Request Format

```json
POST /generate
{
    "image": "base64_encoded_image_data",
    "rotation": 45,       // -180 to 180 degrees
    "tilt": -30,          // -90 to 90 degrees
    "seed": 42            // optional
}
```

### Response Format

```json
{
    "image": "base64_encoded_result",
    "prompt": "将镜头向右旋转45度... Rotate the camera 45 degrees...",
    "seed": 42,
    "inference_time_ms": 5200
}
```

---

## Prompt Mapping

The 3D control values map to Chinese+English prompts:

| Control | Value | Prompt |
|---------|-------|--------|
| Rotation | +45° | 将镜头向左旋转45度 Rotate the camera 45 degrees to the left |
| Rotation | -45° | 将镜头向右旋转45度 Rotate the camera 45 degrees to the right |
| Tilt | < -10° | 将相机转向鸟瞰视角 Turn the camera to a bird's-eye view |
| Tilt | > +10° | 将相机切换到仰视视角 Turn the camera to a worm's-eye view |

---

## Frontend Integration

Update `ChangeAnglePanel.tsx` to call the FastAPI server:

```typescript
const generateAngle = async () => {
    const response = await fetch('http://localhost:8100/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            image: imageBase64,
            rotation: settings.rotation,
            tilt: settings.tilt
        })
    });
    const result = await response.json();
    return result.image;
};
```

---

## Implementation Steps

### Phase 1: Backend Setup
- [ ] Install FastAPI dependencies (`pip install fastapi uvicorn`)
- [ ] Create `server/python/camera-angle/app.py`
- [ ] Create `server/python/camera-angle/inference.py`
- [ ] Test with hardcoded image

### Phase 2: Model Download
- [ ] Download qwen-rapid-aio transformer (~29GB)
- [ ] Download camera-angles LoRA (~200MB)
- [ ] Verify folder structure

### Phase 3: Integration
- [ ] Add camera angle API call to `ChangeAnglePanel.tsx`
- [ ] Handle loading states
- [ ] Error handling & retry logic

### Phase 4: Startup Scripts
- [ ] Create `start-camera-server.bat` (Windows)
- [ ] Create `start-camera-server.sh` (Linux/macOS)
- [ ] Update README with instructions

---

## Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU VRAM | 20GB | 24GB |
| GPU | RTX 3090 | RTX 4090 |
| RAM | 32GB | 64GB |
| Disk | 50GB free | 100GB free |

> [!WARNING]
> This feature requires a high-end NVIDIA GPU. AMD GPUs are not supported.

---

## Startup Commands

```bash
# Terminal 1: Start Node.js server (existing)
npm run dev

# Terminal 2: Start camera angle server (new)
.\venv\Scripts\activate
python server/python/camera-angle/app.py
# Server runs on http://localhost:8100
```
