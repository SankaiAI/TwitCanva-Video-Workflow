/**
 * videoHelpers.ts
 * 
 * Utility functions for video processing and manipulation.
 * Handles video frame extraction and conversion operations.
 */

/**
 * Extracts the last frame from a video URL as a base64 encoded image
 * 
 * @param videoUrl - URL of the video to extract from (can be data URI or HTTP URL)
 * @returns Promise resolving to base64 encoded PNG image
 * @throws Error if video fails to load or canvas context is unavailable
 * 
 * @example
 * const lastFrame = await extractVideoLastFrame(videoUrl);
 * // Returns: "data:image/png;base64,iVBORw0KGgo..."
 */
export const extractVideoLastFrame = (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = videoUrl;

        video.onloadeddata = () => {
            // Seek to last frame once duration is known
            if (video.duration) {
                video.currentTime = video.duration;
            }
        };

        video.onseeked = () => {
            // Create canvas and draw current frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } else {
                reject(new Error('Canvas context unavailable'));
            }
        };

        video.onerror = () => {
            reject(new Error('Video load failed'));
        };
    });
};
