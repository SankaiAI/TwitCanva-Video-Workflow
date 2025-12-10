/**
 * NodeConnectors.tsx
 * 
 * Renders the left and right connector buttons for a node.
 * Handles pointer events for drag-to-connect functionality.
 */

import React from 'react';
import { Plus } from 'lucide-react';

interface NodeConnectorsProps {
    nodeId: string;
    onConnectorDown: (e: React.PointerEvent, id: string, side: 'left' | 'right') => void;
}

export const NodeConnectors: React.FC<NodeConnectorsProps> = ({
    nodeId,
    onConnectorDown
}) => {
    return (
        <>
            {/* Left Connector */}
            <button
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onConnectorDown(e, nodeId, 'left');
                }}
                className="absolute -left-12 w-10 h-10 rounded-full border border-neutral-700 bg-[#0f0f0f] text-neutral-400 hover:text-white hover:border-neutral-500 flex items-center justify-center transition-all opacity-0 group-hover/node:opacity-100 z-10 cursor-crosshair"
            >
                <Plus size={18} />
            </button>

            {/* Right Connector */}
            <button
                onPointerDown={(e) => {
                    e.stopPropagation();
                    onConnectorDown(e, nodeId, 'right');
                }}
                className="absolute -right-12 w-10 h-10 rounded-full border border-neutral-700 bg-[#0f0f0f] text-neutral-400 hover:text-white hover:border-neutral-500 flex items-center justify-center transition-all opacity-0 group-hover/node:opacity-100 z-10 cursor-crosshair"
            >
                <Plus size={18} />
            </button>
        </>
    );
};
