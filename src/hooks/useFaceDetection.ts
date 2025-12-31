/**
 * useFaceDetection.ts
 * 
 * Hook for browser-based face detection using face-api.js
 * Detects faces in images and returns bounding boxes for overlay display.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';

interface FaceBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface UseFaceDetectionReturn {
    detectFaces: (imageUrl: string) => Promise<FaceBox[]>;
    isModelLoaded: boolean;
    isLoading: boolean;
}

// Track if models are loaded globally
let modelsLoaded = false;
let modelsLoading = false;

export const useFaceDetection = (): UseFaceDetectionReturn => {
    const [isModelLoaded, setIsModelLoaded] = useState(modelsLoaded);
    const [isLoading, setIsLoading] = useState(false);

    // Load models on mount
    useEffect(() => {
        const loadModels = async () => {
            if (modelsLoaded || modelsLoading) {
                if (modelsLoaded) setIsModelLoaded(true);
                return;
            }

            modelsLoading = true;
            console.log('[Face Detection] Loading face-api.js models...');

            try {
                // Use CDN for face-api.js models
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.2/model';

                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

                modelsLoaded = true;
                modelsLoading = false;
                setIsModelLoaded(true);
                console.log('[Face Detection] Models loaded successfully');
            } catch (error) {
                console.error('[Face Detection] Failed to load models:', error);
                modelsLoading = false;
            }
        };

        loadModels();
    }, []);

    const detectFaces = useCallback(async (imageUrl: string): Promise<FaceBox[]> => {
        if (!modelsLoaded) {
            console.warn('[Face Detection] Models not loaded yet');
            return [];
        }

        setIsLoading(true);

        try {
            // Create an image element
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';

            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = imageUrl;
            });

            // Detect faces using TinyFaceDetector (faster, good enough for UI)
            const detections = await faceapi.detectAllFaces(
                img,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
            );

            console.log(`[Face Detection] Detected ${detections.length} face(s)`);

            // Convert detections to percentage-based bounding boxes
            const faces: FaceBox[] = detections.map(detection => {
                const box = detection.box;
                return {
                    x: (box.x / img.naturalWidth) * 100,
                    y: (box.y / img.naturalHeight) * 100,
                    width: (box.width / img.naturalWidth) * 100,
                    height: (box.height / img.naturalHeight) * 100
                };
            });

            setIsLoading(false);
            return faces;
        } catch (error) {
            console.error('[Face Detection] Detection failed:', error);
            setIsLoading(false);
            return [];
        }
    }, []);

    return { detectFaces, isModelLoaded, isLoading };
};
