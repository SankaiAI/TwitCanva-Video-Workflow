/**
 * useWorkflow.ts
 * 
 * Custom hook for managing workflow save/load functionality.
 * Handles persistence to the backend server.
 */

import React, { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { NodeData, NodeGroup, Viewport } from '../types';

interface WorkflowData {
    id: string | null;
    title: string;
    nodes: NodeData[];
    groups: NodeGroup[];
    viewport: Viewport;
}

interface UseWorkflowOptions {
    nodes: NodeData[];
    groups: NodeGroup[];
    viewport: Viewport;
    canvasTitle: string;
    setNodes: Dispatch<SetStateAction<NodeData[]>>;
    setSelectedNodeIds: Dispatch<SetStateAction<string[]>>;
    setCanvasTitle: (title: string) => void;
    setEditingTitleValue: (value: string) => void;
}

export const useWorkflow = ({
    nodes,
    groups,
    viewport,
    canvasTitle,
    setNodes,
    setSelectedNodeIds,
    setCanvasTitle,
    setEditingTitleValue
}: UseWorkflowOptions) => {
    // Workflow state
    const [workflowId, setWorkflowId] = useState<string | null>(null);
    const [isWorkflowPanelOpen, setIsWorkflowPanelOpen] = useState(false);
    const [workflowPanelY, setWorkflowPanelY] = useState(0);

    /**
     * Save current workflow to server
     */
    const handleSaveWorkflow = useCallback(async () => {
        try {
            const workflow: WorkflowData = {
                id: workflowId,
                title: canvasTitle,
                nodes,
                groups,
                viewport
            };

            const response = await fetch('http://localhost:3001/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(workflow)
            });

            if (response.ok) {
                const result = await response.json();
                setWorkflowId(result.id);
                console.log('Workflow saved:', result.id);
            }
        } catch (error) {
            console.error('Failed to save workflow:', error);
        }
    }, [workflowId, canvasTitle, nodes, groups, viewport]);

    /**
     * Load workflow from server
     */
    const handleLoadWorkflow = useCallback(async (id: string) => {
        try {
            const response = await fetch(`http://localhost:3001/api/workflows/${id}`);
            if (response.ok) {
                const workflow = await response.json();
                setWorkflowId(workflow.id);
                setCanvasTitle(workflow.title || 'Untitled');
                setEditingTitleValue(workflow.title || 'Untitled');
                setNodes(workflow.nodes || []);
                // Reset selection
                setSelectedNodeIds([]);
                setIsWorkflowPanelOpen(false);
                console.log('Workflow loaded:', workflow.id);
            }
        } catch (error) {
            console.error('Failed to load workflow:', error);
        }
    }, [setNodes, setSelectedNodeIds, setCanvasTitle, setEditingTitleValue]);

    /**
     * Handle workflow panel toggle from toolbar click
     */
    const handleWorkflowsClick = useCallback((e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setWorkflowPanelY(rect.top);
        setIsWorkflowPanelOpen(prev => !prev);
    }, []);

    /**
     * Close workflow panel
     */
    const closeWorkflowPanel = useCallback(() => {
        setIsWorkflowPanelOpen(false);
    }, []);

    return {
        workflowId,
        isWorkflowPanelOpen,
        workflowPanelY,
        handleSaveWorkflow,
        handleLoadWorkflow,
        handleWorkflowsClick,
        closeWorkflowPanel
    };
};
