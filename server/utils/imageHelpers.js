/**
 * imageHelpers.js
 * 
 * Utility functions for image/video processing and base64 conversion.
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// BASE64 HELPERS
// ============================================================================

/**
 * Resolve image to base64 - handles both base64 data URLs and file URLs
 * @param {string} input - Base64 data URL or file URL
 * @returns {string|null} Base64 data URL
 */
export function resolveImageToBase64(input) {
    if (!input) return null;

    // Already a data URL
    if (input.startsWith('data:')) {
        return input;
    }

    // Normalize input - extract path from full URL if needed
    let filePath = input;

    // Handle full URLs like http://localhost:3001/library/images/...
    if (input.startsWith('http://') || input.startsWith('https://')) {
        try {
            const url = new URL(input);
            filePath = url.pathname; // Extract just the path portion
        } catch (e) {
            console.warn('Failed to parse URL:', input);
            return null;
        }
    }

    // File URL (e.g., /library/images/...)
    if (filePath.startsWith('/library/')) {
        try {
            // Strip query string (e.g., ?t=1234567890) used for cache-busting
            const pathWithoutQuery = filePath.split('?')[0];

            // Get the library directory from environment or default
            const libraryDir = process.env.LIBRARY_DIR || path.join(process.cwd(), 'library');
            const relativePath = pathWithoutQuery.replace('/library/', '');
            const absolutePath = path.join(libraryDir, relativePath);

            if (fs.existsSync(absolutePath)) {
                const fileBuffer = fs.readFileSync(absolutePath);
                const ext = path.extname(absolutePath).toLowerCase();
                const mimeType = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.mp4': 'video/mp4',
                    '.webm': 'video/webm'
                }[ext] || 'image/png';

                return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            } else {
                console.warn('File not found for base64 conversion:', absolutePath);
            }
        } catch (error) {
            console.error('Error resolving file to base64:', error);
        }
    }

    // If we couldn't resolve it, return null to prevent passing invalid data to API
    console.warn('Could not resolve image to base64:', input.substring(0, 100));
    return null;
}

/**
 * Extract raw base64 from data URL (removes data:image/xxx;base64, prefix)
 * @param {string} dataUrl - Base64 data URL
 * @returns {string|null} Raw base64 string
 */
export function extractRawBase64(dataUrl) {
    if (!dataUrl) return null;
    if (dataUrl.startsWith('data:')) {
        return dataUrl.replace(/^data:[^;]+;base64,/, '');
    }
    return dataUrl;
}

// ============================================================================
// ASPECT RATIO MAPPING
// ============================================================================

/**
 * Map frontend aspect ratio to API-compatible format
 * @param {string} ratio - Frontend aspect ratio string
 * @returns {string} API-compatible aspect ratio
 */
export function mapAspectRatio(ratio) {
    const mapping = {
        'Auto': '1:1',
        '1:1': '1:1',
        '16:9': '16:9',
        '9:16': '9:16',
        '4:3': '4:3',
        '3:4': '3:4',
        '3:2': '3:2',
        '2:3': '2:3',
        '21:9': '21:9',
        '5:4': '5:4',
        '4:5': '4:5'
    };
    return mapping[ratio] || '1:1';
}

// ============================================================================
// FILE SAVING
// ============================================================================

/**
 * Save buffer to file and return URL
 * @param {Buffer} buffer - Data buffer
 * @param {string} dir - Directory to save to
 * @param {string} prefix - Filename prefix (e.g., 'img', 'vid')
 * @param {string} extension - File extension (e.g., 'png', 'mp4')
 * @param {string} [customId] - Optional custom ID to use instead of generating one
 * @returns {{ id: string, path: string, url: string }}
 */
export function saveBufferToFile(buffer, dir, prefix, extension, customId) {
    const id = customId || `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${id}.${extension}`;
    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, buffer);

    // Determine URL path based on directory name
    const dirName = path.basename(dir);
    const url = `/library/${dirName}/${filename}`;

    return { id, path: filePath, url, filename };
}

/**
 * Save base64 data URL to file and return library URL
 * Used to sanitize workflow nodes before saving
 * 
 * @param {string} dataUrl - Base64 data URL (data:image/png;base64,...)
 * @param {string} imagesDir - Directory for saving images
 * @param {string} videosDir - Directory for saving videos
 * @returns {string} File URL or original value if not a data URL
 */
export function saveBase64ToFile(dataUrl, imagesDir, videosDir) {
    if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;

    // Skip if already a file URL
    if (!dataUrl.startsWith('data:')) return dataUrl;

    // Match image data URLs
    const imageMatch = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
    if (imageMatch) {
        const ext = imageMatch[1] === 'jpeg' ? 'jpg' : imageMatch[1];
        const base64Data = imageMatch[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const saved = saveBufferToFile(buffer, imagesDir, 'wf_img', ext);
        console.log(`  Workflow sanitize: saved image ${saved.filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        return saved.url;
    }

    // Match video data URLs
    const videoMatch = dataUrl.match(/^data:video\/(mp4|webm);base64,(.+)$/);
    if (videoMatch) {
        const ext = videoMatch[1];
        const base64Data = videoMatch[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const saved = saveBufferToFile(buffer, videosDir, 'wf_vid', ext);
        console.log(`  Workflow sanitize: saved video ${saved.filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        return saved.url;
    }

    return dataUrl;
}
