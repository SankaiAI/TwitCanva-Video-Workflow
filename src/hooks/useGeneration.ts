/**
 * useGeneration.ts
 * 
 * Custom hook for handling AI content generation (images and videos).
 * Manages generation state, API calls, and error handling.
 */

import { NodeData, NodeType, NodeStatus } from '../types';
import { generateImage, generateVideo } from '../services/geminiService';
import { extractVideoLastFrame } from '../utils/videoHelpers';

interface UseGenerationProps {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
}

export const useGeneration = ({ nodes, updateNode }: UseGenerationProps) => {
    // ============================================================================
    // GENERATION HANDLER
    // ============================================================================

    /**
     * Handles content generation for a node
     * Supports image and video generation with parent node chaining
     * 
     * @param id - ID of the node to generate content for
     */
    const handleGenerate = async (id: string) => {
        const node = nodes.find(n => n.id === id);
        if (!node || !node.prompt) return;

        updateNode(id, { status: NodeStatus.LOADING });

        try {
            if (node.type === NodeType.IMAGE) {
                // Generate image
                const resultUrl = await generateImage({
                    prompt: node.prompt,
                    aspectRatio: node.aspectRatio,
                    resolution: node.resolution
                });
                updateNode(id, { status: NodeStatus.SUCCESS, resultUrl });

            } else if (node.type === NodeType.VIDEO) {
                // Get parent image for video generation
                let imageBase64: string | undefined;
                const parent = nodes.find(n => n.id === node.parentId);

                if (parent?.type === NodeType.VIDEO && parent.lastFrame) {
                    // Use last frame from parent video
                    imageBase64 = parent.lastFrame;
                } else if (parent?.resultUrl) {
                    // Use parent image directly
                    imageBase64 = parent.resultUrl;
                }

                // Generate video
                const resultUrl = await generateVideo({
                    prompt: node.prompt,
                    imageBase64,
                    aspectRatio: node.aspectRatio,
                    resolution: node.resolution
                });

                // Extract last frame for chaining
                const lastFrame = await extractVideoLastFrame(resultUrl);

                updateNode(id, {
                    status: NodeStatus.SUCCESS,
                    resultUrl,
                    lastFrame
                });
            }
        } catch (error: any) {
            // Handle errors
            const msg = error.toString().toLowerCase();
            let errorMessage = error.message || 'Generation failed';

            if (msg.includes('permission_denied') || msg.includes('403')) {
                errorMessage = 'Permission denied. Check API Key configuration.';
            }

            updateNode(id, { status: NodeStatus.ERROR, errorMessage });
            console.error('Generation failed:', error);
        }
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        handleGenerate
    };
};
