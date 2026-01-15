"""
inference.py

Local model inference script for TwitCanva.
Handles image and video generation using locally installed models.

Usage:
    python inference.py --model_path <path> --prompt <prompt> --output <output_path>
"""

import argparse
import json
import sys
import os
from pathlib import Path

# Suppress warnings for cleaner output
import warnings
warnings.filterwarnings('ignore')


def load_registry():
    """Load model registry from config file."""
    registry_path = Path(__file__).parent.parent / 'config' / 'model-registry.json'
    if registry_path.exists():
        try:
            with open(registry_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load registry: {e}", file=sys.stderr)
    return None


# Load registry on module import
MODEL_REGISTRY = load_registry()


def check_dependencies():
    """Check and report missing dependencies."""
    missing = []
    
    try:
        import torch
    except ImportError:
        missing.append('torch')
    
    try:
        from PIL import Image
    except ImportError:
        missing.append('pillow')
    
    if missing:
        print(json.dumps({
            'success': False,
            'error': f"Missing dependencies: {', '.join(missing)}. Run: pip install {' '.join(missing)}"
        }))
        sys.exit(1)


def get_device():
    """Get the best available device for inference."""
    import torch
    
    if torch.cuda.is_available():
        return 'cuda'
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        return 'mps'  # Apple Silicon
    return 'cpu'


def detect_model_type(model_path: str, file_size: int = 0) -> str:
    """Detect model type from filename, file size, or registry patterns."""
    name = Path(model_path).stem.lower()
    
    # Use registry if available
    if MODEL_REGISTRY and 'architectures' in MODEL_REGISTRY:
        detection_order = MODEL_REGISTRY.get('detectionOrder', list(MODEL_REGISTRY['architectures'].keys()))
        
        for arch_key in detection_order:
            arch = MODEL_REGISTRY['architectures'].get(arch_key)
            if not arch or 'detection' not in arch:
                continue
            
            # Check filename patterns
            patterns = arch['detection'].get('patterns', [])
            for pattern in patterns:
                clean_pattern = pattern.replace('*', '').lower()
                if clean_pattern and clean_pattern in name:
                    return arch_key
            
            # Check file size if provided
            if file_size > 0 and 'sizeRange' in arch['detection']:
                min_size, max_size = arch['detection']['sizeRange']
                if min_size <= file_size <= max_size:
                    # Size matches - continue checking for better pattern match
                    pass
        
        # Size-based fallback
        if file_size > 0:
            for arch_key in detection_order:
                arch = MODEL_REGISTRY['architectures'].get(arch_key)
                if arch and 'detection' in arch and 'sizeRange' in arch['detection']:
                    min_size, max_size = arch['detection']['sizeRange']
                    if min_size <= file_size <= max_size:
                        return arch_key
    
    # Hardcoded fallback
    if 'sdxl' in name or 'sd_xl' in name:
        return 'sdxl'
    if 'sd15' in name or 'sd_1.5' in name or 'sd-1-5' in name:
        return 'sd15'
    if 'flux' in name:
        return 'flux'
    if 'animatediff' in name:
        return 'animatediff'
    
    # Default to SD 1.5 compatible
    return 'sd15'


def get_architecture_defaults(arch_key: str) -> dict:
    """Get default parameters for an architecture from registry."""
    if MODEL_REGISTRY and 'architectures' in MODEL_REGISTRY:
        arch = MODEL_REGISTRY['architectures'].get(arch_key, {})
        return arch.get('defaults', {})
    return {}



def generate_with_diffusers(
    model_path: str,
    prompt: str,
    output_path: str,
    negative_prompt: str = "",
    width: int = 512,
    height: int = 512,
    steps: int = 30,
    guidance_scale: float = 7.5,
    seed: int = -1
):
    """Generate image using Hugging Face diffusers library."""
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    from PIL import Image
    
    device = get_device()
    model_type = detect_model_type(model_path)
    
    print(f"Loading model from {model_path}...", file=sys.stderr)
    print(f"Model type: {model_type}, Device: {device}", file=sys.stderr)
    
    # Load pipeline based on model type
    if model_type in ['sd15', 'sd21']:
        pipe = StableDiffusionPipeline.from_single_file(
            model_path,
            torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
            use_safetensors=model_path.endswith('.safetensors')
        )
    else:
        # For other model types, try loading as single file first
        try:
            pipe = StableDiffusionPipeline.from_single_file(
                model_path,
                torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
                use_safetensors=model_path.endswith('.safetensors')
            )
        except Exception as e:
            print(f"Warning: Failed to load as single file, trying pretrained: {e}", file=sys.stderr)
            pipe = StableDiffusionPipeline.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if device == 'cuda' else torch.float32
            )
    
    # Use faster scheduler
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)
    
    # Enable memory optimizations
    if device == 'cuda':
        try:
            pipe.enable_attention_slicing()
        except:
            pass
    
    # Set seed
    generator = None
    if seed >= 0:
        generator = torch.Generator(device=device).manual_seed(seed)
    
    print(f"Generating with prompt: {prompt[:100]}...", file=sys.stderr)
    
    # Generate
    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        generator=generator
    )
    
    # Save image
    image = result.images[0]
    image.save(output_path)
    
    return {
        'success': True,
        'output_path': output_path,
        'width': image.width,
        'height': image.height,
        'model_type': model_type,
        'device': device
    }


def generate_with_sdxl(
    model_path: str,
    prompt: str,
    output_path: str,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
    steps: int = 30,
    guidance_scale: float = 7.5,
    seed: int = -1
):
    """Generate image using SDXL pipeline."""
    import torch
    from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
    
    device = get_device()
    
    print(f"Loading SDXL model from {model_path}...", file=sys.stderr)
    
    pipe = StableDiffusionXLPipeline.from_single_file(
        model_path,
        torch_dtype=torch.float16 if device == 'cuda' else torch.float32,
        use_safetensors=model_path.endswith('.safetensors')
    )
    
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)
    
    if device == 'cuda':
        try:
            pipe.enable_attention_slicing()
        except:
            pass
    
    generator = None
    if seed >= 0:
        generator = torch.Generator(device=device).manual_seed(seed)
    
    print(f"Generating with prompt: {prompt[:100]}...", file=sys.stderr)
    
    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        generator=generator
    )
    
    image = result.images[0]
    image.save(output_path)
    
    return {
        'success': True,
        'output_path': output_path,
        'width': image.width,
        'height': image.height,
        'model_type': 'sdxl',
        'device': device
    }


def main():
    parser = argparse.ArgumentParser(description='TwitCanva Local Model Inference')
    parser.add_argument('--model_path', required=True, help='Path to the model file')
    parser.add_argument('--prompt', required=True, help='Generation prompt')
    parser.add_argument('--output', required=True, help='Output file path')
    parser.add_argument('--negative_prompt', default='', help='Negative prompt')
    parser.add_argument('--width', type=int, default=0, help='Image width (0 = use architecture default)')
    parser.add_argument('--height', type=int, default=0, help='Image height (0 = use architecture default)')
    parser.add_argument('--steps', type=int, default=0, help='Inference steps (0 = use architecture default)')
    parser.add_argument('--guidance_scale', type=float, default=0, help='Guidance scale (0 = use architecture default)')
    parser.add_argument('--seed', type=int, default=-1, help='Random seed (-1 for random)')
    parser.add_argument('--architecture', default='', help='Explicit architecture (sd15, sdxl, flux, etc.)')
    
    args = parser.parse_args()
    
    # Check dependencies
    check_dependencies()
    
    # Validate model path
    if not os.path.exists(args.model_path):
        print(json.dumps({
            'success': False,
            'error': f"Model file not found: {args.model_path}"
        }))
        sys.exit(1)
    
    try:
        # Get file size for detection
        file_size = os.path.getsize(args.model_path)
        
        # Use explicit architecture if provided, otherwise detect
        if args.architecture:
            model_type = args.architecture
        else:
            model_type = detect_model_type(args.model_path, file_size)
        
        # Get defaults from registry
        defaults = get_architecture_defaults(model_type)
        
        # Apply defaults if not explicitly set
        width = args.width if args.width > 0 else defaults.get('width', 512)
        height = args.height if args.height > 0 else defaults.get('height', 512)
        steps = args.steps if args.steps > 0 else defaults.get('steps', 30)
        guidance_scale = args.guidance_scale if args.guidance_scale > 0 else defaults.get('guidance', 7.5)
        
        print(f"[Inference] Architecture: {model_type}, Size: {width}x{height}, Steps: {steps}", file=sys.stderr)
        
        if model_type == 'sdxl':
            result = generate_with_sdxl(
                model_path=args.model_path,
                prompt=args.prompt,
                output_path=args.output,
                negative_prompt=args.negative_prompt,
                width=width,
                height=height,
                steps=steps,
                guidance_scale=guidance_scale,
                seed=args.seed
            )
        else:
            result = generate_with_diffusers(
                model_path=args.model_path,
                prompt=args.prompt,
                output_path=args.output,
                negative_prompt=args.negative_prompt,
                width=width,
                height=height,
                steps=steps,
                guidance_scale=guidance_scale,
                seed=args.seed
            )
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
