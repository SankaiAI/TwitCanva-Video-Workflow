/**
 * useLocalModelNodeHandlers.ts
 * 
 * Handles Local Model node creation and actions.
 * Similar pattern to useImageNodeHandlers but for local models.
 */

import { NodeData, NodeType, NodeStatus } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface UseLocalModelNodeHandlersOptions {
    nodes: NodeData[];
    setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
    setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
    onGenerateNode?: (nodeId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GAP = 100;
const NODE_WIDTH = 340;

// ============================================================================
// HOOK
// ============================================================================

export const useLocalModelNodeHandlers = ({
    nodes,
    setNodes,
    setSelectedNodeIds,
    onGenerateNode
}: UseLocalModelNodeHandlersOptions) => {

    /**
     * Creates a new Local Image Model node at the specified position
     * @param x - X coordinate for the node
     * @param y - Y coordinate for the node
     * @param modelId - Optional pre-selected model ID
     */
    const createLocalImageModelNode = (
        x: number,
        y: number,
        modelId?: string,
        parentNodeId?: string
    ) => {
        const newNodeId = crypto.randomUUID();

        const newNode: NodeData = {
            id: newNodeId,
            type: NodeType.LOCAL_IMAGE_MODEL,
            x,
            y,
            prompt: '',
            status: NodeStatus.IDLE,
            model: 'local',
            aspectRatio: '1:1',
            resolution: 'Auto',
            localModelId: modelId,
            localModelType: 'diffusion',
            parentIds: parentNodeId ? [parentNodeId] : undefined
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([newNodeId]);

        return newNodeId;
    };

    /**
     * Creates a new Local Video Model node at the specified position
     * @param x - X coordinate for the node
     * @param y - Y coordinate for the node
     * @param modelId - Optional pre-selected model ID
     */
    const createLocalVideoModelNode = (
        x: number,
        y: number,
        modelId?: string,
        parentNodeId?: string
    ) => {
        const newNodeId = crypto.randomUUID();

        const newNode: NodeData = {
            id: newNodeId,
            type: NodeType.LOCAL_VIDEO_MODEL,
            x,
            y,
            prompt: '',
            status: NodeStatus.IDLE,
            model: 'local',
            aspectRatio: '16:9',
            resolution: 'Auto',
            localModelId: modelId,
            localModelType: 'diffusion', // Video models also use diffusion architecture
            videoDuration: 5,
            parentIds: parentNodeId ? [parentNodeId] : undefined
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([newNodeId]);

        return newNodeId;
    };

    /**
     * Creates a local image model node connected to an existing node
     * @param sourceNodeId - ID of the node to connect from
     */
    const handleAddLocalImageModel = (sourceNodeId: string) => {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        const newX = sourceNode.x + NODE_WIDTH + GAP;
        const newY = sourceNode.y;

        return createLocalImageModelNode(newX, newY, undefined, sourceNodeId);
    };

    /**
     * Creates a local video model node connected to an existing node
     * @param sourceNodeId - ID of the node to connect from
     */
    const handleAddLocalVideoModel = (sourceNodeId: string) => {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        const newX = sourceNode.x + NODE_WIDTH + GAP;
        const newY = sourceNode.y;

        return createLocalVideoModelNode(newX, newY, undefined, sourceNodeId);
    };

    /**
     * Updates the selected local model for a node
     * @param nodeId - ID of the node to update
     * @param modelId - ID of the local model to select
     * @param modelPath - Path to the model file
     * @param modelType - Type of the model
     * @param architecture - Model architecture
     */
    const handleSelectLocalModel = (
        nodeId: string,
        modelId: string,
        modelPath: string,
        modelType: NodeData['localModelType'],
        architecture?: string
    ) => {
        setNodes(prev => prev.map(n =>
            n.id === nodeId
                ? {
                    ...n,
                    localModelId: modelId,
                    localModelPath: modelPath,
                    localModelType: modelType,
                    localModelArchitecture: architecture
                }
                : n
        ));
    };

    return {
        createLocalImageModelNode,
        createLocalVideoModelNode,
        handleAddLocalImageModel,
        handleAddLocalVideoModel,
        handleSelectLocalModel
    };
};
