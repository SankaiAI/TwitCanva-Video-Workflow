/**
 * useTextNodeHandlers.ts
 * 
 * Handles Text node specific operations.
 */

import { NodeData, NodeType, NodeStatus } from '../types';

interface UseTextNodeHandlersOptions {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
    setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
    setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const useTextNodeHandlers = ({
    nodes,
    updateNode,
    setNodes,
    setSelectedNodeIds
}: UseTextNodeHandlersOptions) => {
    /**
     * Handle "Write your own content" - switches Text node to editing mode
     */
    const handleWriteContent = (nodeId: string) => {
        updateNode(nodeId, { textMode: 'editing' });
    };

    /**
     * Handle "Text to Video" - switches to editing mode and creates connected Video node
     */
    const handleTextToVideo = (nodeId: string) => {
        const textNode = nodes.find(n => n.id === nodeId);
        if (!textNode) return;

        // Create Video node to the right
        const videoNodeId = crypto.randomUUID();
        const GAP = 100;
        const NODE_WIDTH = 340;

        const videoNode: NodeData = {
            id: videoNodeId,
            type: NodeType.VIDEO,
            x: textNode.x + NODE_WIDTH + GAP,
            y: textNode.y,
            prompt: textNode.prompt || '',
            status: NodeStatus.IDLE,
            model: 'Banana Pro',
            aspectRatio: 'Auto',
            resolution: 'Auto',
            parentIds: [nodeId]
        };

        // Update text node to editing mode with linked video
        updateNode(nodeId, {
            textMode: 'editing',
            linkedVideoNodeId: videoNodeId
        });

        // Add video node
        setNodes(prev => [...prev, videoNode]);
        setSelectedNodeIds([nodeId]);
    };

    return {
        handleWriteContent,
        handleTextToVideo
    };
};
