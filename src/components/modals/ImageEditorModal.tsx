
import React, { useState } from 'react';

interface ImageEditorModalProps {
    isOpen: boolean;
    nodeId: string;
    imageUrl?: string;
    initialPrompt?: string;
    onClose: () => void;
    onGenerate: (id: string, prompt: string, count: number) => void;
    onUpdate: (id: string, updates: any) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
    isOpen,
    nodeId,
    imageUrl,
    initialPrompt,
    onClose,
    onGenerate,
    onUpdate
}) => {
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [batchCount, setBatchCount] = useState(4);

    React.useEffect(() => {
        setPrompt(initialPrompt || '');
    }, [initialPrompt]);

    const handleGenerateClick = () => {
        onUpdate(nodeId, { prompt }); // Save prompt to node
        onGenerate(nodeId, prompt, batchCount);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
            {/* Top Bar */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800">
                {/* Left - Logo/Title */}
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-blue-500"></div>
                    <span className="text-sm text-neutral-300">Image Editor</span>
                </div>

                {/* Right - Controls */}
                <div className="flex items-center gap-2">
                    <button className="w-8 h-8 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button className="w-8 h-8 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Toolbar - Removed to move to bottom floating bar */}
                <div className="w-0"></div>

                {/* Canvas Area */}
                <div className="flex-1 flex items-center justify-center bg-black p-8">
                    {imageUrl ? (
                        <img src={imageUrl} alt="Editing" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <div className="w-[600px] h-[400px] bg-neutral-100 rounded flex items-center justify-center">
                            <span className="text-neutral-400">No image loaded</span>
                        </div>
                    )}
                </div>

                {/* Right Sidebar (optional) */}
                <div className="w-64 bg-neutral-900 border-l border-neutral-800 p-4">
                    <div className="text-xs text-neutral-500 mb-2">Properties</div>
                    {/* Add properties panel here */}
                </div>
            </div>

            {/* Bottom Floating Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 w-full max-w-3xl px-4 pointer-events-none">

                {/* Floating Tools Palette */}
                <div className="bg-[#222] bg-opacity-95 backdrop-blur-sm rounded-lg border border-neutral-700 p-1 flex items-center gap-1 shadow-2xl pointer-events-auto">
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center bg-blue-600 text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                        </svg>
                    </button>
                    <div className="w-px h-5 bg-neutral-700 mx-1"></div>
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                    </button>
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </button>
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        </svg>
                    </button>
                    <div className="w-px h-5 bg-neutral-700 mx-1"></div>
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                    </button>
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                    </button>
                    <button className="w-8 h-8 rounded hover:bg-neutral-700 flex items-center justify-center text-neutral-400">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="12" cy="5" r="1" />
                            <circle cx="12" cy="19" r="1" />
                        </svg>
                    </button>
                </div>

                {/* Prompt Bar */}
                <div className="w-full bg-[#333] bg-opacity-95 backdrop-blur-sm rounded-xl border border-neutral-600 p-2 flex items-center gap-3 shadow-2xl pointer-events-auto">
                    {/* Image/Gallery Icon Button */}
                    <button className="w-9 h-9 rounded-lg bg-neutral-700/50 hover:bg-neutral-600 flex items-center justify-center text-neutral-400 transition-colors border border-neutral-600">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                    </button>

                    {/* Input Field */}
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter prompt for image generation"
                        className="flex-1 bg-transparent px-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none h-full"
                    />

                    {/* Batch Count */}
                    <div className="flex items-center bg-neutral-700/50 rounded-lg px-2 py-1.5 gap-2 text-xs text-neutral-300 font-medium border border-neutral-600">
                        <button
                            className="hover:text-white px-1 disabled:opacity-50"
                            onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                            disabled={batchCount <= 1}
                        >‹</button>
                        <span>{batchCount}</span>
                        <button
                            className="hover:text-white px-1 disabled:opacity-50"
                            onClick={() => setBatchCount(Math.min(4, batchCount + 1))}
                            disabled={batchCount >= 4}
                        >›</button>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerateClick}
                        className="px-6 py-2 bg-[#6c85ff] hover:bg-[#5a75ff] rounded-lg text-xs font-bold text-white shadow-lg transition-all flex items-center gap-2"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M12 2v20M2 12h20" />
                        </svg>
                        Generate
                    </button>
                </div>

            </div>
        </div>
    );
};
