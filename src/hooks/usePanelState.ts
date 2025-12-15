/**
 * usePanelState.ts
 * 
 * Manages state and handlers for various UI panels.
 * Consolidates panel open/close logic from App.tsx.
 */

import { useState } from 'react';

interface UsePanelStateOptions {
    closeWorkflowPanel: () => void;
}

export const usePanelState = ({ closeWorkflowPanel }: UsePanelStateOptions) => {
    // ============================================================================
    // HISTORY PANEL
    // ============================================================================

    const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
    const [historyPanelY, setHistoryPanelY] = useState(0);

    const closeHistoryPanel = () => setIsHistoryPanelOpen(false);

    const handleHistoryClick = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setHistoryPanelY(rect.top);
        setIsHistoryPanelOpen(prev => !prev);
        closeWorkflowPanel();
        setIsAssetLibraryOpen(false);
        setIsChatOpen(false);
    };

    // ============================================================================
    // FULLSCREEN IMAGE PREVIEW
    // ============================================================================

    const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

    const handleExpandImage = (imageUrl: string) => setExpandedImageUrl(imageUrl);
    const handleCloseExpand = () => setExpandedImageUrl(null);

    // ============================================================================
    // CHAT PANEL
    // ============================================================================

    const [isChatOpen, setIsChatOpen] = useState(false);

    const toggleChat = () => setIsChatOpen(prev => !prev);
    const closeChat = () => setIsChatOpen(false);

    // ============================================================================
    // ASSET LIBRARY PANEL
    // ============================================================================

    const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false);
    const [assetLibraryY, setAssetLibraryY] = useState(0);
    const [assetLibraryVariant, setAssetLibraryVariant] = useState<'panel' | 'modal'>('panel');

    const closeAssetLibrary = () => setIsAssetLibraryOpen(false);

    const handleAssetsClick = (e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setAssetLibraryY(rect.top);
        setAssetLibraryVariant('panel');
        setIsAssetLibraryOpen(prev => !prev);
        closeHistoryPanel();
        closeWorkflowPanel();
        setIsChatOpen(false);
    };

    const openAssetLibraryModal = (y: number) => {
        setAssetLibraryY(y);
        setAssetLibraryVariant('modal');
        setIsAssetLibraryOpen(true);
        closeHistoryPanel();
        closeWorkflowPanel();
        setIsChatOpen(false);
    };

    // ============================================================================
    // NODE DRAG STATE (for chat highlight)
    // ============================================================================

    const [isDraggingNodeToChat, setIsDraggingNodeToChat] = useState(false);

    const handleNodeDragStart = (_nodeId: string, hasContent: boolean) => {
        if (hasContent) {
            setIsDraggingNodeToChat(true);
        }
    };

    const handleNodeDragEnd = () => {
        setIsDraggingNodeToChat(false);
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        // History panel
        isHistoryPanelOpen,
        historyPanelY,
        handleHistoryClick,
        closeHistoryPanel,

        // Fullscreen image
        expandedImageUrl,
        handleExpandImage,
        handleCloseExpand,

        // Chat
        isChatOpen,
        toggleChat,
        closeChat,

        // Asset library
        isAssetLibraryOpen,
        assetLibraryY,
        assetLibraryVariant,
        handleAssetsClick,
        closeAssetLibrary,
        openAssetLibraryModal,

        // Node drag
        isDraggingNodeToChat,
        handleNodeDragStart,
        handleNodeDragEnd
    };
};
