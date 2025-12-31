/**
 * kling.js
 * 
 * Kling AI API service for video and image generation.
 * Handles JWT authentication, task creation, and polling.
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const KLING_BASE_URL = 'https://api-singapore.klingai.com';

// ============================================================================
// JWT AUTHENTICATION
// ============================================================================

/**
 * Generate JWT token for Kling AI API authentication
 * Token is valid for 30 minutes
 */
export function generateKlingJWT(accessKey, secretKey) {
    if (!accessKey || !secretKey) {
        throw new Error('Kling API credentials not configured');
    }

    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: accessKey,
        exp: now + 1800, // 30 minutes
        nbf: now - 5     // Valid from 5 seconds ago to handle clock skew
    };

    // Base64url encode
    const base64UrlEncode = (obj) => {
        const json = JSON.stringify(obj);
        const base64 = Buffer.from(json).toString('base64');
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(header);
    const payloadEncoded = base64UrlEncode(payload);
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    // HMAC-SHA256 signature
    const signature = crypto.createHmac('sha256', secretKey)
        .update(signatureInput)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract raw base64 from data URL (removes data:image/xxx;base64, prefix)
 */
function extractRawBase64(dataUrl) {
    if (!dataUrl) return null;
    if (dataUrl.startsWith('data:')) {
        return dataUrl.replace(/^data:[^;]+;base64,/, '');
    }
    return dataUrl;
}

/**
 * Map frontend model ID to Kling API model_name for video
 */
function mapKlingVideoModelName(modelId) {
    const mapping = {
        'kling-v1': 'kling-v1',
        'kling-v1-5': 'kling-v1-5',
        'kling-v1-6': 'kling-v1-6',
        'kling-v2-master': 'kling-v2-master',
        'kling-v2-1': 'kling-v2-1',
        'kling-v2-1-master': 'kling-v2-1-master',
        'kling-v2-5-turbo': 'kling-v2-5-turbo',
        'kling-v2-6': 'kling-v2-6'
    };
    return mapping[modelId] || 'kling-v2-1';
}

/**
 * Map frontend model ID to Kling API model_name for image
 */
function mapKlingImageModelName(modelId) {
    const mapping = {
        'kling-v1': 'kling-v1',
        'kling-v1-5': 'kling-v1-5',
        'kling-v2': 'kling-v2',
        'kling-v2-new': 'kling-v2-new',
        'kling-v2-1': 'kling-v2-1'
    };
    return mapping[modelId] || 'kling-v2-1';
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

/**
 * Poll Kling video task status until complete
 */
async function pollKlingVideoTask(taskId, endpoint, token, maxWaitMs = 300000) {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(`${KLING_BASE_URL}/v1/videos/${endpoint}/${taskId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.code !== 0) {
            throw new Error(`Kling API error: ${result.message || 'Unknown error'}`);
        }

        const status = result.data?.task_status;
        console.log(`Kling task ${taskId} status: ${status}`);

        if (status === 'succeed') {
            const videoUrl = result.data?.task_result?.videos?.[0]?.url;
            if (!videoUrl) {
                throw new Error('No video URL in successful response');
            }
            return videoUrl;
        } else if (status === 'failed') {
            throw new Error(`Kling generation failed: ${result.data?.task_status_msg || 'Unknown error'}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Kling generation timed out');
}

/**
 * Generate video using Kling AI Image-to-Video API
 */
export async function generateKlingVideo({ prompt, imageBase64, lastFrameBase64, motionReferenceUrl, modelId, aspectRatio, duration, accessKey, secretKey }) {
    const token = generateKlingJWT(accessKey, secretKey);
    const modelName = mapKlingVideoModelName(modelId);

    // Use 'pro' mode when doing frame-to-frame (with end frame) or motion control, otherwise 'std'
    const useProMode = !!lastFrameBase64 || !!motionReferenceUrl;

    // Map aspect ratio - default to 16:9
    const mappedAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

    // Prepare request body - duration can be 5 or 10 seconds
    const body = {
        model_name: modelName,
        mode: useProMode ? 'pro' : 'std',
        duration: String(duration || 5),
        aspect_ratio: mappedAspectRatio,
        prompt: prompt || ''
    };

    // Add start frame image
    if (imageBase64) {
        body.image = extractRawBase64(imageBase64);
    }

    // Add end frame image (requires pro mode for most models)
    if (lastFrameBase64) {
        body.image_tail = extractRawBase64(lastFrameBase64);
    }

    // Add motion reference video (for Kling 2.6 Character and Motion)
    if (motionReferenceUrl) {
        body.motion_video = extractRawBase64(motionReferenceUrl);
    }

    console.log(`Kling Video Gen: Using model ${modelName}, mode: ${body.mode}, has image: ${!!imageBase64}, has tail: ${!!lastFrameBase64}, has motion: ${!!motionReferenceUrl}`);

    // Create task
    const response = await fetch(`${KLING_BASE_URL}/v1/videos/image2video`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.code !== 0) {
        throw new Error(`Kling API error: ${result.message || 'Failed to create task'}`);
    }

    const taskId = result.data?.task_id;
    if (!taskId) {
        throw new Error('No task ID returned from Kling API');
    }

    console.log(`Kling task created: ${taskId}`);

    // Poll for completion
    return await pollKlingVideoTask(taskId, 'image2video', token);
}

// ============================================================================
// MOTION CONTROL (Two-Step Workflow)
// ============================================================================

/**
 * Poll for motion extraction task completion
 * Returns the work_id needed for motion-create
 */
async function pollMotionUploadTask(taskId, token, maxAttempts = 60) {
    console.log(`[Motion Control] Polling motion extraction task ${taskId}...`);

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000)); // 3 second intervals

        const response = await fetch(`${KLING_BASE_URL}/v1/videos/motion/upload/${taskId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.code !== 0) {
            console.error(`[Motion Control] Poll error for ${taskId}:`, result.message);
            throw new Error(`Kling motion poll error: ${result.message}`);
        }

        const status = result.data?.task_status;
        console.log(`[Motion Control] Task ${taskId} status: ${status}`);

        if (status === 'succeed') {
            const workId = result.data?.task_result?.work_id;
            if (!workId) {
                throw new Error('Motion extraction succeeded but no work_id returned');
            }
            console.log(`[Motion Control] Motion extracted successfully! work_id: ${workId}`);
            return workId;
        } else if (status === 'failed') {
            const errorMsg = result.data?.task_status_msg || 'Motion extraction failed';
            console.error(`[Motion Control] Task ${taskId} failed:`, errorMsg);
            throw new Error(`Kling motion extraction failed: ${errorMsg}`);
        }
    }

    throw new Error('Motion extraction timed out');
}

/**
 * Poll for motion-create video generation task completion
 */
async function pollMotionCreateTask(taskId, token, maxAttempts = 60) {
    console.log(`[Motion Control] Polling motion-create task ${taskId}...`);

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const response = await fetch(`${KLING_BASE_URL}/v1/videos/motion/${taskId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (result.code !== 0) {
            console.error(`[Motion Control] Poll error for ${taskId}:`, result.message);
            throw new Error(`Kling motion-create poll error: ${result.message}`);
        }

        const status = result.data?.task_status;
        console.log(`[Motion Control] Task ${taskId} status: ${status}`);

        if (status === 'succeed') {
            const videos = result.data?.task_result?.videos;
            if (!videos || videos.length === 0 || !videos[0].url) {
                throw new Error('Motion-create succeeded but no video URL returned');
            }
            console.log(`[Motion Control] Video generated successfully!`);
            return videos[0].url;
        } else if (status === 'failed') {
            const errorMsg = result.data?.task_status_msg || 'Motion-create failed';
            console.error(`[Motion Control] Task ${taskId} failed:`, errorMsg);
            throw new Error(`Kling motion-create failed: ${errorMsg}`);
        }
    }

    throw new Error('Motion-create video generation timed out');
}

/**
 * Generate video using Kling AI Motion Control (two-step workflow)
 * Step 1: Upload motion reference video to extract motion data
 * Step 2: Apply extracted motion to character image
 * 
 * @param {Object} params
 * @param {string} params.prompt - Text prompt to guide the generation
 * @param {string} params.characterImageBase64 - Base64 image of the character to animate
 * @param {string} params.motionVideoBase64 - Base64 video containing the motion to extract
 * @param {number} params.duration - Video duration (5 or 10 seconds)
 * @param {string} params.accessKey - Kling API access key
 * @param {string} params.secretKey - Kling API secret key
 * @returns {Promise<string>} URL of the generated video
 */
export async function generateKlingMotionControl({
    prompt,
    characterImageBase64,
    motionVideoBase64,
    duration = 5,
    accessKey,
    secretKey
}) {
    console.log('\n========================================');
    console.log('[Motion Control] Starting two-step motion control workflow');
    console.log(`[Motion Control] Parameters:`);
    console.log(`  - Prompt: ${prompt ? prompt.substring(0, 50) + '...' : '(none)'}`);
    console.log(`  - Character Image: ${characterImageBase64 ? 'YES (' + Math.round(characterImageBase64.length / 1024) + ' KB)' : 'NO'}`);
    console.log(`  - Motion Video: ${motionVideoBase64 ? 'YES (' + Math.round(motionVideoBase64.length / 1024) + ' KB)' : 'NO'}`);
    console.log(`  - Duration: ${duration}s`);
    console.log('========================================\n');

    if (!motionVideoBase64) {
        throw new Error('[Motion Control] Motion reference video is required');
    }
    if (!characterImageBase64) {
        throw new Error('[Motion Control] Character image is required');
    }

    const token = generateKlingJWT(accessKey, secretKey);

    // ========================================
    // STEP 1: Upload motion video for extraction
    // ========================================
    console.log('[Motion Control] STEP 1: Uploading motion video for extraction...');

    const uploadBody = {
        video: extractRawBase64(motionVideoBase64)
    };

    console.log(`[Motion Control] Sending motion-upload request to ${KLING_BASE_URL}/v1/videos/motion/upload`);

    const uploadResponse = await fetch(`${KLING_BASE_URL}/v1/videos/motion/upload`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(uploadBody)
    });

    const uploadResult = await uploadResponse.json();

    console.log(`[Motion Control] Upload response code: ${uploadResult.code}`);
    console.log(`[Motion Control] Upload response message: ${uploadResult.message || 'OK'}`);

    if (uploadResult.code !== 0) {
        console.error('[Motion Control] Motion upload failed:', uploadResult);
        throw new Error(`Kling motion upload error: ${uploadResult.message || 'Failed to upload motion video'}`);
    }

    const uploadTaskId = uploadResult.data?.task_id;
    if (!uploadTaskId) {
        throw new Error('No task ID returned from motion upload');
    }

    console.log(`[Motion Control] Motion upload task created: ${uploadTaskId}`);

    // Poll for motion extraction completion
    const workId = await pollMotionUploadTask(uploadTaskId, token);

    // ========================================
    // STEP 2: Create video using extracted motion + character image
    // ========================================
    console.log('\n[Motion Control] STEP 2: Creating video with extracted motion...');

    const createBody = {
        work_id: workId,
        image: extractRawBase64(characterImageBase64),
        prompt: prompt || '',
        duration: String(duration),
        mode: 'pro'  // Motion control requires pro mode
    };

    console.log(`[Motion Control] Motion-create parameters:`);
    console.log(`  - work_id: ${workId}`);
    console.log(`  - prompt: ${createBody.prompt.substring(0, 50) || '(none)'}`);
    console.log(`  - duration: ${createBody.duration}s`);
    console.log(`  - mode: ${createBody.mode}`);
    console.log(`[Motion Control] Sending motion-create request to ${KLING_BASE_URL}/v1/videos/motion`);

    const createResponse = await fetch(`${KLING_BASE_URL}/v1/videos/motion`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createBody)
    });

    const createResult = await createResponse.json();

    console.log(`[Motion Control] Create response code: ${createResult.code}`);
    console.log(`[Motion Control] Create response message: ${createResult.message || 'OK'}`);

    if (createResult.code !== 0) {
        console.error('[Motion Control] Motion-create failed:', createResult);
        throw new Error(`Kling motion-create error: ${createResult.message || 'Failed to create motion video'}`);
    }

    const createTaskId = createResult.data?.task_id;
    if (!createTaskId) {
        throw new Error('No task ID returned from motion-create');
    }

    console.log(`[Motion Control] Motion-create task created: ${createTaskId}`);

    // Poll for video generation completion
    const videoUrl = await pollMotionCreateTask(createTaskId, token);

    console.log('\n========================================');
    console.log('[Motion Control] SUCCESS! Video generated.');
    console.log(`[Motion Control] Video URL: ${videoUrl}`);
    console.log('========================================\n');

    return videoUrl;
}

/**
 * Generate video using Kling AI Multi-Image-to-Video API (for frame-to-frame)
 */
export async function generateKlingMultiImageVideo({ prompt, imageList, aspectRatio, accessKey, secretKey }) {
    const token = generateKlingJWT(accessKey, secretKey);

    // Multi-image only supports kling-v1-6
    const body = {
        model_name: 'kling-v1-6',
        mode: 'std',
        duration: '10',
        prompt: prompt || '',
        aspect_ratio: aspectRatio === '9:16' ? '9:16' : '16:9',
        image_list: imageList.map(img => ({ image: extractRawBase64(img) }))
    };

    console.log(`Kling Multi-Image Gen: ${imageList.length} images`);

    const response = await fetch(`${KLING_BASE_URL}/v1/videos/multi-image2video`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.code !== 0) {
        throw new Error(`Kling API error: ${result.message || 'Failed to create task'}`);
    }

    const taskId = result.data?.task_id;
    if (!taskId) {
        throw new Error('No task ID returned from Kling API');
    }

    console.log(`Kling multi-image task created: ${taskId}`);

    // Poll for completion
    return await pollKlingVideoTask(taskId, 'multi-image2video', token);
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Poll Kling image task status until complete
 */
async function pollKlingImageTask(taskId, token, maxWaitMs = 120000) {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds for images

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(`${KLING_BASE_URL}/v1/images/generations/${taskId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.code !== 0) {
            throw new Error(`Kling API error: ${result.message || 'Unknown error'}`);
        }

        const status = result.data?.task_status;
        console.log(`Kling image task ${taskId} status: ${status}`);

        if (status === 'succeed') {
            const imageUrl = result.data?.task_result?.images?.[0]?.url;
            if (!imageUrl) {
                throw new Error('No image URL in successful response');
            }
            return imageUrl;
        } else if (status === 'failed') {
            throw new Error(`Kling image generation failed: ${result.data?.task_status_msg || 'Unknown error'}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Kling image generation timed out');
}

/**
 * Poll Kling multi-image-to-image task status until complete
 */
async function pollKlingMultiImageTask(taskId, token, maxWaitMs = 120000) {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds for images

    while (Date.now() - startTime < maxWaitMs) {
        const response = await fetch(`${KLING_BASE_URL}/v1/images/multi-image2image/${taskId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.code !== 0) {
            throw new Error(`Kling API error: ${result.message || 'Unknown error'}`);
        }

        const status = result.data?.task_status;
        console.log(`Kling multi-image task ${taskId} status: ${status}`);

        if (status === 'succeed') {
            const imageUrl = result.data?.task_result?.images?.[0]?.url;
            if (!imageUrl) {
                throw new Error('No image URL in successful response');
            }
            return imageUrl;
        } else if (status === 'failed') {
            throw new Error(`Kling multi-image generation failed: ${result.data?.task_status_msg || 'Unknown error'}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Kling multi-image generation timed out');
}

/**
 * Generate image using Kling AI Multi-Image to Image API
 * Combines multiple subject images into one generated image
 * 
 * @param prompt - Text prompt describing the desired output
 * @param subjectImages - Array of base64 images to use as subjects
 * @param sceneImage - Optional scene reference image (base64)
 * @param styleImage - Optional style reference image (base64)
 * @param modelId - Model ID (kling-v2 or kling-v2-1)
 * @param aspectRatio - Output aspect ratio
 */
export async function generateKlingMultiImage({
    prompt,
    subjectImages,
    sceneImage,
    styleImage,
    modelId,
    aspectRatio,
    resolution,
    accessKey,
    secretKey
}) {
    const token = generateKlingJWT(accessKey, secretKey);

    // Multi-image-to-image only supports kling-v2 and kling-v2-1
    const modelName = modelId === 'kling-v2-1' ? 'kling-v2-1' : 'kling-v2';

    // Map resolution: "1K" -> "1k", "2K" -> "2k"
    const resolutionMap = {
        'Auto': '1k',
        '1K': '1k',
        '2K': '2k'
    };
    const mappedResolution = resolutionMap[resolution] || '1k';

    // Map aspect ratio
    const ratioMapping = {
        'Auto': '16:9',
        '1:1': '1:1',
        '16:9': '16:9',
        '9:16': '9:16',
        '4:3': '4:3',
        '3:4': '3:4',
        '3:2': '3:2',
        '2:3': '2:3',
        '21:9': '21:9'
    };
    const mappedRatio = ratioMapping[aspectRatio] || '16:9';

    // Prepare subject_image_list (required - up to 4 images)
    const subjectImageList = subjectImages.slice(0, 4).map(img => ({
        subject_image: extractRawBase64(img)
    }));

    // Prepare request body
    const body = {
        model_name: modelName,
        prompt: prompt || '',
        aspect_ratio: mappedRatio,
        image_size: mappedResolution,
        n: 1,
        subject_image_list: subjectImageList
    };

    // Add optional scene image
    if (sceneImage) {
        body.scene_image = extractRawBase64(sceneImage);
    }

    // Add optional style image
    if (styleImage) {
        body.style_image = extractRawBase64(styleImage);
    }

    console.log(`Kling Multi-Image Gen: Using model ${modelName}, ${subjectImages.length} subjects, ratio: ${mappedRatio}`);

    // Create task
    const response = await fetch(`${KLING_BASE_URL}/v1/images/multi-image2image`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.code !== 0) {
        throw new Error(`Kling API error: ${result.message || 'Failed to create multi-image task'}`);
    }

    const taskId = result.data?.task_id;
    if (!taskId) {
        throw new Error('No task ID returned from Kling API');
    }

    console.log(`Kling multi-image task created: ${taskId}`);

    // Poll for completion
    return await pollKlingMultiImageTask(taskId, token);
}

/**
 * Generate image using Kling AI Image Generation API
 */
export async function generateKlingImage({ prompt, imageBase64, modelId, aspectRatio, resolution, klingReferenceMode, klingFaceIntensity, klingSubjectIntensity, accessKey, secretKey }) {
    const token = generateKlingJWT(accessKey, secretKey);
    const modelName = mapKlingImageModelName(modelId);

    // Map resolution: "1K" -> "1k", "2K" -> "2k"
    const resolutionMap = {
        'Auto': '1k',
        '1K': '1k',
        '2K': '2k'
    };
    const mappedResolution = resolutionMap[resolution] || '1k';

    // Map aspect ratio - Default to 16:9 for video-ready format
    const ratioMapping = {
        'Auto': '16:9',
        '1:1': '1:1',
        '16:9': '16:9',
        '9:16': '9:16',
        '4:3': '4:3',
        '3:4': '3:4',
        '3:2': '3:2',
        '2:3': '2:3',
        '21:9': '21:9',
        '5:4': '4:3',
        '4:5': '3:4'
    };
    const mappedRatio = ratioMapping[aspectRatio] || '16:9';

    // Prepare request body
    const body = {
        model_name: modelName,
        prompt: prompt,
        aspect_ratio: mappedRatio,
        image_size: mappedResolution,
        n: 1
    };

    // Add reference image if provided
    if (imageBase64) {
        const firstImage = Array.isArray(imageBase64) ? imageBase64[0] : imageBase64;
        body.image = extractRawBase64(firstImage);

        // kling-v1-5 requires image_reference when using a reference image
        // Options: 'subject' (character feature reference) or 'face' (appearance reference)
        if (modelName === 'kling-v1-5') {
            const refMode = klingReferenceMode || 'subject';
            body.image_reference = refMode;

            if (refMode === 'subject') {
                // Subject mode: Both face_reference_intensity and subject_reference_intensity are used
                const faceVal = typeof klingFaceIntensity === 'number' ? klingFaceIntensity : 65;
                const subjectVal = typeof klingSubjectIntensity === 'number' ? klingSubjectIntensity : 50;
                body.face_reference_intensity = faceVal / 100;
                body.subject_reference_intensity = subjectVal / 100;
                console.log(`[Kling V1.5] Mode: SUBJECT | Face Ref: ${faceVal}% (${body.face_reference_intensity}) | Subject Ref: ${subjectVal}% (${body.subject_reference_intensity})`);
            } else if (refMode === 'face') {
                // Face mode: Only face_reference_intensity is used
                const faceVal = typeof klingFaceIntensity === 'number' ? klingFaceIntensity : 42;
                body.face_reference_intensity = faceVal / 100;
                console.log(`[Kling V1.5] Mode: FACE | Reference Strength: ${faceVal}% (${body.face_reference_intensity})`);
            }
        }
    }

    console.log(`Kling Image Gen: Using model ${modelName}, aspect ratio: ${mappedRatio}, has reference: ${!!imageBase64}`);

    // Create task
    const response = await fetch(`${KLING_BASE_URL}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const result = await response.json();

    if (result.code !== 0) {
        throw new Error(`Kling API error: ${result.message || 'Failed to create image task'}`);
    }

    const taskId = result.data?.task_id;
    if (!taskId) {
        throw new Error('No task ID returned from Kling API');
    }

    console.log(`Kling image task created: ${taskId}`);

    // Poll for completion
    return await pollKlingImageTask(taskId, token);
}
