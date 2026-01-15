"""
camera_angle.py
Modal serverless deployment for Qwen Camera Angle Control.

Deploy with: modal deploy modal/camera_angle.py
Test with: modal run modal/camera_angle.py

NOTE: First request will take 5-10 minutes to download models (~35GB).
      Subsequent requests will be fast (~10-30s).
"""

import modal
import io
import base64

# ============================================================================
# CONTAINER IMAGE (dependencies only - NO model download)
# ============================================================================

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.0.0",
        "torchvision",  # Required for AutoVideoProcessor
        "diffusers>=0.28.0",
        "transformers>=4.36.0",
        "accelerate>=0.25.0",
        "safetensors>=0.4.0",
        "Pillow>=9.0.0",
        "huggingface-hub>=0.20.0",
        "peft",  # Required for LoRA loading
        "fastapi",  # Required for @modal.fastapi_endpoint
    )
)

# Create the Modal app
app = modal.App("camera-angle-control", image=image)

# ============================================================================
# MODEL CONFIGURATION
# ============================================================================

BASE_MODEL_ID = "Qwen/Qwen-Image-Edit-2509"
TRANSFORMER_ID = "linoyts/Qwen-Image-Edit-Rapid-AIO"
LORA_ID = "dx8152/Qwen-Edit-2509-Multiple-angles"
LORA_WEIGHT_NAME = "镜头转换.safetensors"

# Use Modal Volume for persistent model caching
model_volume = modal.Volume.from_name("camera-angle-models", create_if_missing=True)
MODEL_CACHE_PATH = "/models"


# ============================================================================
# PROMPT TEMPLATES
# ============================================================================

# ============================================================================
# PROMPT TEMPLATES
# ============================================================================

# These prompts are bilingual (Chinese + English) to match the Qwen LoRA training data
PROMPT_TEMPLATES = {
    "rotate_left": "将镜头向左旋转{degrees}度 Rotate the camera {degrees} degrees to the left.",
    "rotate_right": "将镜头向右旋转{degrees}度 Rotate the camera {degrees} degrees to the right.",
    "birds_eye": "将相机转向鸟瞰视角 Turn the camera to a bird's-eye view.",
    "worms_eye": "将相机切换到仰视视角 Turn the camera to a worm's-eye view.",
    "close_up": "将镜头转为特写镜头 Turn the camera to a close-up.",
    "wide_angle": "将镜头转为广角镜头 Turn the camera to a wide-angle lens.",
    "no_movement": "no camera movement"
}


def build_camera_prompt(rotation: float = 0.0, tilt: float = 0.0, zoom: float = 0.0) -> str:
    """Build camera movement prompt from control values.
    
    Args:
        rotation: Horizontal rotation in degrees. Positive = right, negative = left.
        tilt: Vertical tilt in degrees. Positive = camera looks down (bird's-eye), negative = looks up (worm's-eye).
        zoom: Zoom level 0-10. Higher = closer.
    """
    prompt_parts = []
    
    # Rotation: horizontal camera movement around subject
    if rotation != 0:
        degrees = abs(int(rotation))
        if rotation > 0:
            # Positive rotation = camera moves to the right of subject
            prompt_parts.append(PROMPT_TEMPLATES["rotate_right"].format(degrees=degrees))
        else:
            # Negative rotation = camera moves to the left of subject
            prompt_parts.append(PROMPT_TEMPLATES["rotate_left"].format(degrees=degrees))
    
    # Tilt: vertical camera angle
    # The demo shows that mixing specific degrees for rotation with categorical tilt works best
    if tilt > 5:
        prompt_parts.append(PROMPT_TEMPLATES["birds_eye"])
    elif tilt < -5:
        prompt_parts.append(PROMPT_TEMPLATES["worms_eye"])
    
    # Zoom
    if zoom > 5:
        prompt_parts.append(PROMPT_TEMPLATES["close_up"])
    
    final_prompt = " ".join(prompt_parts).strip()
    return final_prompt if final_prompt else PROMPT_TEMPLATES["no_movement"]


# ============================================================================
# MODAL CLASS WITH MODEL
# ============================================================================

@app.cls(
    gpu="A100",  # 40GB VRAM - enough for full model
    memory=65536,  # 64GB RAM (needed for loading large checkpoint shards)
    timeout=900,  # 15 min timeout for first-time model download
    scaledown_window=300,  # Shut down after 5 min idle
    volumes={MODEL_CACHE_PATH: model_volume},
)
class CameraAngle:
    """Qwen Camera Angle Control model running on Modal."""
    
    @modal.enter()
    def load_model(self):
        """
        Load model when container starts.
        First run downloads ~35GB models (takes 5-10 min).
        Subsequent runs load from cached volume (takes ~60s).
        """
        import os
        import torch
        from diffusers import QwenImageEditPlusPipeline, QwenImageTransformer2DModel
        
        # Set HuggingFace cache to persistent volume
        os.environ["HF_HOME"] = MODEL_CACHE_PATH
        os.environ["TRANSFORMERS_CACHE"] = MODEL_CACHE_PATH
        os.environ["HF_HUB_CACHE"] = MODEL_CACHE_PATH
        
        print(f"[Enter] Loading model... (cache: {MODEL_CACHE_PATH})")
        print(f"[Enter] GPU: {torch.cuda.get_device_name(0)}")
        print(f"[Enter] VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        
        # Load pipeline with fast transformer
        print("[Enter] Loading transformer...")
        transformer = QwenImageTransformer2DModel.from_pretrained(
            TRANSFORMER_ID,
            subfolder='transformer',
            torch_dtype=torch.bfloat16,
            cache_dir=MODEL_CACHE_PATH,
            low_cpu_mem_usage=True,  # Memory-efficient loading
        )
        
        print("[Enter] Loading base pipeline...")
        self.pipe = QwenImageEditPlusPipeline.from_pretrained(
            BASE_MODEL_ID,
            transformer=transformer,
            torch_dtype=torch.bfloat16,
            cache_dir=MODEL_CACHE_PATH,
            low_cpu_mem_usage=True,  # Memory-efficient loading
        )
        # Model is ~40GB - too large for A100-40GB. Use CPU offloading.
        print("[Enter] Enabling sequential CPU offloading...")
        self.pipe.enable_sequential_cpu_offload()
        
        # Load camera angle LoRA
        print("[Enter] Loading LoRA...")
        self.pipe.load_lora_weights(
            LORA_ID,
            weight_name=LORA_WEIGHT_NAME,
            adapter_name="angles",
            cache_dir=MODEL_CACHE_PATH,
        )
        
        # Fuse LoRA for faster inference
        self.pipe.set_adapters(["angles"], adapter_weights=[1.0])
        self.pipe.fuse_lora(adapter_names=["angles"], lora_scale=1.25)
        self.pipe.unload_lora_weights()
        
        # Commit volume to persist downloaded models
        model_volume.commit()
        
        print("[Enter] Model loaded successfully!")
    
    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: dict) -> dict:
        """Generate camera angle adjusted image."""
        import torch
        from PIL import Image
        
        # Parse request
        image_b64 = request.get("image", "")
        rotation = request.get("rotation", 0.0)
        tilt = request.get("tilt", 0.0)
        zoom = request.get("zoom", 0.0)
        seed = request.get("seed")
        num_steps = request.get("num_steps", 4)
        
        # Log received values
        print("=" * 60)
        print("[Generate] Received request:")
        print(f"  rotation: {rotation}")
        print(f"  tilt: {tilt}")
        print(f"  zoom: {zoom}")
        print(f"  seed: {seed}")
        print(f"  num_steps: {num_steps}")
        print(f"  image length: {len(image_b64)} chars")
        
        # Build prompt
        prompt = build_camera_prompt(rotation, tilt, zoom)
        print(f"[Generate] Built prompt: {prompt}")
        print("=" * 60)
        
        if prompt == "no camera movement":
            print("[Generate] No movement - returning original image")
            return {"image": image_b64, "prompt": prompt, "seed": 0}
        
        # Decode input image
        if "," in image_b64:
            image_b64 = image_b64.split(",")[1]
        image_data = base64.b64decode(image_b64)
        input_image = Image.open(io.BytesIO(image_data)).convert("RGB")
        
        # Generate seed
        if seed is None:
            import random
            seed = random.randint(0, 2**32 - 1)
        
        generator = torch.Generator(device="cuda").manual_seed(seed)
        
        # Run inference
        import time
        start_time = time.time()
        
        result = self.pipe(
            image=[input_image],
            prompt=prompt,
            num_inference_steps=num_steps,
            generator=generator,
            true_cfg_scale=1.0,
            num_images_per_prompt=1,
        ).images[0]
        
        inference_time = (time.time() - start_time) * 1000
        
        # Encode result
        buffer = io.BytesIO()
        result.save(buffer, format="PNG")
        result_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        return {
            "image": result_b64,
            "prompt": prompt,
            "seed": seed,
            "inference_time_ms": inference_time
        }
    
    @modal.fastapi_endpoint(method="GET")
    def health(self) -> dict:
        """Health check endpoint."""
        return {"status": "ok", "model": "Qwen Camera Angle Control"}


# ============================================================================
# LOCAL TESTING
# ============================================================================

@app.local_entrypoint()
def main():
    """Test the model locally."""
    print("Testing Camera Angle Control...")
    
    # Test health endpoint
    camera = CameraAngle()
    print(camera.health.remote())
    
    print("Test complete!")
