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

    // File URL (e.g., /library/images/...)
    if (input.startsWith('/library/')) {
        try {
            // Get the library directory from environment or default
            const libraryDir = process.env.LIBRARY_DIR || path.join(process.cwd(), 'library');
            const relativePath = input.replace('/library/', '');
            const filePath = path.join(libraryDir, relativePath);

            if (fs.existsSync(filePath)) {
                const fileBuffer = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp'
                }[ext] || 'image/png';

                return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            }
        } catch (error) {
            console.error('Error resolving file to base64:', error);
        }
    }

    return input;
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
 * @returns {{ id: string, path: string, url: string }}
 */
export function saveBufferToFile(buffer, dir, prefix, extension) {
    const id = `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filename = `${id}.${extension}`;
    const filePath = path.join(dir, filename);

    fs.writeFileSync(filePath, buffer);

    // Determine URL path based on directory name
    const dirName = path.basename(dir);
    const url = `/library/${dirName}/${filename}`;

    return { id, path: filePath, url, filename };
}
