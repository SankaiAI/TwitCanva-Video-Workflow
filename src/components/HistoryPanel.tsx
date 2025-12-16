/**
 * HistoryPanel.tsx
 * 
 * Panel for browsing generated image and video history.
 * Assets are grouped by date and displayed in a grid.
 * Clicking an asset applies it to the selected node.
 */

import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, Maximize2, Image as ImageIcon, Video } from 'lucide-react';

interface AssetMetadata {
    id: string;
    filename: string;
    prompt: string;
    createdAt: string;
    type: string;
    url: string;
    model?: string;
}

interface HistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectAsset: (type: 'images' | 'videos', url: string, prompt: string, model?: string) => void;
    panelY?: number;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
    isOpen,
    onClose,
    onSelectAsset,
    panelY = 200
}) => {
    const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
    const [assets, setAssets] = useState<AssetMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [imageCounts, setImageCounts] = useState<number>(0);
    const [videoCounts, setVideoCounts] = useState<number>(0);

    // Fetch assets when panel opens or tab changes
    useEffect(() => {
        if (isOpen) {
            fetchAssets();
        }
    }, [isOpen, activeTab]);

    const fetchAssets = async () => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/assets/${activeTab}`);
            if (response.ok) {
                const data = await response.json();
                setAssets(data);
                // Update counts
                if (activeTab === 'images') {
                    setImageCounts(data.length);
                } else {
                    setVideoCounts(data.length);
                }
            }
        } catch (error) {
            console.error('Failed to fetch assets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`http://localhost:3001/api/assets/${activeTab}/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setAssets(prev => prev.filter(a => a.id !== id));
            }
        } catch (error) {
            console.error('Failed to delete asset:', error);
        }
        setDeleteConfirm(null);
    };

    const handleSelectAsset = (asset: AssetMetadata) => {
        // Construct full URL for the asset
        const fullUrl = `http://localhost:3001${asset.url}`;
        onSelectAsset(activeTab, fullUrl, asset.prompt || '', asset.model);
    };

    // Group assets by date
    const groupedAssets = assets.reduce((groups, asset) => {
        const date = new Date(asset.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD format
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(asset);
        return groups;
    }, {} as Record<string, AssetMetadata[]>);

    const sortedDates = Object.keys(groupedAssets).sort((a, b) =>
        new Date(b).getTime() - new Date(a).getTime()
    );

    if (!isOpen) return null;

    return (
        <>
            {/* Main Panel */}
            <div
                className="fixed left-20 w-[700px] bg-[#0a0a0a]/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden max-h-[500px]"
                style={{ top: panelY }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
                    <div className="flex items-center gap-6">
                        <button
                            className={`text-sm font-medium transition-colors pb-1 flex items-center gap-2 ${activeTab === 'images'
                                ? 'text-white border-b-2 border-white'
                                : 'text-neutral-500 hover:text-white'
                                }`}
                            onClick={() => setActiveTab('images')}
                        >
                            <ImageIcon size={16} />
                            Image History ({imageCounts})
                        </button>
                        <button
                            className={`text-sm font-medium transition-colors pb-1 flex items-center gap-2 ${activeTab === 'videos'
                                ? 'text-white border-b-2 border-white'
                                : 'text-neutral-500 hover:text-white'
                                }`}
                            onClick={() => setActiveTab('videos')}
                        >
                            <Video size={16} />
                            Video History ({videoCounts})
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
                    ) : assets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-neutral-500">
                            <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-3">
                                {activeTab === 'images' ? <ImageIcon size={24} /> : <Video size={24} />}
                            </div>
                            <p>No {activeTab} found</p>
                            <p className="text-xs mt-1">Generated {activeTab} will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {sortedDates.map(date => (
                                <div key={date}>
                                    <h3 className="text-sm text-neutral-400 mb-3">{date}</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {groupedAssets[date].map(asset => (
                                            <div
                                                key={asset.id}
                                                onClick={() => handleSelectAsset(asset)}
                                                className="aspect-square rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-105 group relative bg-neutral-900"
                                            >
                                                {activeTab === 'images' ? (
                                                    <img
                                                        src={`http://localhost:3001${asset.url}`}
                                                        alt={asset.prompt || 'Generated image'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <video
                                                        src={`http://localhost:3001${asset.url}`}
                                                        className="w-full h-full object-cover"
                                                        muted
                                                        onMouseEnter={(e) => e.currentTarget.play()}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.pause();
                                                            e.currentTarget.currentTime = 0;
                                                        }}
                                                    />
                                                )}
                                                {/* Delete button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDeleteConfirm(asset.id);
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={14} className="text-white" />
                                                </button>
                                            </div>
                                        ))}
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
                        <h3 className="text-lg font-semibold text-white mb-2">Delete Asset</h3>
                        <p className="text-neutral-400 text-sm mb-6">
                            Are you sure you want to delete this {activeTab === 'images' ? 'image' : 'video'}? This action cannot be undone.
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
