/**
 * useAssetHandlers.ts
 * 
 * Handles asset-related operations: selecting from history/library,
 * uploading files, and saving to library.
 */

import { useState } from 'react';
import { NodeData, NodeType, NodeStatus, Viewport, ContextMenuState } from '../types';

interface UseAssetHandlersOptions {
    nodes: NodeData[];
    viewport: Viewport;
    contextMenu: ContextMenuState;
    setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
    closeHistoryPanel: () => void;
    closeAssetLibrary: () => void;
}

export const useAssetHandlers = ({
    nodes,
    viewport,
    contextMenu,
    setNodes,
    closeHistoryPanel,
    closeAssetLibrary
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
     * Handle selecting an asset from history - creates new node with the image/video
     */
    const handleSelectAsset = (type: 'images' | 'videos', url: string, prompt: string) => {
        // Calculate position at center of canvas
        const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom - 170;
        const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom - 150;

        // Create new node with the selected asset
        const newNode: NodeData = {
            id: Date.now().toString(),
            type: type === 'images' ? NodeType.IMAGE : NodeType.VIDEO,
            x: centerX,
            y: centerY,
            prompt: prompt,
            status: NodeStatus.SUCCESS,
            resultUrl: url,
            model: 'imagen-3.0-generate-002',
            aspectRatio: '1:1',
            resolution: '1024x1024'
        };

        setNodes(prev => [...prev, newNode]);
        closeHistoryPanel();
        closeAssetLibrary();
    };

    /**
     * Handle library item selection
     */
    const handleLibrarySelect = (url: string, type: 'image' | 'video') => {
        handleSelectAsset(type === 'image' ? 'images' : 'videos', url, 'Asset Library Item');
        closeAssetLibrary();
    };

    /**
     * Open create asset modal for a node
     */
    const handleOpenCreateAsset = (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node && (node.type === NodeType.IMAGE || node.type === NodeType.VIDEO)) {
            setNodeToSnapshot(node);
            setIsCreateAssetModalOpen(true);
        } else {
            alert("Please select an Image or Video node to create an asset.");
        }
    };

    /**
     * Save asset to library
     */
    const handleSaveAssetToLibrary = async (name: string, category: string) => {
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
    };

    /**
     * Handle file upload from context menu
     */
    const handleContextUpload = (file: File) => {
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

                const newNode: NodeData = {
                    id: crypto.randomUUID(),
                    type: isVideo ? NodeType.VIDEO : NodeType.IMAGE,
                    x: canvasX,
                    y: canvasY,
                    prompt: file.name,
                    status: NodeStatus.SUCCESS,
                    resultUrl: resultUrl,
                    model: 'Upload',
                    aspectRatio: 'Auto',
                    resolution: 'Auto',
                };

                setNodes(prev => [...prev, newNode]);

            } catch (error) {
                console.error("Upload failed:", error);
                alert("Failed to upload file to server.");
            }
        };
        reader.readAsDataURL(file);
    };

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
