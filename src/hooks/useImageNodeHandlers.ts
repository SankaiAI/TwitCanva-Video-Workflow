/**
 * useImageNodeHandlers.ts
 * 
 * Handles Image node menu actions (Image to Image, Image to Video).
 * Creates connected nodes when users select these options from the placeholder.
 */

import React from 'react';
import { NodeData, NodeType, NodeStatus } from '../types';

// ============================================================================
// TYPES
// ============================================================================

interface UseImageNodeHandlersOptions {
    nodes: NodeData[];
    setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
    setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
    onGenerateNode?: (nodeId: string) => void; // Callback to trigger generation on a node
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build a prompt that includes angle transformation instructions
 */
function buildAnglePrompt(
    settings: { rotation: number; tilt: number; scale: number; wideAngle: boolean }
): string {
    const parts: string[] = [];

    // Clear instruction: we want to see the subject from a different camera angle
    parts.push('Create a new photograph of this exact same person/subject from a different camera viewing angle. Keep the same scene, lighting, clothing, and background. Only change the camera position.');

    if (settings.rotation !== 0) {
        if (settings.rotation > 0) {
            parts.push(`Move the camera ${Math.abs(settings.rotation)}° to the right side of the subject, as if walking around them clockwise.`);
        } else {
            parts.push(`Move the camera ${Math.abs(settings.rotation)}° to the left side of the subject, as if walking around them counter-clockwise.`);
        }
    }

    if (settings.tilt !== 0) {
        if (settings.tilt > 0) {
            parts.push(`Raise the camera viewpoint ${Math.abs(settings.tilt)}° higher, looking slightly down at the subject.`);
        } else {
            parts.push(`Lower the camera viewpoint ${Math.abs(settings.tilt)}° lower, looking slightly up at the subject.`);
        }
    }

    if (settings.scale > 50) {
        parts.push('Position the camera closer to the subject for a tighter frame.');
    } else if (settings.scale > 0) {
        parts.push('Move the camera slightly closer to the subject.');
    }

    if (settings.wideAngle) {
        parts.push('Use wide-angle lens perspective with slight barrel distortion at edges.');
    }

    parts.push('IMPORTANT: Do NOT rotate or flip the final image. The subject should remain upright and properly oriented.');

    return parts.join(' ');
}

// ============================================================================
// HOOK
// ============================================================================

export const useImageNodeHandlers = ({
    nodes,
    setNodes,
    setSelectedNodeIds,
    onGenerateNode
}: UseImageNodeHandlersOptions) => {
    /**
     * Handle "Image to Image" - creates a new Image node connected to this Image node
     * The current node becomes the input (parent) for the new Image node
     */
    const handleImageToImage = (nodeId: string) => {
        const imageNode = nodes.find(n => n.id === nodeId);
        if (!imageNode) return;

        // Create Image node to the right
        const newNodeId = crypto.randomUUID();
        const GAP = 100;
        const NODE_WIDTH = 340;

        const newImageNode: NodeData = {
            id: newNodeId,
            type: NodeType.IMAGE,
            x: imageNode.x + NODE_WIDTH + GAP,
            y: imageNode.y,
            prompt: '',
            status: NodeStatus.IDLE,
            model: 'Banana Pro',
            aspectRatio: 'Auto',
            resolution: 'Auto',
            parentIds: [nodeId] // Connect to the source image node
        };

        // Add new image node
        setNodes(prev => [...prev, newImageNode]);
        setSelectedNodeIds([newNodeId]);
    };

    /**
     * Handle "Image to Video" - creates a new Video node connected to this Image node
     * The current node becomes the input frame for the new Video node
     */
    const handleImageToVideo = (nodeId: string) => {
        const imageNode = nodes.find(n => n.id === nodeId);
        if (!imageNode) return;

        // Create Video node to the right
        const newNodeId = crypto.randomUUID();
        const GAP = 100;
        const NODE_WIDTH = 340;

        const newVideoNode: NodeData = {
            id: newNodeId,
            type: NodeType.VIDEO,
            x: imageNode.x + NODE_WIDTH + GAP,
            y: imageNode.y,
            prompt: '',
            status: NodeStatus.IDLE,
            model: 'Banana Pro',
            aspectRatio: 'Auto',
            resolution: 'Auto',
            parentIds: [nodeId] // Connect to the source image node
        };

        // Add new video node
        setNodes(prev => [...prev, newVideoNode]);
        setSelectedNodeIds([newNodeId]);
    };

    /**
     * Handle "Change Angle Generate" - creates a new Image node with angle prompt
     * and immediately triggers generation using the original as reference
     */
    const handleChangeAngleGenerate = (nodeId: string) => {
        const imageNode = nodes.find(n => n.id === nodeId);
        if (!imageNode || !imageNode.angleSettings) return;

        // Create Image node to the right
        const newNodeId = crypto.randomUUID();
        const GAP = 100;
        const NODE_WIDTH = 340;

        // Build the angle prompt
        const anglePrompt = buildAnglePrompt(imageNode.angleSettings);

        const newImageNode: NodeData = {
            id: newNodeId,
            type: NodeType.IMAGE,
            x: imageNode.x + NODE_WIDTH + GAP,
            y: imageNode.y,
            prompt: anglePrompt,
            status: NodeStatus.IDLE, // Start as IDLE - handleGenerate will set to LOADING
            model: 'Banana Pro',
            imageModel: 'gemini-pro', // Use Nano Banana Pro for angle generation
            aspectRatio: imageNode.aspectRatio || 'Auto',
            resolution: imageNode.resolution || 'Auto',
            parentIds: [nodeId] // Connect to source - original becomes reference
        };

        // Combine both updates in one setNodes call for atomic update
        setNodes(prev => [
            ...prev.map(n => n.id === nodeId ? { ...n, angleMode: false } : n),
            newImageNode
        ]);
        setSelectedNodeIds([newNodeId]);

        // Trigger generation after React's render cycle completes
        // Using requestAnimationFrame ensures we wait for the browser's next paint
        // which happens after React has committed the state update
        if (onGenerateNode) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    console.log('[ChangeAngle] Triggering generation for:', newNodeId);
                    onGenerateNode(newNodeId);
                });
            });
        }
    };

    return {
        handleImageToImage,
        handleImageToVideo,
        handleChangeAngleGenerate
    };
};

