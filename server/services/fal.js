/**
 * fal.js
 * 
 * Fal.ai API service for Kling 2.6 motion control.
 * Uses the official @fal-ai/client which handles file uploads automatically.
 */

import { fal } from '@fal-ai/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MOTION_CONTROL_MODEL = 'fal-ai/kling-video/v2.6/pro/motion-control';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert base64 data URI to a Blob/File for fal.ai upload
 */
function base64ToBlob(base64Data, fileType = 'image') {
    // Extract raw base64 and mime type
    let rawBase64 = base64Data;
    let mimeType = fileType === 'video' ? 'video/mp4' : 'image/png';

    if (base64Data.startsWith('data:')) {
        const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
            mimeType = match[1];
            rawBase64 = match[2];
        }
    }

    // Convert to buffer
    const buffer = Buffer.from(rawBase64, 'base64');

    // Create a Blob-like object that fal.ai client can handle
    return new Blob([buffer], { type: mimeType });
}

// ============================================================================
// MOTION CONTROL
// ============================================================================

/**
 * Generate video using Fal.ai Kling 2.6 Motion Control
 * 
 * @param {Object} params
 * @param {string} params.prompt - Text prompt
 * @param {string} params.characterImageBase64 - Base64 character reference image (or data URI)
 * @param {string} params.motionVideoBase64 - Base64 motion reference video (or data URI)
 * @param {string} params.characterOrientation - 'image' or 'video' (default: 'video')
 * @param {boolean} params.keepOriginalSound - Keep audio from reference video
 * @param {string} params.apiKey - Fal.ai API key
 * @returns {Promise<string>} URL of the generated video
 */
export async function generateFalMotionControl({
    prompt,
    characterImageBase64,
    motionVideoBase64,
    characterOrientation = 'video',
    keepOriginalSound = false,
    apiKey
}) {
    console.log('\n========================================');
    console.log('[Fal.ai Motion Control] Starting generation');
    console.log(`[Fal.ai Motion Control] Parameters:`);
    console.log(`  - Prompt: ${prompt ? prompt.substring(0, 50) + '...' : '(none)'}`);
    console.log(`  - Character Image: ${characterImageBase64 ? 'YES' : 'NO'}`);
    console.log(`  - Motion Video: ${motionVideoBase64 ? 'YES' : 'NO'}`);
    console.log(`  - Character Orientation: ${characterOrientation}`);
    console.log(`  - Keep Original Sound: ${keepOriginalSound}`);
    console.log('========================================\n');

    if (!apiKey) {
        throw new Error('[Fal.ai Motion Control] FAL_API_KEY is required');
    }
    if (!characterImageBase64) {
        throw new Error('[Fal.ai Motion Control] Character image is required');
    }
    if (!motionVideoBase64) {
        throw new Error('[Fal.ai Motion Control] Motion reference video is required');
    }

    // Configure fal client with API key
    fal.config({
        credentials: apiKey
    });

    // Upload files to fal.ai storage
    console.log('[Fal.ai Motion Control] Uploading files to fal.ai storage...');

    const imageBlob = base64ToBlob(characterImageBase64, 'image');
    const videoBlob = base64ToBlob(motionVideoBase64, 'video');

    const [imageUrl, videoUrl] = await Promise.all([
        fal.storage.upload(imageBlob).then(url => {
            console.log(`[Fal.ai] Image uploaded: ${url}`);
            return url;
        }),
        fal.storage.upload(videoBlob).then(url => {
            console.log(`[Fal.ai] Video uploaded: ${url}`);
            return url;
        })
    ]);

    // Prepare input
    const input = {
        image_url: imageUrl,
        video_url: videoUrl,
        character_orientation: characterOrientation,
        keep_original_sound: keepOriginalSound
    };

    if (prompt) {
        input.prompt = prompt;
    }

    console.log('[Fal.ai Motion Control] Submitting request...');
    console.log(`[Fal.ai Motion Control] Image URL: ${imageUrl}`);
    console.log(`[Fal.ai Motion Control] Video URL: ${videoUrl}`);

    // Track last status to avoid duplicate logs
    let lastStatus = '';

    // Submit and wait for result using fal.subscribe
    const result = await fal.subscribe(MOTION_CONTROL_MODEL, {
        input,
        logs: true,
        onQueueUpdate: (update) => {
            // Only log when status changes
            if (update.status !== lastStatus) {
                console.log(`[Fal.ai] Status: ${update.status}`);
                lastStatus = update.status;
            }
            // Log actual progress messages if available
            if (update.status === 'IN_PROGRESS' && update.logs && update.logs.length > 0) {
                update.logs.map((log) => log.message).forEach(msg => {
                    if (msg) console.log(`[Fal.ai Log] ${msg}`);
                });
            }
        }
    });

    // Extract video URL from result
    const resultVideoUrl = result.data?.video?.url;
    if (!resultVideoUrl) {
        console.log('[Fal.ai Motion Control] Full result:', JSON.stringify(result, null, 2));
        throw new Error('No video URL in Fal.ai result');
    }

    console.log('\n========================================');
    console.log('[Fal.ai Motion Control] SUCCESS!');
    console.log(`[Fal.ai Motion Control] Video URL: ${resultVideoUrl}`);
    console.log('========================================\n');

    return resultVideoUrl;
}
