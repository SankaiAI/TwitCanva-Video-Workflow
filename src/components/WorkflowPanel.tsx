/**
 * WorkflowPanel.tsx
 * 
 * Panel for browsing and managing saved workflows.
 * Shows list of workflows with options to load or delete.
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, FileText, Loader2, Maximize2 } from 'lucide-react';

interface WorkflowSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodeCount: number;
}

interface WorkflowPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadWorkflow: (workflowId: string) => void;
    currentWorkflowId?: string;
}

export const WorkflowPanel: React.FC<WorkflowPanelProps> = ({
    isOpen,
    onClose,
    onLoadWorkflow,
    currentWorkflowId
}) => {
    const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'public' | 'my'>('my');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    // Fetch workflows on open
    useEffect(() => {
        if (isOpen) {
            fetchWorkflows();
        }
    }, [isOpen]);

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/workflows');
            if (response.ok) {
                const data = await response.json();
                setWorkflows(data);
            }
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`http://localhost:3001/api/workflows/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setWorkflows(prev => prev.filter(w => w.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete workflow:', error);
        }
        setDeleteConfirm(null);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Main Panel */}
            <div className="fixed left-20 top-1/2 -translate-y-1/2 w-[700px] bg-[#0a0a0a]/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden max-h-[500px]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                    <div className="flex items-center gap-6">
                        <button
                            className={`text-sm font-medium transition-colors pb-1 ${activeTab === 'public' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-white'}`}
                            onClick={() => setActiveTab('public')}
                        >
                            Public Workflow
                        </button>
                        <button
                            className={`text-sm font-medium transition-colors pb-1 ${activeTab === 'my' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-white'}`}
                            onClick={() => setActiveTab('my')}
                        >
                            My Workflows
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-white transition-colors"
                    >
                        <Maximize2 size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <Loader2 className="animate-spin text-neutral-500" size={24} />
                        </div>
                    ) : workflows.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-neutral-500">
                            No workflows found
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4">
                            {workflows.map(workflow => (
                                <div
                                    key={workflow.id}
                                    onClick={() => onLoadWorkflow(workflow.id)}
                                    className={`rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-105 group ${workflow.id === currentWorkflowId
                                        ? 'ring-2 ring-blue-500'
                                        : ''
                                        }`}
                                >
                                    {/* Thumbnail */}
                                    <div className="aspect-[4/3] bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center relative">
                                        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center">
                                            <FileText size={28} className="text-neutral-500" />
                                        </div>
                                        {/* Delete button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirm(workflow.id);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} className="text-white" />
                                        </button>
                                    </div>
                                    {/* Info */}
                                    <div className="p-3 bg-neutral-900/50">
                                        <h3 className="font-medium text-white text-sm truncate">{workflow.title || 'Untitled'}</h3>
                                        <p className="text-xs text-neutral-500 mt-0.5">
                                            {workflow.nodeCount} nodes
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1a1a1a] border border-neutral-700 rounded-2xl p-6 w-[340px] shadow-2xl">
                        <h3 className="text-lg font-semibold text-white mb-2">Delete Workflow</h3>
                        <p className="text-neutral-400 text-sm mb-6">
                            Are you sure you want to delete this workflow? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
