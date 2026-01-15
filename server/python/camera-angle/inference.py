"""
inference.py
Qwen Image Edit model loading and inference for camera angle control.
Uses 4-step fast inference with Rapid-AIO transformer.
"""

import torch
import os
import time
from PIL import Image
from io import BytesIO
import base64
from typing import Optional, Tuple

# ============================================================================
# CONFIGURATION
# ============================================================================

# Model paths (relative to project root)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MODELS_DIR = os.path.join(PROJECT_ROOT, "models", "camera-control")

# Model IDs for HuggingFace
BASE_MODEL_ID = "Qwen/Qwen-Image-Edit-2509"
TRANSFORMER_ID = "linoyts/Qwen-Image-Edit-Rapid-AIO"
LORA_ID = "dx8152/Qwen-Edit-2509-Multiple-angles"
LORA_WEIGHT_NAME = "镜头转换.safetensors"

# Inference settings
DEFAULT_STEPS = 4
DEFAULT_GUIDANCE = 1.0

# ============================================================================
# GLOBAL MODEL STATE
# ============================================================================

_pipe = None
_device = None
_dtype = None


# ============================================================================
# MODEL LOADING
# ============================================================================

def load_model() -> bool:
    """
    Load the Qwen Image Edit pipeline with Rapid-AIO transformer and camera LoRA.
    This is called once at server startup.
    
    Prioritizes local model files from models/camera-control/ folder,
    falls back to HuggingFace download if local files not found.
    
    Returns:
        True if model loaded successfully, False otherwise
    """
    global _pipe, _device, _dtype
    
    try:
        from diffusers import QwenImageEditPlusPipeline, QwenImageTransformer2DModel
        
        print("[Camera Angle] Loading Qwen Image Edit model...")
        start_time = time.time()
        
        # Device and dtype
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        _dtype = torch.bfloat16 if _device == "cuda" else torch.float32
        
        if _device == "cpu":
            print("[Camera Angle] WARNING: Running on CPU - inference will be very slow!")
        
        # --- Determine model paths (local vs HuggingFace) ---
        local_transformer_path = os.path.join(MODELS_DIR, "qwen-rapid-aio")
        local_lora_path = os.path.join(MODELS_DIR, "loras", LORA_WEIGHT_NAME)
        
        # Check if local transformer exists
        if os.path.exists(os.path.join(local_transformer_path, "transformer")):
            transformer_source = local_transformer_path
            print(f"[Camera Angle] Using LOCAL transformer: {local_transformer_path}")
        else:
            transformer_source = TRANSFORMER_ID
            print(f"[Camera Angle] Using HuggingFace transformer: {TRANSFORMER_ID}")
        
        # Check if local LoRA exists
        if os.path.exists(local_lora_path):
            lora_source = MODELS_DIR  # Parent folder of loras/
            print(f"[Camera Angle] Using LOCAL LoRA: {local_lora_path}")
        else:
            lora_source = LORA_ID
            print(f"[Camera Angle] Using HuggingFace LoRA: {LORA_ID}")
        
        # --- Load pipeline with fast transformer ---
        print(f"[Camera Angle] Loading base model: {BASE_MODEL_ID}")
        print("[Camera Angle] Using memory-efficient loading for low VRAM GPUs...")
        
        # Load transformer - use low_cpu_mem_usage to reduce peak memory during loading
        transformer = QwenImageTransformer2DModel.from_pretrained(
            transformer_source,
            subfolder='transformer',
            torch_dtype=_dtype,
            low_cpu_mem_usage=True,
        )
        
        # Load pipeline - keep on CPU initially
        _pipe = QwenImageEditPlusPipeline.from_pretrained(
            BASE_MODEL_ID,
            transformer=transformer,
            torch_dtype=_dtype,
            low_cpu_mem_usage=True,
        )
        
        # Enable SEQUENTIAL CPU offloading - moves each layer to GPU one at a time
        # This uses minimal VRAM but is slower
        print("[Camera Angle] Enabling sequential CPU offloading (layer-by-layer)...")
        _pipe.enable_sequential_cpu_offload()
        
        # --- Load camera angle LoRA ---
        if os.path.exists(local_lora_path):
            # Load from local file
            _pipe.load_lora_weights(
                os.path.join(MODELS_DIR, "loras"),
                weight_name=LORA_WEIGHT_NAME,
                adapter_name="angles"
            )
        else:
            # Load from HuggingFace
            _pipe.load_lora_weights(
                LORA_ID,
                weight_name=LORA_WEIGHT_NAME,
                adapter_name="angles"
            )
        
        # Fuse LoRA for faster inference
        _pipe.set_adapters(["angles"], adapter_weights=[1.0])
        _pipe.fuse_lora(adapter_names=["angles"], lora_scale=1.25)
        _pipe.unload_lora_weights()
        
        load_time = time.time() - start_time
        print(f"[Camera Angle] Model loaded successfully in {load_time:.1f}s")
        print(f"[Camera Angle] Device: {_device} (with CPU offloading), Dtype: {_dtype}")
        
        return True
        
    except ImportError as e:
        print(f"[Camera Angle] ERROR: Missing dependency - {e}")
        print("[Camera Angle] Please run: pip install diffusers torch transformers accelerate")
        return False
        
    except Exception as e:
        print(f"[Camera Angle] ERROR: Failed to load model - {e}")
        import traceback
        traceback.print_exc()
        return False


def is_model_loaded() -> bool:
    """Check if the model is loaded and ready."""
    return _pipe is not None


def get_model_status() -> dict:
    """Get current model status information."""
    return {
        "loaded": is_model_loaded(),
        "device": str(_device) if _device else None,
        "dtype": str(_dtype) if _dtype else None,
        "gpu_available": torch.cuda.is_available(),
        "gpu_name": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "gpu_memory_allocated": f"{torch.cuda.memory_allocated(0) / 1024**3:.2f} GB" if torch.cuda.is_available() else None,
    }


# ============================================================================
# INFERENCE
# ============================================================================

def generate_camera_angle(
    image: Image.Image,
    prompt: str,
    seed: Optional[int] = None,
    num_steps: int = DEFAULT_STEPS,
    guidance_scale: float = DEFAULT_GUIDANCE,
) -> Tuple[Image.Image, int, float]:
    """
    Generate a new image with modified camera angle.
    
    Args:
        image: Input PIL Image
        prompt: Camera movement prompt (from prompts.py)
        seed: Random seed (None for random)
        num_steps: Number of inference steps (default 4)
        guidance_scale: CFG scale (default 1.0)
    
    Returns:
        Tuple of (result_image, seed_used, inference_time_ms)
    """
    global _pipe, _device
    
    if not is_model_loaded():
        raise RuntimeError("Model not loaded. Call load_model() first.")
    
    if prompt == "no camera movement":
        return image, seed or 0, 0.0
    
    # Generate seed if not provided
    if seed is None:
        import random
        seed = random.randint(0, 2**32 - 1)
    
    generator = torch.Generator(device=_device).manual_seed(seed)
    
    # Ensure image is RGB
    if image.mode != "RGB":
        image = image.convert("RGB")
    
    # Run inference
    start_time = time.time()
    
    result = _pipe(
        image=[image],
        prompt=prompt,
        num_inference_steps=num_steps,
        generator=generator,
        true_cfg_scale=guidance_scale,
        num_images_per_prompt=1,
    ).images[0]
    
    inference_time = (time.time() - start_time) * 1000  # Convert to ms
    
    return result, seed, inference_time


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 string."""
    buffer = BytesIO()
    image.save(buffer, format=format)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def base64_to_image(base64_str: str) -> Image.Image:
    """Convert base64 string to PIL Image."""
    # Handle data URI format
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    
    image_data = base64.b64decode(base64_str)
    return Image.open(BytesIO(image_data))


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("Testing model status...")
    status = get_model_status()
    for key, value in status.items():
        print(f"  {key}: {value}")
