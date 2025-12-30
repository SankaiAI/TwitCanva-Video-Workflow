/**
 * SelectionBoundingBox.tsx
 * 
 * Renders a bounding box around selected nodes with resize handles.
 * Shows "Group" button for multi-selection and group toolbar when grouped.
 */

import React, { useState } from 'react';
import { NodeData, NodeGroup, NodeType } from '../../types';

interface SelectionBoundingBoxProps {
    selectedNodes: NodeData[];
    group?: NodeGroup;
    viewport: { x: number; y: number; zoom: number };
    onGroup: () => void;
    onUngroup: () => void;
    onBoundingBoxPointerDown: (e: React.PointerEvent) => void;
    onRenameGroup?: (groupId: string, newLabel: string) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the width of a node based on its type
 */
const getNodeWidth = (node: NodeData): number => {
    if (node.type === NodeType.VIDEO) return 385;
    return 365;
};

/**
 * Estimate the height of a node based on its type and aspect ratio
 * This accounts for the content area + any controls/padding
 */
const getNodeHeight = (node: NodeData): number => {
    const baseWidth = getNodeWidth(node);

    // Parse aspect ratio to calculate content height
    let aspectRatio = 16 / 9; // Default

    // First priority: use resultAspectRatio if available (actual generated content dimensions)
    if (node.resultAspectRatio) {
        const parts = node.resultAspectRatio.split('/');
        if (parts.length === 2) {
            aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
        }
    } else if (node.aspectRatio && node.aspectRatio !== 'Auto') {
        // Use selected aspect ratio
        const parts = node.aspectRatio.split(':');
        if (parts.length === 2) {
            aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
        }
    }

    // Calculate content height from aspect ratio
    const contentHeight = baseWidth / aspectRatio;

    // Add padding for node chrome (title above, controls below, video player controls, etc.)
    // This needs to be generous to account for all edge cases
    const chromeHeight = 50; // Title and top spacing

    return contentHeight + chromeHeight;
};

export const SelectionBoundingBox: React.FC<SelectionBoundingBoxProps> = ({
    selectedNodes,
    group,
    viewport,
    onGroup,
    onUngroup,
    onBoundingBoxPointerDown,
    onRenameGroup
}) => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [editedLabel, setEditedLabel] = useState('');
    // ============================================================================
    // CALCULATIONS
    // ============================================================================

    // Don't render for 0 nodes or single nodes (unless it's a group)
    if (selectedNodes.length === 0) return null;
    if (selectedNodes.length === 1 && !group) return null;

    // Calculate bounding box from all selected nodes with proper dimensions
    const PADDING = 50; // Generous padding to ensure all nodes are fully contained

    const minX = Math.min(...selectedNodes.map(n => n.x)) - PADDING;
    const minY = Math.min(...selectedNodes.map(n => n.y)) - PADDING;
    const maxX = Math.max(...selectedNodes.map(n => n.x + getNodeWidth(n))) + PADDING;
    const maxY = Math.max(...selectedNodes.map(n => n.y + getNodeHeight(n))) + PADDING;

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
                borderRadius: '12px',
                backgroundColor: isGrouped ? 'rgba(55, 55, 55, 0.5)' : 'transparent',
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
                isEditingLabel ? (
                    <input
                        type="text"
                        value={editedLabel}
                        onChange={(e) => setEditedLabel(e.target.value)}
                        onBlur={() => {
                            if (editedLabel.trim() && onRenameGroup) {
                                onRenameGroup(group.id, editedLabel.trim());
                            }
                            setIsEditingLabel(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (editedLabel.trim() && onRenameGroup) {
                                    onRenameGroup(group.id, editedLabel.trim());
                                }
                                setIsEditingLabel(false);
                            } else if (e.key === 'Escape') {
                                setIsEditingLabel(false);
                            }
                        }}
                        autoFocus
                        className="absolute -top-8 left-0 text-sm font-medium text-white bg-indigo-600 px-3 py-1 rounded pointer-events-auto outline-none"
                    />
                ) : (
                    <div
                        className="absolute -top-8 left-0 text-sm font-medium text-white bg-indigo-600 px-3 py-1 rounded pointer-events-auto cursor-text"
                        onDoubleClick={() => {
                            setEditedLabel(group.label);
                            setIsEditingLabel(true);
                        }}
                    >
                        {group.label}
                    </div>
                )
            )}

            {/* Group Button (when multiple nodes selected but not grouped) */}
            {showGroupButton && (
                <div
                    className="absolute -top-10 right-0 flex gap-2 pointer-events-auto"
                >
                    <button
                        onClick={onGroup}
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                        title="Run Group (placeholder)"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Run Group
                    </button>
                    <button
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                        title="Create Workflow (placeholder)"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v6m0 4v10M2 12h6m4 0h10" />
                        </svg>
                        Create Workflow
                    </button>
                    <button
                        onClick={onUngroup}
                        className="bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white text-sm px-4 py-2.5 rounded flex items-center gap-2 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
