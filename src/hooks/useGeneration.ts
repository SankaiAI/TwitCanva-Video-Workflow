/**
 * useGeneration.ts
 * 
 * Custom hook for handling AI content generation (images and videos).
 * Manages generation state, API calls, and error handling.
 */

import { NodeData, NodeType, NodeStatus } from '../types';
import { generateImage, generateVideo } from '../services/generationService';
import { extractVideoLastFrame } from '../utils/videoHelpers';

interface UseGenerationProps {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
}

export const useGeneration = ({ nodes, updateNode }: UseGenerationProps) => {
    // ============================================================================
    // HELPERS
    // ============================================================================



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
        if (!node) return;

        // Get prompts from connected TEXT nodes (if any)
        const getTextNodePrompts = (): string[] => {
            if (!node.parentIds) return [];
            return node.parentIds
                .map(pid => nodes.find(n => n.id === pid))
                .filter(n => n?.type === NodeType.TEXT && n.prompt)
                .map(n => n!.prompt);
        };

        // Combine prompts: TEXT node prompts + node's own prompt
        const textNodePrompts = getTextNodePrompts();
        const combinedPrompt = [...textNodePrompts, node.prompt].filter(Boolean).join('\n\n');

        // Check if prompt is required
        // For Kling frame-to-frame with both start and end frames, prompt is optional
        const isKlingFrameToFrame =
            node.type === NodeType.VIDEO &&
            node.videoModel?.startsWith('kling-') &&
            (node.parentIds && node.parentIds.length >= 2);

        if (!combinedPrompt && !isKlingFrameToFrame) return;

        updateNode(id, { status: NodeStatus.LOADING });

        try {
            if (node.type === NodeType.IMAGE || node.type === NodeType.IMAGE_EDITOR) {
                // Collect ALL parent images for multi-input generation
                const imageBase64s: string[] = [];

                // Get images from all direct parents (excluding TEXT nodes)
                if (node.parentIds && node.parentIds.length > 0) {
                    for (const parentId of node.parentIds) {
                        let currentId: string | undefined = parentId;

                        // Traverse up the chain to find an image source (skip TEXT nodes)
                        while (currentId && imageBase64s.length < 14) { // Gemini 3 Pro limit
                            const parent = nodes.find(n => n.id === currentId);
                            // Skip TEXT nodes - they provide prompts, not images
                            if (parent?.type === NodeType.TEXT) {
                                break;
                            }
                            if (parent?.resultUrl) {
                                imageBase64s.push(parent.resultUrl);
                                break; // Found image for this parent chain
                            } else {
                                // Continue up this chain
                                currentId = parent?.parentIds?.[0];
                            }
                        }
                    }
                }

                // Generate image with all parent images
                const resultUrl = await generateImage({
                    prompt: combinedPrompt,
                    aspectRatio: node.aspectRatio,
                    resolution: node.resolution,
                    imageBase64: imageBase64s.length > 0 ? imageBase64s : undefined,
                    imageModel: node.imageModel
                });
                updateNode(id, { status: NodeStatus.SUCCESS, resultUrl, errorMessage: undefined });



            } else if (node.type === NodeType.VIDEO) {
                // Get first parent image for video generation (start frame)
                let imageBase64: string | undefined;
                let lastFrameBase64: string | undefined;

                // Get non-TEXT parent nodes (image sources only)
                const imageParentIds = node.parentIds?.filter(pid => {
                    const parent = nodes.find(n => n.id === pid);
                    return parent?.type !== NodeType.TEXT;
                }) || [];

                // Check for frame-to-frame mode (explicit or auto-detected from 2+ image parents)
                const hasMultipleInputs = imageParentIds.length >= 2;
                const hasExplicitFrameInputs = node.frameInputs && node.frameInputs.length >= 2;
                const isFrameToFrame = node.videoMode === 'frame-to-frame' || hasMultipleInputs || hasExplicitFrameInputs;

                if (isFrameToFrame && imageParentIds.length >= 2) {
                    // Get start and end frames from frameInputs (if user reordered) or default order
                    const parent1 = nodes.find(n => n.id === imageParentIds[0]);
                    const parent2 = nodes.find(n => n.id === imageParentIds[1]);

                    // Check if user has explicitly set frame order
                    if (node.frameInputs && node.frameInputs.length >= 2) {
                        const startFrameInput = node.frameInputs.find(f => f.order === 'start');
                        const endFrameInput = node.frameInputs.find(f => f.order === 'end');

                        if (startFrameInput) {
                            const startNode = nodes.find(n => n.id === startFrameInput.nodeId);
                            if (startNode?.resultUrl) {
                                imageBase64 = startNode.resultUrl;
                            }
                        }

                        if (endFrameInput) {
                            const endNode = nodes.find(n => n.id === endFrameInput.nodeId);
                            if (endNode?.resultUrl) {
                                lastFrameBase64 = endNode.resultUrl;
                            }
                        }
                    } else {
                        // Default: first parent = start, second parent = end
                        if (parent1?.resultUrl) imageBase64 = parent1.resultUrl;
                        if (parent2?.resultUrl) lastFrameBase64 = parent2.resultUrl;
                    }
                } else if (imageParentIds.length > 0) {
                    // Standard mode: get first parent image
                    const parent = nodes.find(n => n.id === node.parentIds![0]);

                    if (parent?.type === NodeType.VIDEO && parent.lastFrame) {
                        // Use last frame from parent video
                        imageBase64 = parent.lastFrame;
                    } else if (parent?.resultUrl) {
                        // Use parent image directly
                        imageBase64 = parent.resultUrl;
                    }
                }

                // Generate video
                const resultUrl = await generateVideo({
                    prompt: combinedPrompt,
                    imageBase64,
                    lastFrameBase64,
                    aspectRatio: node.aspectRatio,
                    resolution: node.resolution,
                    duration: node.videoDuration,
                    videoModel: node.videoModel
                });

                // Extract last frame for chaining
                const lastFrame = await extractVideoLastFrame(resultUrl);

                updateNode(id, {
                    status: NodeStatus.SUCCESS,
                    resultUrl,
                    lastFrame,
                    errorMessage: undefined // Clear any previous error
                });


            }
        } catch (error: any) {
            // Handle errors
            const msg = error.toString().toLowerCase();
            let errorMessage = error.message || 'Generation failed';

            if (msg.includes('permission_denied') || msg.includes('403')) {
                errorMessage = 'Permission denied. Check API Key configuration.';
            } else if (msg.includes('unable to process input image') || msg.includes('invalid_argument')) {
                errorMessage = '⚠️ Input image incompatible. Veo requires: JPEG format, 16:9 or 9:16 aspect ratio. Try a different image or generate without input.';
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
