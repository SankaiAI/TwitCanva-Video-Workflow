/**
 * useAssetHandlers.ts
 * 
 * Handles asset-related operations: selecting from history/library,
 * uploading files, and saving to library.
 * Self-contained with close functions passed as parameters.
 */

import React, { useState, useCallback } from 'react';
import { NodeData, NodeType, NodeStatus, Viewport, ContextMenuState } from '../types';

interface UseAssetHandlersOptions {
    nodes: NodeData[];
    viewport: Viewport;
    contextMenu: ContextMenuState;
    setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
}

export const useAssetHandlers = ({
    nodes,
    viewport,
    contextMenu,
    setNodes,
}: UseAssetHandlersOptions) => {
    // ============================================================================
    // CREATE ASSET MODAL STATE
    // ============================================================================

    const [isCreateAssetModalOpen, setIsCreateAssetModalOpen] = useState(false);
    const [nodeToSnapshot, setNodeToSnapshot] = useState<NodeData | null>(null);

    // ============================================================================
    // HANDLERS
    // ============================================================================

    /**
     * Convert pixel dimensions to closest standard aspect ratio
     * Returns the ratio string (e.g., "16:9", "1:1") for the dropdown
     */
    const getClosestAspectRatio = (width: number, height: number): string => {
        const ratio = width / height;

        // Standard ratios and their numeric values
        const standardRatios = [
            { label: '1:1', value: 1 },
            { label: '16:9', value: 16 / 9 },
            { label: '9:16', value: 9 / 16 },
            { label: '4:3', value: 4 / 3 },
            { label: '3:4', value: 3 / 4 },
            { label: '3:2', value: 3 / 2 },
            { label: '2:3', value: 2 / 3 },
            { label: '5:4', value: 5 / 4 },
            { label: '4:5', value: 4 / 5 },
            { label: '21:9', value: 21 / 9 }
        ];

        // Find closest match
        let closest = standardRatios[0];
        let minDiff = Math.abs(ratio - closest.value);

        for (const r of standardRatios) {
            const diff = Math.abs(ratio - r.value);
            if (diff < minDiff) {
                minDiff = diff;
                closest = r;
            }
        }

        return closest.label;
    };

    /**
     * Handle selecting an asset from history - creates new node with the image/video
     * closeHistoryPanel and closeAssetLibrary passed as params to avoid dependency
     */
    const handleSelectAsset = useCallback((
        type: 'images' | 'videos',
        url: string,
        prompt: string,
        closeHistoryPanel: () => void,
        closeAssetLibrary: () => void
    ) => {
        // Calculate position at center of canvas
        const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom - 170;
        const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom - 150;

        // Detect aspect ratio for images/videos
        const createNode = (resultAspectRatio?: string, aspectRatio?: string) => {
            const newNode: NodeData = {
                id: Date.now().toString(),
                type: type === 'images' ? NodeType.IMAGE : NodeType.VIDEO,
                x: centerX,
                y: centerY,
                prompt: prompt,
                status: NodeStatus.SUCCESS,
                resultUrl: url,
                resultAspectRatio,
                model: 'imagen-3.0-generate-002',
                aspectRatio: aspectRatio || '16:9',
                resolution: '1024x1024'
            };

            setNodes(prev => [...prev, newNode]);
            closeHistoryPanel();
            closeAssetLibrary();
        };

        if (type === 'images') {
            // Detect image dimensions
            const img = new Image();
            img.onload = () => {
                const resultAspectRatio = `${img.naturalWidth}/${img.naturalHeight}`;
                const aspectRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
                console.log(`[AssetHandler] Image loaded: ${img.naturalWidth}x${img.naturalHeight} -> ${aspectRatio}`);
                createNode(resultAspectRatio, aspectRatio);
            };
            img.onerror = (e) => {
                console.log('[AssetHandler] Image load error, using default 16:9', e);
                createNode(undefined, '16:9');
            };
            img.src = url;
        } else {
            // Detect video dimensions
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                const resultAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
                const aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight);
                console.log(`[AssetHandler] Video loaded: ${video.videoWidth}x${video.videoHeight} -> ${aspectRatio}`);
                createNode(resultAspectRatio, aspectRatio);
            };
            video.onerror = (e) => {
                console.log('[AssetHandler] Video load error, using default 16:9', e);
                createNode(undefined, '16:9');
            };
            video.src = url;
        }
    }, [viewport.x, viewport.y, viewport.zoom, setNodes]);

    /**
     * Handle library item selection
     */
    const handleLibrarySelect = useCallback((
        url: string,
        type: 'image' | 'video',
        closeHistoryPanel: () => void,
        closeAssetLibrary: () => void
    ) => {
        handleSelectAsset(
            type === 'image' ? 'images' : 'videos',
            url,
            'Asset Library Item',
            closeHistoryPanel,
            closeAssetLibrary
        );
    }, [handleSelectAsset]);

    /**
     * Open create asset modal for a node
     */
    const handleOpenCreateAsset = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && (node.type === NodeType.IMAGE || node.type === NodeType.VIDEO)) {
            setNodeToSnapshot(node);
            setIsCreateAssetModalOpen(true);
        } else {
            alert("Please select an Image or Video node to create an asset.");
        }
    }, [nodes]);

    /**
     * Save asset to library
     */
    const handleSaveAssetToLibrary = useCallback(async (name: string, category: string) => {
        if (!nodeToSnapshot?.resultUrl) return;

        try {
            const response = await fetch('http://localhost:3001/api/library', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceUrl: nodeToSnapshot.resultUrl,
                    name: name,
                    category: category
                })
            });

            if (!response.ok) throw new Error('Failed to save');
        } catch (error) {
            console.error("Failed to save asset:", error);
            throw error;
        }
    }, [nodeToSnapshot]);

    /**
     * Handle file upload from context menu
     */
    const handleContextUpload = useCallback((file: File) => {
        if (!file) return;

        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        if (!isVideo && !isImage) return;

        // Check file size (server limit 100MB)
        if (file.size > 100 * 1024 * 1024) {
            alert("File is too large. Maximum size is 100MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target?.result as string;

            try {
                const type = isVideo ? 'videos' : 'images';
                const response = await fetch(`/api/assets/${type}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data: base64Data,
                        prompt: file.name
                    })
                });

                if (!response.ok) {
                    throw new Error('Upload failed');
                }

                const responseData = await response.json();
                const resultUrl = responseData.url;

                // Convert screen/menu coordinates to canvas coordinates
                const canvasX = (contextMenu.x - viewport.x) / viewport.zoom;
                const canvasY = (contextMenu.y - viewport.y) / viewport.zoom;

                // Detect aspect ratio for images/videos and set both resultAspectRatio and aspectRatio
                const detectAndCreateNode = async () => {
                    let resultAspectRatio: string | undefined;
                    let aspectRatio: string = '16:9'; // Default

                    if (isImage) {
                        // Detect image dimensions
                        const img = new Image();
                        await new Promise<void>((resolve) => {
                            img.onload = () => {
                                resultAspectRatio = `${img.naturalWidth}/${img.naturalHeight}`;
                                aspectRatio = getClosestAspectRatio(img.naturalWidth, img.naturalHeight);
                                resolve();
                            };
                            img.onerror = () => resolve();
                            img.src = resultUrl;
                        });
                    } else if (isVideo) {
                        // Detect video dimensions
                        const video = document.createElement('video');
                        await new Promise<void>((resolve) => {
                            video.onloadedmetadata = () => {
                                resultAspectRatio = `${video.videoWidth}/${video.videoHeight}`;
                                aspectRatio = getClosestAspectRatio(video.videoWidth, video.videoHeight);
                                resolve();
                            };
                            video.onerror = () => resolve();
                            video.src = resultUrl;
                        });
                    }

                    const newNode: NodeData = {
                        id: crypto.randomUUID(),
                        type: isVideo ? NodeType.VIDEO : NodeType.IMAGE,
                        x: canvasX,
                        y: canvasY,
                        prompt: file.name,
                        status: NodeStatus.SUCCESS,
                        resultUrl: resultUrl,
                        resultAspectRatio,
                        model: 'Upload',
                        aspectRatio,
                        resolution: 'Auto',
                    };

                    setNodes(prev => [...prev, newNode]);
                };

                await detectAndCreateNode();

            } catch (error) {
                console.error("Upload failed:", error);
                alert("Failed to upload file to server.");
            }
        };
        reader.readAsDataURL(file);
    }, [contextMenu.x, contextMenu.y, viewport.x, viewport.y, viewport.zoom, setNodes]);

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        // Create asset modal
        isCreateAssetModalOpen,
        setIsCreateAssetModalOpen,
        nodeToSnapshot,

        // Handlers
        handleSelectAsset,
        handleLibrarySelect,
        handleOpenCreateAsset,
        handleSaveAssetToLibrary,
        handleContextUpload
    };
};
