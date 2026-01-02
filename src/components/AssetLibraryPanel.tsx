import React, { useState, useEffect } from 'react';
import { X, Search, Filter, Trash2 } from 'lucide-react';

interface LibraryAsset {
    id: string;
    name: string;
    category: string;
    url: string;
    type: 'image' | 'video';
}

interface AssetLibraryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectAsset: (url: string, type: 'image' | 'video') => void;
    panelY?: number;
    variant?: 'panel' | 'modal';
    canvasTheme?: 'dark' | 'light';
}

const CATEGORIES = [
    'All',
    'Character',
    'Scene',
    'Item',
    'Style',
    'Sound Effect',
    'Others'
];

export const AssetLibraryPanel: React.FC<AssetLibraryPanelProps> = ({
    isOpen,
    onClose,
    onSelectAsset,
    panelY = 100,
    variant = 'panel',
    canvasTheme = 'dark'
}) => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [assets, setAssets] = useState<LibraryAsset[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchLibrary();
        }
    }, [isOpen]);

    const fetchLibrary = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3001/api/library'); // Adjust port if needed, relative path preferred in helper
            if (res.ok) {
                setAssets(await res.json());
            }
        } catch (error) {
            console.error("Failed to load library:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAsset = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selection
        // Confirmation is now handled in the UI before this is called

        try {
            const res = await fetch(`http://localhost:3001/api/library/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setAssets(prev => prev.filter(a => a.id !== id));
            } else {
                console.error("Failed to delete asset");
            }
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    if (!isOpen) return null;

    // Theme helper
    const isDark = canvasTheme === 'dark';

    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div
                    className={`flex flex-col w-[800px] h-[600px] border rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300 ${isDark ? 'bg-[#0a0a0a] border-neutral-800' : 'bg-white border-neutral-200'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
                        <h2 className={`text-lg font-medium pl-2 ${isDark ? 'text-white' : 'text-neutral-900'}`}>Asset Library</h2>
                        <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'}`}>
                            <X size={20} />
                        </button>
                    </div>
                    {/* Reuse internal content logic */}
                    <AssetLibraryContent
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        assets={assets}
                        loading={loading}
                        onSelectAsset={onSelectAsset}
                        onDeleteAsset={handleDeleteAsset}
                        variant={variant}
                        canvasTheme={canvasTheme}
                    />
                </div>
                {/* Click outside to close */}
                <div className="absolute inset-0 -z-10" onClick={onClose} />
            </div>
        );
    }

    return (
        <div
            className={`fixed left-20 z-40 w-[700px] backdrop-blur-xl border rounded-2xl shadow-2xl flex flex-col max-h-[500px] overflow-hidden animate-in slide-in-from-left-4 duration-200 transition-colors ${isDark ? 'bg-[#0a0a0a]/95 border-neutral-800' : 'bg-white/95 border-neutral-200'}`}
            style={{ top: Math.min(window.innerHeight - 510, Math.max(20, panelY)) }}
        >
            <AssetLibraryContent
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                assets={assets}
                loading={loading}
                onSelectAsset={onSelectAsset}
                onDeleteAsset={handleDeleteAsset}
                variant={variant}
                canvasTheme={canvasTheme}
            />
        </div>
    );
};

// Extracted Internal Component for reuse
const AssetLibraryContent = ({
    selectedCategory, setSelectedCategory,
    assets, loading, onSelectAsset, onDeleteAsset, variant, canvasTheme = 'dark'
}: any) => {
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const isDark = canvasTheme === 'dark';

    const filteredAssets = assets.filter((asset: any) =>
        selectedCategory === 'All' || asset.category === selectedCategory
    );

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteConfirmId(id);
    };

    const handleConfirmDelete = (e: React.MouseEvent, id: string) => {
        onDeleteAsset(id, e);
        setDeleteConfirmId(null);
    };

    const handleCancelDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmId(null);
    };

    return (
        <>

            <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide shrink-0">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${selectedCategory === cat
                                ? isDark ? 'bg-neutral-100 text-black border-white' : 'bg-neutral-900 text-white border-neutral-900'
                                : isDark ? 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-600' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto pr-2 grid gap-3 pb-4 content-start grid-cols-4"
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: isDark ? '#525252 #171717' : '#d4d4d4 #fafafa'
                    }}
                >
                    {loading ? (
                        <div className="col-span-full text-center py-10 text-neutral-500">Loading...</div>
                    ) : filteredAssets.length === 0 ? (
                        <div className="col-span-full text-center py-10 text-neutral-500 text-sm">
                            No assets found in this category.
                        </div>
                    ) : (
                        filteredAssets.map((asset: any) => (
                            <div
                                key={asset.id}
                                className="group relative aspect-square bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 hover:border-neutral-600 cursor-pointer"
                                onClick={() => onSelectAsset(asset.url, asset.type)}
                            >
                                <img
                                    src={asset.url}
                                    alt={asset.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.onerror = null; // Prevent infinite loop
                                        target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48LcG9lyxpbmU+PC9zdmc+';
                                        target.classList.add('p-8', 'opacity-50');
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 pointer-events-none">
                                    <span className="text-white text-xs font-medium truncate">{asset.name}</span>
                                </div>

                                {/* Delete Button or Confirmation */}
                                {deleteConfirmId === asset.id ? (
                                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-20 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-white text-xs font-medium">Delete?</span>
                                        <div className="flex gap-2">
                                            <button
                                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                                                onClick={(e) => handleConfirmDelete(e, asset.id)}
                                            >
                                                Yes
                                            </button>
                                            <button
                                                className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs rounded transition-colors"
                                                onClick={handleCancelDelete}
                                            >
                                                No
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="absolute top-1 right-1 p-1.5 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-10"
                                        onClick={(e) => handleDeleteClick(e, asset.id)}
                                        title="Delete Asset"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};
