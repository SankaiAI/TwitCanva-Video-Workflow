# Camera Angle Control - Modal Integration Plan

## Overview

This document describes how to deploy and integrate the Qwen Camera Angle Control model using Modal serverless GPUs.

## Architecture

```
┌─────────────────────┐        HTTPS         ┌─────────────────────────┐
│   TwitCanva App     │  ─────────────────▶  │   Modal Serverless      │
│   (Frontend)        │                      │   (A100 GPU, 40GB VRAM) │
└─────────────────────┘                      └───────────┬─────────────┘
                                                         │
                                                         ▼
                                             ┌─────────────────────────┐
                                             │   Qwen Image Edit       │
                                             │   + Camera Angle LoRA   │
                                             └─────────────────────────┘
```

## Setup Steps

### 1. Install Modal CLI
```bash
pip install modal
python -m modal setup  # Opens browser for authentication
```

### 2. Deploy to Modal
```bash
modal deploy modal/camera_angle.py
```

### 3. Get Your Endpoint URLs
After deployment, Modal provides URLs like:
- `https://sankai-aicareer--camera-angle-control-cameraangle-generate.modal.run`
- `https://sankai-aicareer--camera-angle-control-cameraangle-health.modal.run`

### 4. Add to Environment
```env
# .env
MODAL_CAMERA_ENDPOINT=https://your-username--camera-angle-control-cameraangle-generate.modal.run
```

---

## API Reference

### POST /generate

Generate a camera-angle-adjusted image.

**Request:**
```json
{
  "image": "base64-encoded-image",
  "rotation": 45.0,    // -180 to 180 degrees (horizontal)
  "tilt": 20.0,        // -90 to 90 degrees (vertical)
  "zoom": 0.0,         // 0-10 (close-up effect)
  "seed": 12345,       // optional
  "num_steps": 4       // optional (default: 4)
}
```

**Response:**
```json
{
  "image": "base64-encoded-result",
  "prompt": "将镜头向左旋转45度 Rotate...",
  "seed": 12345,
  "inference_time_ms": 15234.5
}
```

### GET /health

Check model status.

**Response:**
```json
{
  "status": "ok",
  "model": "Qwen Camera Angle Control"
}
```

---

## Frontend Integration

### Update ChangeAnglePanel.tsx

```typescript
// src/components/canvas/ChangeAnglePanel.tsx

const MODAL_ENDPOINT = import.meta.env.VITE_MODAL_CAMERA_ENDPOINT;

const handleGenerate = async () => {
  setIsGenerating(true);
  
  try {
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        rotation: cameraRotation,
        tilt: cameraTilt,
        zoom: cameraZoom,
      }),
    });
    
    const result = await response.json();
    onImageGenerated(`data:image/png;base64,${result.image}`);
    
  } catch (error) {
    console.error('Camera angle generation failed:', error);
  } finally {
    setIsGenerating(false);
  }
};
```

---

## Cost Breakdown

| Event | Cost |
|-------|------|
| Cold start (~60s model loading) | ~$0.08 |
| Inference (~15-30s) | ~$0.04-0.08 |
| **Total per request (warm)** | **~$0.04-0.08** |
| **Total per request (cold)** | **~$0.12-0.16** |
| Idle container | Free (scales to zero) |

> **Note:** A100 is ~2x the cost of A10G, but provides 40GB VRAM (vs 24GB) for reliable model loading.

**Monthly Estimates:**
- 50 requests/day: ~$60-100/mo
- 200 requests/day: ~$240-400/mo

---

## Model Caching

Models are cached in a Modal Volume (`camera-angle-models`):
- First request downloads ~35GB (takes 5-10 min)
- Subsequent container starts load from cache (~60s)
- Volume persists between deployments

---

## Troubleshooting

### Cold Start Takes Long
- First request after idle downloads/loads models
- Wait 60-120 seconds for warm-up
- Use health endpoint to pre-warm

### Out of Memory
- Increase `memory=65536` (64GB) in `@app.cls`
- Already configured for A10G (24GB VRAM)

### Model Download Fails
- Check Modal logs: `modal logs camera-angle-control`
- Verify HuggingFace access to model repos

---

## Files

| File | Purpose |
|------|---------|
| `modal/camera_angle.py` | Modal deployment definition |
| `src/components/canvas/ChangeAnglePanel.tsx` | Frontend integration |
| `.env` | Modal endpoint URL |
