/**
 * useImageEditor.ts
 * 
 * Custom hook for managing image editor modal state and handlers.
 */

import { useState, useCallback } from 'react';
import { NodeData, NodeStatus } from '../types';

interface EditorModalState {
    isOpen: boolean;
    nodeId: string | null;
    imageUrl?: string;
}

interface UseImageEditorOptions {
    nodes: NodeData[];
    updateNode: (id: string, updates: Partial<NodeData>) => void;
}

export const useImageEditor = ({ nodes, updateNode }: UseImageEditorOptions) => {
    const [editorModal, setEditorModal] = useState<EditorModalState>({
        isOpen: false,
        nodeId: null
    });

    /**
     * Open the image editor for a specific node
     */
    const handleOpenImageEditor = useCallback((nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Get image from parent node if connected (use first parent for editor)
        let imageUrl: string | undefined;

        if (node.parentIds && node.parentIds.length > 0) {
            const parentNode = nodes.find(n => n.id === node.parentIds![0]);
            if (parentNode?.resultUrl) {
                imageUrl = parentNode.resultUrl;
            }
        }

        // Also check if the node itself has a resultUrl (from upload/previous gen)
        if (!imageUrl && node.resultUrl) {
            imageUrl = node.resultUrl;
        }

        setEditorModal({
            isOpen: true,
            nodeId,
            imageUrl
        });
    }, [nodes]);

    /**
     * Close the image editor
     */
    const handleCloseImageEditor = useCallback(() => {
        setEditorModal({
            isOpen: false,
            nodeId: null
        });
    }, []);

    /**
     * Handler for image upload in Image nodes
     */
    const handleUpload = useCallback((nodeId: string, imageDataUrl: string) => {
        updateNode(nodeId, {
            resultUrl: imageDataUrl,
            status: NodeStatus.SUCCESS
        });
    }, [updateNode]);

    return {
        editorModal,
        handleOpenImageEditor,
        handleCloseImageEditor,
        handleUpload
    };
};
