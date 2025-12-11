/**
 * useSelectionBox.ts
 * 
 * Custom hook for managing selection box functionality.
 * Handles drag-to-select behavior for selecting multiple nodes.
 */

import React, { useState, useRef } from 'react';
import { SelectionBox, NodeData, Viewport } from '../types';

export const useSelectionBox = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [selectionBox, setSelectionBox] = useState<SelectionBox>({
        isActive: false,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0
    });

    const isSelecting = useRef<boolean>(false);

    // ============================================================================
    // HELPERS
    // ============================================================================

    /**
     * Check if a node intersects with the selection box
     * @param node - Node to check
     * @param box - Selection box coordinates
     * @param viewport - Current viewport state
     * @returns true if node intersects with selection box
     */
    const isNodeInSelectionBox = (
        node: NodeData,
        box: SelectionBox,
        viewport: Viewport
    ): boolean => {
        // Convert selection box screen coordinates to canvas coordinates
        const boxLeft = Math.min(box.startX, box.endX);
        const boxRight = Math.max(box.startX, box.endX);
        const boxTop = Math.min(box.startY, box.endY);
        const boxBottom = Math.max(box.startY, box.endY);

        // Convert to canvas space
        const canvasBoxLeft = (boxLeft - viewport.x) / viewport.zoom;
        const canvasBoxRight = (boxRight - viewport.x) / viewport.zoom;
        const canvasBoxTop = (boxTop - viewport.y) / viewport.zoom;
        const canvasBoxBottom = (boxBottom - viewport.y) / viewport.zoom;

        // Node dimensions (340x300 from CanvasNode component)
        const nodeLeft = node.x;
        const nodeRight = node.x + 340;
        const nodeTop = node.y;
        const nodeBottom = node.y + 300;

        // Rectangle intersection check
        return !(
            canvasBoxRight < nodeLeft ||
            canvasBoxLeft > nodeRight ||
            canvasBoxBottom < nodeTop ||
            canvasBoxTop > nodeBottom
        );
    };

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    /**
     * Start selection box drag
     * @param e - Pointer event
     */
    const startSelection = (e: React.PointerEvent) => {
        isSelecting.current = true;
        setSelectionBox({
            isActive: true,
            startX: e.clientX,
            startY: e.clientY,
            endX: e.clientX,
            endY: e.clientY
        });
    };

    /**
     * Update selection box end coordinates during drag
     * @param e - Pointer event
     * @returns true if selection box is being updated, false otherwise
     */
    const updateSelection = (e: React.PointerEvent): boolean => {
        if (!isSelecting.current) return false;

        setSelectionBox(prev => ({
            ...prev,
            endX: e.clientX,
            endY: e.clientY
        }));

        return true;
    };

    /**
     * Complete selection and return selected node IDs
     * @param nodes - All nodes on the canvas
     * @param viewport - Current viewport state
     * @returns Array of selected node IDs
     */
    const endSelection = (
        nodes: NodeData[],
        viewport: Viewport
    ): string[] => {
        if (!isSelecting.current) return [];

        const selectedIds = nodes
            .filter(node => isNodeInSelectionBox(node, selectionBox, viewport))
            .map(node => node.id);

        // Clear selection box
        isSelecting.current = false;
        setSelectionBox({
            isActive: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        });

        return selectedIds;
    };

    /**
     * Clear selection box state
     */
    const clearSelectionBox = () => {
        isSelecting.current = false;
        setSelectionBox({
            isActive: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        });
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        selectionBox,
        isSelecting: isSelecting.current,
        startSelection,
        updateSelection,
        endSelection,
        clearSelectionBox
    };
};
