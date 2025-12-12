/**
 * ConnectionsLayer.tsx
 * 
 * Renders the SVG connections between nodes on the canvas.
 * Includes permanent connections and temporary drag connections.
 */

import React from 'react';
import { NodeData, Viewport } from '../../types';
import { calculateConnectionPath } from '../../utils/connectionHelpers';

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
}

export const ConnectionsLayer: React.FC<ConnectionsLayerProps> = ({
    nodes,
    viewport,
    isDraggingConnection,
    connectionStart,
    tempConnectionEnd,
    selectedConnection,
    onEdgeClick
}) => {
    // Render permanent connections between nodes
    const connections: React.ReactNode[] = [];

    nodes.forEach(node => {
        if (!node.parentIds || node.parentIds.length === 0) return;

        node.parentIds.forEach(parentId => {
            const parent = nodes.find(n => n.id === parentId);
            if (!parent) return;

            const startX = parent.x + 340;
            const startY = parent.y + 150;
            const endX = node.x;
            const endY = node.y + 150;

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
                        stroke={isSelected ? "#fff" : "#333"}
                        strokeWidth="2"
                        fill="none"
                        className={`transition-colors ${!isSelected ? 'group-hover:stroke-white' : ''}`}
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
            const startX = connectionStart.handle === 'right' ? startNode.x + 340 : startNode.x;
            const startY = startNode.y + 150;
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
                    stroke="#fff"
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
