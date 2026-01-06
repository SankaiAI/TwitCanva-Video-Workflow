/**
 * ExpandedMediaModal.tsx
 * 
 * Fullscreen media preview modal with mouse wheel zoom support.
 * Prevents browser window zoom while allowing image/video zoom.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface ExpandedMediaModalProps {
    mediaUrl: string | null;
    onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.15;

// ============================================================================
// COMPONENT
// ============================================================================

export const ExpandedMediaModal: React.FC<ExpandedMediaModalProps> = ({
    mediaUrl,
    onClose
}) => {
    // --- State ---
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);

    // --- Reset zoom and position when media changes ---
    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [mediaUrl]);

    // --- Wheel handler to zoom in/out ---
    const handleWheel = useCallback((e: React.WheelEvent) => {
        // Note: preventDefault is handled by the native event listener with { passive: false }
        // React synthetic wheel events are passive by default, so we can't call preventDefault here
        e.stopPropagation();

        // Calculate new zoom level
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    }, []);

    // --- Native wheel event handler to prevent browser zoom ---
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !mediaUrl) return;

        const handleNativeWheel = (e: WheelEvent) => {
            // Prevent browser zoom when using Ctrl+Wheel
            e.preventDefault();
        };

        // Use passive: false to allow preventDefault
        container.addEventListener('wheel', handleNativeWheel, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleNativeWheel);
        };
    }, [mediaUrl]);

    // --- Drag to pan when zoomed ---
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (zoom > 1) {
            e.preventDefault();
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }
    }, [zoom, position]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDragging, dragStart]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (isDragging) {
            setIsDragging(false);
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
    }, [isDragging]);

    // --- Close on backdrop click (only if not dragging and at default zoom) ---
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !isDragging) {
            onClose();
        }
    }, [onClose, isDragging]);

    // --- Reset zoom to 1x ---
    const handleResetZoom = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    // --- Keyboard shortcuts ---
    useEffect(() => {
        if (!mediaUrl) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === '0') {
                // Reset zoom with '0' key
                setZoom(1);
                setPosition({ x: 0, y: 0 });
            } else if (e.key === '+' || e.key === '=') {
                setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
            } else if (e.key === '-') {
                setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mediaUrl, onClose]);

    // Don't render if no media URL
    if (!mediaUrl) return null;

    const isVideo = mediaUrl.includes('video') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm');

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100]"
            onClick={handleBackdropClick}
            onWheel={handleWheel}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
        >
            {/* Close Button */}
            <button
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                onClick={onClose}
            >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 z-10">
                <button
                    className="p-1 text-white/80 hover:text-white transition-colors"
                    onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP)); }}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14" />
                    </svg>
                </button>
                <span className="text-white/90 text-sm font-medium min-w-[50px] text-center">
                    {Math.round(zoom * 100)}%
                </span>
                <button
                    className="p-1 text-white/80 hover:text-white transition-colors"
                    onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP)); }}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
                {zoom !== 1 && (
                    <button
                        className="ml-2 px-2 py-0.5 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded transition-colors"
                        onClick={handleResetZoom}
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Zoom Hint */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm pointer-events-none">
                Scroll to zoom • Drag to pan when zoomed
            </div>

            {/* Media Content */}
            <div
                className="max-w-[90vw] max-h-[90vh] select-none"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={(e) => e.stopPropagation()}
            >
                {isVideo ? (
                    <video
                        src={mediaUrl}
                        controls
                        autoPlay
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        draggable={false}
                    />
                ) : (
                    <img
                        src={mediaUrl}
                        alt="Fullscreen preview"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        draggable={false}
                    />
                )}
            </div>
        </div>
    );
};
