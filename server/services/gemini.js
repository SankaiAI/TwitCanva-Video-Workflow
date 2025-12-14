/**
 * gemini.js
 * 
 * Google Gemini/Veo API service for image and video generation.
 */

import { GoogleGenAI } from '@anthropic-ai/genai';

// ============================================================================
// CLIENT SETUP
// ============================================================================

let _ai = null;

/**
 * Get or create Gemini AI client
 */
export function getGeminiClient(apiKey) {
    if (!_ai) {
        if (!apiKey) {
            throw new Error('Gemini API key not configured');
        }
        _ai = new GoogleGenAI({ apiKey });
    }
    return _ai;
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate image using Gemini
 * @returns {Promise<Buffer>} Image buffer
 */
export async function generateGeminiImage({ prompt, imageBase64Array, aspectRatio, apiKey }) {
    const ai = getGeminiClient(apiKey);
    const modelName = 'gemini-3-pro-image-preview';

    const parts = [];

    // Add input images
    if (imageBase64Array && imageBase64Array.length > 0) {
        for (const img of imageBase64Array) {
            const match = img.match(/^data:(image\/\w+);base64,/);
            const mimeType = match ? match[1] : "image/png";
            const base64Clean = img.replace(/^data:image\/\w+;base64,/, "");
            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Clean
                }
            });
        }
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
        model: modelName,
        contents: {
            parts: parts
        },
        config: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 1.0,
        }
    });

    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return Buffer.from(part.inlineData.data, 'base64');
            }
        }
    }

    throw new Error("No image data returned from Gemini");
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

/**
 * Generate video using Veo
 * @returns {Promise<Buffer>} Video buffer
 */
export async function generateVeoVideo({ prompt, imageBase64, lastFrameBase64, aspectRatio, resolution, apiKey }) {
    const ai = getGeminiClient(apiKey);
    const model = 'veo-3.1-fast-generate-preview';

    // Map resolution
    const resolutionMap = {
        '1080p': '1080p',
        '720p': '720p',
        '512p': '512p',
        'Auto': '720p'
    };
    const mappedResolution = resolutionMap[resolution] || '720p';

    // Map aspect ratio
    const ratioMap = {
        'Auto': '16:9',
        '16:9': '16:9',
        '9:16': '9:16'
    };
    const mappedRatio = ratioMap[aspectRatio] || '16:9';

    // Build API arguments
    const args = {
        model: model,
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: mappedResolution,
            aspectRatio: mappedRatio
        }
    };

    // Add image inputs
    if (imageBase64) {
        const match = imageBase64.match(/^data:(image\/\w+);base64,/);
        let mimeType = match ? match[1] : "image/png";
        let base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        // Convert PNG to JPEG for Veo compatibility
        if (mimeType === 'image/png') {
            const sharp = (await import('sharp')).default;
            const pngBuffer = Buffer.from(base64Clean, 'base64');
            const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer();
            base64Clean = jpegBuffer.toString('base64');
            mimeType = 'image/jpeg';
        }

        args.image = {
            imageBytes: base64Clean,
            mimeType: mimeType
        };
    }

    // Add last frame for interpolation
    if (lastFrameBase64) {
        const match = lastFrameBase64.match(/^data:(image\/\w+);base64,/);
        let mimeType = match ? match[1] : "image/png";
        let base64Clean = lastFrameBase64.replace(/^data:image\/\w+;base64,/, "");

        if (mimeType === 'image/png') {
            const sharp = (await import('sharp')).default;
            const pngBuffer = Buffer.from(base64Clean, 'base64');
            const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 90 }).toBuffer();
            base64Clean = jpegBuffer.toString('base64');
            mimeType = 'image/jpeg';
        }

        args.referenceImages = [{
            referenceId: 1,
            referenceType: 'REFERENCE_TYPE_LAST_FRAME',
            image: {
                imageBytes: base64Clean,
                mimeType: mimeType
            }
        }];
    }

    console.log('Calling Veo API with args:', {
        model: args.model,
        prompt: args.prompt.substring(0, 100) + '...',
        config: args.config,
        image: args.image ? { mimeType: args.image.mimeType, length: args.image.imageBytes?.length } : undefined
    });

    // Start generation
    let operation = await ai.models.generateVideos(args);

    // Poll for completion
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.get({ operation: operation });
    }

    // Get video data
    const videos = operation.response?.generatedVideos;
    if (!videos || videos.length === 0) {
        throw new Error('No video generated by Veo');
    }

    const video = videos[0].video;
    if (!video?.videoBytes) {
        throw new Error('No video bytes in response');
    }

    return Buffer.from(video.videoBytes, 'base64');
}
