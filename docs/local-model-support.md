# Local Open-Source Model Support for TwitCanva

Enable users to download open-source AI models and use them in the TwitCanva canvas workflow with a simple, guided UI—no ComfyUI complexity needed.

---

## Design Philosophy

| Approach | TwitCanva | ComfyUI |
|----------|-----------|---------|
| **UI** | Simple, guided | Node-based, flexible |
| **Workflows** | Prebuilt, invisible to users | User builds manually |
| **Model support** | Popular families (~95% of downloads) | Any model with custom nodes |
| **Learning curve** | Minimal | Steep |

**Key insight**: Users just want to select a model and generate. The prebuilt workflows are an internal implementation detail—users never see or manage them.

---

## User Flow

```
Step 1: Download model → Place in models/checkpoints/
Step 2: Right-click → Add Local Image Model node
Step 3: Select model from dropdown
Step 4: Enter prompt
Step 5: Click Generate → Image appears
```

**That's it.** No workflow management, no technical setup.

---

## Architecture

### Prebuilt Workflow System

Instead of exposing nodes to users, TwitCanva maintains internal workflows for each model architecture:

```
User Action                    What App Does Internally
───────────                    ─────────────────────────
Select "dreamshaper8"    →     Detects: "This is SD 1.5 architecture"
                               Loads:   SD 1.5 workflow
                               
Click "Generate"         →     Runs:    LoadCheckpoint → CLIPEncode → 
                                        KSampler → VAEDecode
                                        
Image appears            →     Returns: Generated image to node
```

### Model Registry (`config/model-registry.json`)

Single source of truth for all supported model architectures:

```json
{
  "architectures": {
    "sd15": {
      "name": "Stable Diffusion 1.5",
      "pipeline": "StableDiffusionPipeline",
      "detection": {
        "sizeRange": [2000000000, 4500000000],
        "patterns": ["*sd15*", "*sd1.5*"]
      },
      "defaults": {
        "steps": 30,
        "guidance": 7.5,
        "scheduler": "DPMSolverMultistep"
      },
      "resolutions": ["512x512", "512x768", "768x512"]
    },
    "sdxl": {
      "name": "Stable Diffusion XL",
      "pipeline": "StableDiffusionXLPipeline",
      "detection": {
        "sizeRange": [6000000000, 8000000000],
        "patterns": ["*sdxl*", "*xl*"]
      },
      "defaults": {
        "steps": 30,
        "guidance": 7.0
      },
      "resolutions": ["1024x1024", "1024x1536", "1536x1024"]
    },
    "flux": {
      "name": "Flux",
      "pipeline": "FluxPipeline",
      "detection": {
        "sizeRange": [11000000000, 25000000000],
        "patterns": ["*flux*"]
      },
      "defaults": {
        "steps": 28,
        "guidance": 3.5
      }
    },
    "animatediff": {
      "name": "AnimateDiff",
      "pipeline": "AnimateDiffPipeline",
      "type": "video",
      "defaults": {
        "steps": 25,
        "frames": 16
      }
    }
  },
  "version": "1.0.0"
}
```

### When to Update the Registry

| Scenario | New Entry Needed? |
|----------|-------------------|
| User downloads another SD1.5 checkpoint | ❌ No - same workflow works |
| User downloads SDXL LoRA | ❌ No - add to existing SDXL workflow |
| New popular architecture (e.g., Mochi) | ✅ Yes - add new entry + pipeline |

---

## Model Detection

When a user selects a model, the app detects its architecture:

| Method | How |
|--------|-----|
| **Filename patterns** | `*sd15*`, `*sdxl*`, `*flux*` |
| **File size** | SD1.5 ~2-4GB, SDXL ~6-7GB, Flux ~12GB |
| **HuggingFace config** | Read `model_index.json` if present |
| **Fallback** | Ask user to select architecture once |

### Fallback UI (rare case)

```
⚠️ We couldn't detect the model type.

Select architecture:
○ Stable Diffusion 1.5
○ Stable Diffusion XL  
○ Flux
○ AnimateDiff (Video)

[Save & Continue]
```

---

## Folder Structure

```
models/
├── checkpoints/   # Main image models (SD, SDXL, Flux)
├── loras/         # LoRA adapters
├── controlnet/    # ControlNet models
└── video/         # Video models (AnimateDiff, SVD)
```

| Folder | Model Types | Examples |
|--------|-------------|----------|
| `checkpoints/` | Main image generation | DreamShaper, Juggernaut XL, Flux |
| `loras/` | Style/character adapters | Art styles, detail enhancers |
| `controlnet/` | Guided generation | OpenPose, Canny, Depth |
| `video/` | Video generation | AnimateDiff, SVD |

---

## Supported Architectures (Priority)

### Phase 1 (MVP)
- [x] **SD 1.5** - Covers 60%+ of Civitai models
- [ ] **SDXL** - Covers 25%+ of newer models

### Phase 2
- [ ] **Flux** - Flux-dev, Flux-schnell
- [ ] **AnimateDiff** - Video generation

### Phase 3
- [ ] **ControlNet** - Guided generation
- [ ] **LoRA loading** - Style/character adapters

### Future (as needed)
- [ ] CogVideoX, Mochi, etc.

---

## Hardware Requirements

> [!TIP]
> **Minimum Requirements**:
> - NVIDIA GPU with 8GB+ VRAM (SD 1.5, smaller models)
> - NVIDIA GPU with 12GB+ VRAM (SDXL, Flux)

---

## Implementation Files

| Component | File | Status |
|-----------|------|--------|
| Types | `src/types.ts` | ✅ Done |
| Frontend Service | `src/services/localModelService.ts` | ✅ Done |
| API Route | `server/routes/local-models.js` | ✅ Done |
| Inference Service | `server/services/local-inference.js` | ✅ Done |
| Python Script | `scripts/inference.py` | ✅ Done |
| Hook | `src/hooks/useLocalModelNodeHandlers.ts` | ✅ Done |
| Model Registry | `config/model-registry.json` | ⏳ TODO |
| Multi-architecture | `scripts/inference.py` | ⏳ TODO |

---

## Setup Instructions

### For Users Who Clone the Repo

```bash
# Option 1: npm script (recommended)
npm run setup:local-models

# Option 2: Run script directly
# Windows:
setup-local-models.bat

# Linux/macOS:
chmod +x setup-local-models.sh && ./setup-local-models.sh
```

This will:
1. Create Python virtual environment (`venv/`)
2. Install PyTorch with CUDA support
3. Create `models/` directory structure
4. Test GPU detection
