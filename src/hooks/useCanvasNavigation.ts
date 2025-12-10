/**
 * useCanvasNavigation.ts
 * 
 * Custom hook for managing canvas viewport, zoom, and pan functionality.
 * Handles mouse wheel zoom, slider zoom, and viewport transformations.
 */

import { useState, useRef } from 'react';
import { Viewport } from '../types';

export const useCanvasNavigation = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
    const canvasRef = useRef<HTMLDivElement>(null);

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    /**
     * Handles mouse wheel events for zooming and panning
     * Ctrl/Cmd + Wheel: Zoom in/out
     * Wheel: Pan canvas
     */
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            // Zoom with Ctrl/Cmd + Wheel
            const s = Math.exp(-e.deltaY * 0.001);
            const newZoom = Math.min(Math.max(0.1, viewport.zoom * s), 5);

            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
                const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

                setViewport({
                    x: newX,
                    y: newY,
                    zoom: newZoom
                });
            }
        } else {
            // Pan with regular wheel
            setViewport(prev => ({
                ...prev,
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    /**
     * Handles zoom slider changes
     * Zooms from center of viewport
     */
    const handleSliderZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newZoom = parseFloat(e.target.value);
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const newX = cx - (cx - viewport.x) * (newZoom / viewport.zoom);
        const newY = cy - (cy - viewport.y) * (newZoom / viewport.zoom);

        setViewport({
            x: newX,
            y: newY,
            zoom: newZoom
        });
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        viewport,
        setViewport,
        canvasRef,
        handleWheel,
        handleSliderZoom
    };
};
