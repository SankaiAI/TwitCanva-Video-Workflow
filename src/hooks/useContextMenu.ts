/**
 * useContextMenu.ts
 * 
 * Custom hook for managing context menu state and interactions.
 */

import React, { useState, useCallback } from 'react';
import { ContextMenuState, NodeType, Viewport } from '../types';

interface UseContextMenuOptions {
    viewport: Viewport;
    handleSelectTypeFromMenu: (
        type: NodeType | 'DELETE',
        contextMenu: ContextMenuState,
        viewport: Viewport,
        closeMenu: () => void
    ) => void;
}

export const useContextMenu = ({ viewport, handleSelectTypeFromMenu }: UseContextMenuOptions) => {
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        x: 0,
        y: 0,
        type: 'global'
    });

    /**
     * Close the context menu
     */
    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    }, []);

    /**
     * Handle double-click on canvas to open context menu
     */
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).id === 'canvas-background') {
            setContextMenu({
                isOpen: true,
                x: e.clientX,
                y: e.clientY,
                type: 'global'
            });
        }
    }, []);

    /**
     * Handle right-click context menu on canvas
     */
    const handleGlobalContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if ((e.target as HTMLElement).id === 'canvas-background') {
            setContextMenu({
                isOpen: true,
                x: e.clientX,
                y: e.clientY,
                type: 'global'
            });
        }
    }, []);

    /**
     * Handle toolbar add button click
     */
    const handleToolbarAdd = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({
            isOpen: true,
            x: rect.right + 10,
            y: rect.top,
            type: 'global'
        });
    }, []);

    /**
     * Handle context menu type selection
     */
    const handleContextMenuSelect = useCallback((type: NodeType | 'DELETE') => {
        handleSelectTypeFromMenu(
            type,
            contextMenu,
            viewport,
            closeContextMenu
        );
    }, [handleSelectTypeFromMenu, contextMenu, viewport, closeContextMenu]);

    /**
     * Open connector context menu for a node
     */
    const openConnectorMenu = useCallback((nodeId: string, direction: 'left' | 'right') => {
        setContextMenu({
            isOpen: true,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            type: 'node-connector',
            sourceNodeId: nodeId,
            connectorSide: direction
        });
    }, []);

    /**
     * Open node options context menu
     */
    const openNodeOptionsMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            isOpen: true,
            x: e.clientX,
            y: e.clientY,
            type: 'node-options',
            sourceNodeId: nodeId
        });
    }, []);

    return {
        contextMenu,
        setContextMenu,
        closeContextMenu,
        handleDoubleClick,
        handleGlobalContextMenu,
        handleToolbarAdd,
        handleContextMenuSelect,
        openConnectorMenu,
        openNodeOptionsMenu
    };
};
