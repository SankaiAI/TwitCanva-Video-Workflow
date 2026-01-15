"""
app.py
FastAPI server for Camera Angle Control using Qwen Image Edit model.
Run with: python server/python/camera-angle/app.py
"""

import os
import sys

# Add project root to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn

from inference import (
    load_model, 
    is_model_loaded, 
    get_model_status,
    generate_camera_angle,
    base64_to_image,
    image_to_base64
)
from prompts import build_camera_prompt


# ============================================================================
# FASTAPI APP
# ============================================================================

app = FastAPI(
    title="Camera Angle Control API",
    description="Generate images with modified camera angles using Qwen Image Edit",
    version="1.0.0"
)

# CORS - allow requests from TwitCanva frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# REQUEST/RESPONSE MODELS
# ============================================================================

class GenerateRequest(BaseModel):
    """Request body for camera angle generation."""
    image: str = Field(..., description="Base64 encoded input image")
    rotation: float = Field(0.0, description="Horizontal rotation (-180 to 180 degrees)")
    tilt: float = Field(0.0, description="Vertical tilt (-90 to 90 degrees)")
    zoom: float = Field(0.0, description="Zoom level (0 = normal)")
    wide_angle: bool = Field(False, description="Apply wide-angle lens effect")
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")
    num_steps: int = Field(4, description="Number of inference steps")


class GenerateResponse(BaseModel):
    """Response body for camera angle generation."""
    image: str = Field(..., description="Base64 encoded result image")
    prompt: str = Field(..., description="Generated camera movement prompt")
    seed: int = Field(..., description="Seed used for generation")
    inference_time_ms: float = Field(..., description="Inference time in milliseconds")


class StatusResponse(BaseModel):
    """Response body for status endpoint."""
    loaded: bool
    device: Optional[str]
    dtype: Optional[str]
    gpu_available: bool
    gpu_name: Optional[str]
    gpu_memory_allocated: Optional[str]


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "model_loaded": is_model_loaded()}


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """Get model and GPU status."""
    return get_model_status()


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """
    Generate a new image with modified camera angle.
    
    Takes an input image and camera control parameters,
    returns the transformed image.
    """
    if not is_model_loaded():
        raise HTTPException(
            status_code=503, 
            detail="Model not loaded. Server is starting up, please wait."
        )
    
    try:
        # Build the camera prompt from control values
        prompt = build_camera_prompt(
            rotation=request.rotation,
            tilt=request.tilt,
            zoom=request.zoom,
            wide_angle=request.wide_angle
        )
        
        # Decode input image
        input_image = base64_to_image(request.image)
        
        # Generate
        result_image, seed, inference_time = generate_camera_angle(
            image=input_image,
            prompt=prompt,
            seed=request.seed,
            num_steps=request.num_steps
        )
        
        # Encode result
        result_base64 = image_to_base64(result_image)
        
        return GenerateResponse(
            image=result_base64,
            prompt=prompt,
            seed=seed,
            inference_time_ms=inference_time
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# STARTUP
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Load model on server startup."""
    print("=" * 60)
    print("Camera Angle Control API - Starting up...")
    print("=" * 60)
    
    success = load_model()
    if not success:
        print("WARNING: Model failed to load. Server will return 503 errors.")
    
    print("=" * 60)
    print(f"Server ready at http://localhost:8100")
    print("=" * 60)


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8100,
        reload=False,  # Disable reload to avoid loading model multiple times
        log_level="info"
    )
