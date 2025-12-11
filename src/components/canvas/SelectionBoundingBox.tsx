/**
 * SelectionBoundingBox.tsx
 * 
 * Renders a bounding box around selected nodes with resize handles.
 * Shows "Group" button for multi-selection and group toolbar when grouped.
 */

import React from 'react';
import { NodeData, NodeGroup } from '../../types';

interface SelectionBoundingBoxProps {
    selectedNodes: NodeData[];
    group?: NodeGroup;
    viewport: { x: number; y: number; zoom: number };
    onGroup: () => void;
    onUngroup: () => void;
    onBoundingBoxPointerDown: (e: React.PointerEvent) => void;
}

export const SelectionBoundingBox: React.FC<SelectionBoundingBoxProps> = ({
    selectedNodes,
    group,
    viewport,
    onGroup,
    onUngroup,
    onBoundingBoxPointerDown
}) => {
    // ============================================================================
    // CALCULATIONS
    // ============================================================================

    if (selectedNodes.length === 0) return null;

    // Calculate bounding box from all selected nodes
    const NODE_WIDTH = 340;
    const NODE_HEIGHT = 300;
    const PADDING = 10;

    const minX = Math.min(...selectedNodes.map(n => n.x)) - PADDING;
    const minY = Math.min(...selectedNodes.map(n => n.y)) - PADDING;
    const maxX = Math.max(...selectedNodes.map(n => n.x + NODE_WIDTH)) + PADDING;
    const maxY = Math.max(...selectedNodes.map(n => n.y + NODE_HEIGHT)) + PADDING;

    const width = maxX - minX;
    const height = maxY - minY;

    const isGrouped = !!group;
    const showGroupButton = selectedNodes.length > 1 && !isGrouped;

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
        <div
            className="absolute pointer-events-auto cursor-move"
            style={{
                left: minX,
                top: minY,
                width,
                height,
                border: isGrouped ? '2px solid #6366f1' : '2px dashed #6366f1',
                borderRadius: '8px',
                zIndex: 5
            }}
            onPointerDown={(e) => {
                // Only trigger group drag if clicking on the bounding box itself, not its children
                if (e.target === e.currentTarget) {
                    onBoundingBoxPointerDown(e);
                }
            }}
        >
            {/* Resize Handles */}
            {[
                { pos: 'top-left', cursor: 'nw-resize', top: -4, left: -4 },
                { pos: 'top', cursor: 'n-resize', top: -4, left: '50%', transform: 'translateX(-50%)' },
                { pos: 'top-right', cursor: 'ne-resize', top: -4, right: -4 },
                { pos: 'right', cursor: 'e-resize', top: '50%', right: -4, transform: 'translateY(-50%)' },
                { pos: 'bottom-right', cursor: 'se-resize', bottom: -4, right: -4 },
                { pos: 'bottom', cursor: 's-resize', bottom: -4, left: '50%', transform: 'translateX(-50%)' },
                { pos: 'bottom-left', cursor: 'sw-resize', bottom: -4, left: -4 },
                { pos: 'left', cursor: 'w-resize', top: '50%', left: -4, transform: 'translateY(-50%)' }
            ].map(handle => (
                <div
                    key={handle.pos}
                    className="absolute w-2 h-2 bg-white border border-indigo-500 rounded-sm pointer-events-auto"
                    style={{
                        top: handle.top,
                        left: handle.left,
                        right: handle.right,
                        bottom: handle.bottom,
                        transform: handle.transform,
                        cursor: handle.cursor
                    }}
                />
            ))}

            {/* Group Label (when grouped) */}
            {isGrouped && group && (
                <div
                    className="absolute -top-8 left-0 text-sm font-medium text-white bg-indigo-600 px-3 py-1 rounded pointer-events-auto"
                >
                    {group.label}
                </div>
            )}

            {/* Group Button (when multiple nodes selected but not grouped) */}
            {showGroupButton && (
                <div
                    className="absolute -top-10 right-0 flex gap-2 pointer-events-auto"
                >
                    <button
                        onClick={onGroup}
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Group
                    </button>
                </div>
            )}

            {/* Group Toolbar (when grouped) */}
            {isGrouped && (
                <div
                    className="absolute -top-12 left-1/2 transform -translate-x-1/2 flex gap-2 pointer-events-auto"
                >
                    <button
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                        title="Run Group (placeholder)"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Run Group
                    </button>
                    <button
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                        title="Create Workflow (placeholder)"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v6m0 4v10M2 12h6m4 0h10" />
                        </svg>
                        Create Workflow
                    </button>
                    <button
                        onClick={onUngroup}
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-xs px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                            <line x1="3" y1="3" x2="21" y2="21" />
                        </svg>
                        Ungroup
                    </button>
                </div>
            )}
        </div>
    );
};
