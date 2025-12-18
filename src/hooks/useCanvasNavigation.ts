/**
 * useCanvasNavigation.ts
 * 
 * Custom hook for managing canvas viewport, zoom, and pan functionality.
 * Handles mouse wheel zoom, slider zoom, and viewport transformations.
 */

import React, { useState, useRef } from 'react';
import { Viewport, NodeData, NodeType } from '../types';

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
    const handleWheel = (e: React.WheelEvent, hoveredNode?: NodeData) => {
        if (e.ctrlKey || e.metaKey) {
            // Zoom with Ctrl/Cmd + Wheel
            const s = Math.exp(-e.deltaY * 0.001);
            let targetZoom = viewport.zoom * s;

            // Apply size limit if hovering over a node
            // Node dimensions: 600px wide (NodeControls), ~700px high (est. including prompt and controls)
            if (hoveredNode) {
                const nodeWidth = 600;
                const nodeHeight = 700;
                const maxZWidth = (window.innerWidth * 0.9) / nodeWidth;
                const maxZHeight = (window.innerHeight * 0.9) / nodeHeight;
                const maxNodeZoom = Math.min(maxZWidth, maxZHeight);

                // Cap the target zoom
                targetZoom = Math.min(targetZoom, maxNodeZoom);
            }

            const newZoom = Math.min(Math.max(0.1, targetZoom), 2.0);

            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                let anchorX = mouseX;
                let anchorY = mouseY;

                // Adjust anchor to node center if hovering over a node
                if (hoveredNode) {
                    const isVideo = hoveredNode.type === NodeType.VIDEO;
                    const nodeWidth = isVideo ? 385 : 365;
                    const nodeHeight = 400; // Estimated image area height

                    const nodeCenterX = hoveredNode.x + nodeWidth / 2;
                    const nodeCenterY = hoveredNode.y + nodeHeight / 2;

                    anchorX = nodeCenterX * viewport.zoom + viewport.x;
                    anchorY = nodeCenterY * viewport.zoom + viewport.y;
                }

                let newX = anchorX - (anchorX - viewport.x) * (newZoom / viewport.zoom);
                let newY = anchorY - (anchorY - viewport.y) * (newZoom / viewport.zoom);

                // Pull towards center if zooming into a node
                if (hoveredNode && newZoom > viewport.zoom) {
                    const windowCenterX = window.innerWidth / 2;
                    const windowCenterY = window.innerHeight / 2;
                    const strength = 0.1;
                    newX += (windowCenterX - anchorX) * strength;
                    newY += (windowCenterY - anchorY) * strength;
                }

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
