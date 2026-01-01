/**
 * ConnectionsLayer.tsx
 * 
 * Renders the SVG connections between nodes on the canvas.
 * Includes permanent connections and temporary drag connections.
 */

import React from 'react';
import { NodeData, NodeStatus, NodeType, Viewport } from '../../types';
import { calculateConnectionPath } from '../../utils/connectionHelpers';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the width of a node based on its type and content
 * @param node - The node to calculate width for
 * @param parentNode - Optional parent node (used for Editor nodes to determine width when they have input content)
 */
const getNodeWidth = (node: NodeData, parentNode?: NodeData): number => {
    // Image Editor with input from parent: width depends on aspect ratio
    if (node.type === NodeType.IMAGE_EDITOR) {
        const hasInput = parentNode && parentNode.status === NodeStatus.SUCCESS && parentNode.resultUrl;
        if (hasInput && parentNode.resultAspectRatio) {
            const parts = parentNode.resultAspectRatio.split('/');
            if (parts.length === 2) {
                const aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
                // For portrait images: height=500px, width=500*aspectRatio
                // For landscape images: width is capped at 500px
                if (aspectRatio < 1) {
                    return 500 * aspectRatio;
                } else {
                    return 500;
                }
            }
        }
        // Empty: width 340px
        return 340;
    }

    // Video Editor with input: uses 16:9 aspect ratio with maxWidth 500px
    if (node.type === NodeType.VIDEO_EDITOR) {
        const hasInput = parentNode && parentNode.status === NodeStatus.SUCCESS && parentNode.resultUrl;
        if (hasInput) {
            // Video uses 16:9, and width is capped at 500px
            // height = width / (16/9), maxHeight = 500px
            // So width = min(500, height * 16/9) where height is capped at 500
            // Result: width = min(500, 500 * 16/9) = min(500, 888) = 500
            return 500;
        }
        // Empty: width 340px
        return 340;
    }

    // Video nodes are wider
    if (node.type === NodeType.VIDEO) return 385;
    // Image and other nodes
    return 365;
};

/**
 * Estimate the height of a node based on its type and aspect ratio.
 * The node card height is determined by the content's aspect ratio or min-height for empty states.
 * Note: The title label is positioned ABOVE the card (-top-8), not inside it.
 * @param node - The node to calculate height for
 * @param parentNode - Optional parent node (used for Editor nodes to determine if they have input content)
 */
const getNodeHeight = (node: NodeData, parentNode?: NodeData): number => {
    const baseWidth = getNodeWidth(node, parentNode);
    const hasContent = node.status === NodeStatus.SUCCESS && node.resultUrl;

    // Handle Image Editor nodes
    if (node.type === NodeType.IMAGE_EDITOR) {
        // Check if has input from parent
        const hasInput = parentNode && parentNode.status === NodeStatus.SUCCESS && parentNode.resultUrl;
        if (hasInput && parentNode.resultAspectRatio) {
            // Use parent's aspect ratio to calculate actual dimensions
            // Image Editor with content: width=auto maxWidth=500px, image has maxHeight=500px
            const parts = parentNode.resultAspectRatio.split('/');
            if (parts.length === 2) {
                const aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
                // For portrait images (aspectRatio < 1): height is capped at 500px
                // For landscape images (aspectRatio >= 1): width is capped at 500px
                if (aspectRatio < 1) {
                    // Portrait: height = 500px, width = 500 * aspectRatio
                    return 500;
                } else {
                    // Landscape: width = 500px, height = 500 / aspectRatio
                    return 500 / aspectRatio;
                }
            }
        }
        // Empty: minHeight 380px
        return 380;
    }

    // Handle Video Editor nodes
    if (node.type === NodeType.VIDEO_EDITOR) {
        // Check if has input from parent
        const hasInput = parentNode && parentNode.status === NodeStatus.SUCCESS && parentNode.resultUrl;
        if (hasInput) {
            // Video editor shows 16:9 when has content (line 301 in CanvasNode.tsx)
            return Math.min(baseWidth / (16 / 9), 500);
        }
        // Empty: minHeight 380px
        return 380;
    }

    // Parse aspect ratio to calculate content height for Image/Video nodes
    let aspectRatio: number;

    if (hasContent && node.resultAspectRatio) {
        // Use actual result dimensions when content exists
        const parts = node.resultAspectRatio.split('/');
        if (parts.length === 2) {
            aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
        } else {
            aspectRatio = 16 / 9;
        }
    } else if (hasContent && node.aspectRatio && node.aspectRatio !== 'Auto') {
        // Use selected aspect ratio for content
        const parts = node.aspectRatio.split(':');
        if (parts.length === 2) {
            aspectRatio = parseFloat(parts[0]) / parseFloat(parts[1]);
        } else {
            aspectRatio = 16 / 9;
        }
    } else {
        // Empty/placeholder state: Both Image and Video use 4/3 (see NodeContent.tsx line 307)
        aspectRatio = 4 / 3;
    }

    // Calculate content height from aspect ratio
    return baseWidth / aspectRatio;
};

interface Connection {
    parentId: string;
    childId: string;
}

interface ConnectionsLayerProps {
    nodes: NodeData[];
    viewport: Viewport;
    // Connection dragging state
    isDraggingConnection: boolean;
    connectionStart: { nodeId: string; handle: 'left' | 'right' } | null;
    tempConnectionEnd: { x: number; y: number } | null;
    // Selection
    selectedConnection: Connection | null;
    onEdgeClick: (e: React.MouseEvent, parentId: string, childId: string) => void;
    canvasTheme?: 'dark' | 'light';
}

export const ConnectionsLayer: React.FC<ConnectionsLayerProps> = ({
    nodes,
    viewport,
    isDraggingConnection,
    connectionStart,
    tempConnectionEnd,
    selectedConnection,
    onEdgeClick,
    canvasTheme = 'dark'
}) => {
    // Render permanent connections between nodes
    const connections: React.ReactNode[] = [];

    nodes.forEach(node => {
        if (!node.parentIds || node.parentIds.length === 0) return;

        node.parentIds.forEach(parentId => {
            const parent = nodes.find(n => n.id === parentId);
            if (!parent) return;

            const startX = parent.x + getNodeWidth(parent);
            const startY = parent.y + getNodeHeight(parent) / 2;
            const endX = node.x;
            const endY = node.y + getNodeHeight(node, parent) / 2;

            const path = calculateConnectionPath(startX, startY, endX, endY, 'right');
            const isSelected = selectedConnection?.parentId === parentId && selectedConnection?.childId === node.id;

            connections.push(
                <g
                    key={`${parent.id}-${node.id}`}
                    onClick={(e) => onEdgeClick(e, parent.id, node.id)}
                    className="cursor-pointer group pointer-events-auto"
                >
                    <path d={path} stroke="transparent" strokeWidth="20" fill="none" />
                    <path
                        d={path}
                        stroke={isSelected
                            ? (canvasTheme === 'dark' ? '#fff' : '#2563eb')
                            : (canvasTheme === 'dark' ? '#444' : '#d1d5db')}
                        strokeWidth="2"
                        fill="none"
                        className={`transition-colors ${!isSelected ? (canvasTheme === 'dark' ? 'group-hover:stroke-neutral-300' : 'group-hover:stroke-neutral-500') : ''}`}
                    />
                </g>
            );
        });
    });

    // Render temporary drag connection
    let tempLine = null;
    if (isDraggingConnection && connectionStart && tempConnectionEnd) {
        const startNode = nodes.find(n => n.id === connectionStart.nodeId);
        if (startNode) {
            const startX = connectionStart.handle === 'right' ? startNode.x + getNodeWidth(startNode) : startNode.x;
            const startY = startNode.y + getNodeHeight(startNode) / 2;
            const endX = (tempConnectionEnd.x - viewport.x) / viewport.zoom;
            const endY = (tempConnectionEnd.y - viewport.y) / viewport.zoom;

            const path = calculateConnectionPath(
                startX,
                startY,
                endX,
                endY,
                connectionStart.handle
            );

            tempLine = (
                <path
                    d={path}
                    stroke={canvasTheme === 'dark' ? '#fff' : '#2563eb'}
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    className="pointer-events-none opacity-50"
                />
            );
        }
    }

    return (
        <>
            {connections}
            {tempLine}
        </>
    );
};
