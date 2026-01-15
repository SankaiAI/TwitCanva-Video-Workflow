"""
prompts.py
Camera angle prompt construction for Qwen Image Edit model.
Converts rotation/tilt values to Chinese+English bilingual prompts.
MATCHES LOGIC IN: modal/camera_angle.py
"""

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


# ============================================================================
# PROMPT BUILDER
# ============================================================================

def build_camera_prompt(
    rotation: float = 0.0,
    tilt: float = 0.0,
    zoom: float = 0.0,
    wide_angle: bool = False
) -> str:
    """
    Build a camera movement prompt based on control values.
    
    Args:
        rotation: Horizontal rotation in degrees. Positive = right, negative = left.
        tilt: Vertical tilt in degrees. Positive = camera looks down (bird's-eye), negative = looks up (worm's-eye).
        zoom: Zoom level 0-10. Higher = closer.
        wide_angle: Whether to apply wide-angle lens effect (not used in modal currently)
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
    
    # Wide Angle (legacy support for local mode if needed)
    if wide_angle:
        prompt_parts.append(PROMPT_TEMPLATES["wide_angle"])
    
    final_prompt = " ".join(prompt_parts).strip()
    return final_prompt if final_prompt else PROMPT_TEMPLATES["no_movement"]


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    # Test examples
    print("Testing prompt generation:")
    print(f"  rotation=45 (Right): {build_camera_prompt(rotation=45)}")
    print(f"  rotation=-30 (Left): {build_camera_prompt(rotation=-30)}")
    print(f"  tilt=20 (Bird's Eye): {build_camera_prompt(tilt=20)}")
    print(f"  tilt=-15 (Worm's Eye): {build_camera_prompt(tilt=-15)}")
    print(f"  combined:     {build_camera_prompt(rotation=90, tilt=20)}")
    print(f"  no movement:  {build_camera_prompt()}")
