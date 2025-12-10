/**
 * useNodeDragging.ts
 * 
 * Custom hook for managing node dragging functionality.
 * Handles pointer events for dragging nodes around the canvas.
 */

import React, { useRef } from 'react';
import { NodeData, Viewport } from '../types';

interface DragNode {
    id: string;
}

export const useNodeDragging = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const dragNodeRef = useRef<DragNode | null>(null);
    const isPanning = useRef<boolean>(false);

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    /**
     * Starts node dragging
     * @param e - Pointer event
     * @param id - Node ID to drag
     * @param onSelect - Callback to select the node
     */
    const handleNodePointerDown = (
        e: React.PointerEvent,
        id: string,
        onSelect?: (id: string) => void
    ) => {
        e.stopPropagation();
        dragNodeRef.current = { id };

        // Select the node
        if (onSelect) {
            onSelect(id);
        }

        if (e.target instanceof HTMLElement) {
            e.target.setPointerCapture(e.pointerId);
        }
    };

    /**
     * Updates node position during drag
     * Returns true if node was dragged, false otherwise
     */
    const updateNodeDrag = (
        e: React.PointerEvent,
        viewport: Viewport,
        onUpdateNodes: (updater: (prev: NodeData[]) => NodeData[]) => void
    ): boolean => {
        if (!dragNodeRef.current) return false;

        const nodeId = dragNodeRef.current.id;
        const zoomAdjustedDx = e.movementX / viewport.zoom;
        const zoomAdjustedDy = e.movementY / viewport.zoom;

        onUpdateNodes(prev => prev.map(n => {
            if (n.id === nodeId) {
                return { ...n, x: n.x + zoomAdjustedDx, y: n.y + zoomAdjustedDy };
            }
            return n;
        }));

        return true;
    };

    /**
     * Ends node dragging
     */
    const endNodeDrag = () => {
        dragNodeRef.current = null;
    };

    /**
     * Starts canvas panning
     */
    const startPanning = (e: React.PointerEvent) => {
        isPanning.current = true;
        if (e.target instanceof HTMLElement) {
            e.target.setPointerCapture(e.pointerId);
        }
    };

    /**
     * Updates canvas pan position
     * Returns true if panning, false otherwise
     */
    const updatePanning = (
        e: React.PointerEvent,
        onUpdateViewport: (updater: (prev: Viewport) => Viewport) => void
    ): boolean => {
        if (!isPanning.current) return false;

        onUpdateViewport(prev => ({
            ...prev,
            x: prev.x + e.movementX,
            y: prev.y + e.movementY
        }));

        return true;
    };

    /**
     * Ends canvas panning
     */
    const endPanning = () => {
        isPanning.current = false;
    };

    /**
     * Releases pointer capture
     */
    const releasePointerCapture = (e: React.PointerEvent) => {
        if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId)) {
            try {
                e.target.releasePointerCapture(e.pointerId);
            } catch (err) {
                // Ignore errors
            }
        }
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        dragNodeRef,
        isPanning,
        handleNodePointerDown,
        updateNodeDrag,
        endNodeDrag,
        startPanning,
        updatePanning,
        endPanning,
        releasePointerCapture
    };
};
