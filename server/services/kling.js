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
        'kling-v2-5-turbo': 'kling-v2-5-turbo'
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
export async function generateKlingVideo({ prompt, imageBase64, lastFrameBase64, modelId, aspectRatio, accessKey, secretKey }) {
    const token = generateKlingJWT(accessKey, secretKey);
    const modelName = mapKlingVideoModelName(modelId);

    // Use 'pro' mode when doing frame-to-frame (with end frame), otherwise 'std'
    const useProMode = !!lastFrameBase64;

    // Prepare request body
    const body = {
        model_name: modelName,
        mode: useProMode ? 'pro' : 'std',
        duration: '5',
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

    console.log(`Kling Video Gen: Using model ${modelName}, mode: ${body.mode}, has image: ${!!imageBase64}, has tail: ${!!lastFrameBase64}`);

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

/**
 * Generate video using Kling AI Multi-Image-to-Video API (for frame-to-frame)
 */
export async function generateKlingMultiImageVideo({ prompt, imageList, aspectRatio, accessKey, secretKey }) {
    const token = generateKlingJWT(accessKey, secretKey);

    // Multi-image only supports kling-v1-6
    const body = {
        model_name: 'kling-v1-6',
        mode: 'std',
        duration: '5',
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
    accessKey,
    secretKey
}) {
    const token = generateKlingJWT(accessKey, secretKey);

    // Multi-image-to-image only supports kling-v2 and kling-v2-1
    const modelName = modelId === 'kling-v2-1' ? 'kling-v2-1' : 'kling-v2';

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
export async function generateKlingImage({ prompt, imageBase64, modelId, aspectRatio, accessKey, secretKey }) {
    const token = generateKlingJWT(accessKey, secretKey);
    const modelName = mapKlingImageModelName(modelId);

    // Map aspect ratio
    const ratioMapping = {
        'Auto': '1:1',
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
    const mappedRatio = ratioMapping[aspectRatio] || '1:1';

    // Prepare request body
    const body = {
        model_name: modelName,
        prompt: prompt,
        aspect_ratio: mappedRatio,
        n: 1
    };

    // Add reference image if provided
    if (imageBase64) {
        const firstImage = Array.isArray(imageBase64) ? imageBase64[0] : imageBase64;
        body.image = extractRawBase64(firstImage);
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
