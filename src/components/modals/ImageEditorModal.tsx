/**
 * ImageEditorModal.tsx
 * 
 * Full-screen image editor modal with model, aspect ratio, and resolution controls.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Banana, Image as ImageIcon, Crop, Monitor } from 'lucide-react';

// Image model configuration (same as NodeControls)
const IMAGE_MODELS = [
    { id: 'gemini-pro', name: 'Nano Banana Pro', provider: 'google', supportsImageToImage: true, supportsMultiImage: true, resolutions: ["1K", "2K", "4K"], aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"] },
    { id: 'kling-v1', name: 'Kling V1', provider: 'kling', supportsImageToImage: true, supportsMultiImage: false, resolutions: ["1K", "2K"], aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "21:9"] },
    { id: 'kling-v1-5', name: 'Kling V1.5', provider: 'kling', supportsImageToImage: true, supportsMultiImage: false, resolutions: ["1K", "2K"], aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "21:9"] },
    { id: 'kling-v2', name: 'Kling V2', provider: 'kling', supportsImageToImage: true, supportsMultiImage: true, resolutions: ["1K", "2K"], aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "21:9"] },
    { id: 'kling-v2-new', name: 'Kling V2 New', provider: 'kling', supportsImageToImage: true, supportsMultiImage: false, resolutions: ["1K", "2K"], aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "21:9"] },
    { id: 'kling-v2-1', name: 'Kling V2.1', provider: 'kling', supportsImageToImage: false, supportsMultiImage: true, recommended: true, resolutions: ["1K", "2K"], aspectRatios: ["Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "21:9"] },
];

interface ImageEditorModalProps {
    isOpen: boolean;
    nodeId: string;
    imageUrl?: string;
    initialPrompt?: string;
    initialModel?: string;
    initialAspectRatio?: string;
    initialResolution?: string;
    onClose: () => void;
    onGenerate: (id: string, prompt: string, count: number) => void;
    onUpdate: (id: string, updates: any) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
    isOpen,
    nodeId,
    imageUrl,
    initialPrompt,
    initialModel,
    initialAspectRatio,
    initialResolution,
    onClose,
    onGenerate,
    onUpdate
}) => {
    const [prompt, setPrompt] = useState(initialPrompt || '');
    const [batchCount, setBatchCount] = useState(4);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showAspectDropdown, setShowAspectDropdown] = useState(false);
    const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);

    // Model state
    const [selectedModel, setSelectedModel] = useState(initialModel || 'gemini-pro');
    const [selectedAspectRatio, setSelectedAspectRatio] = useState(initialAspectRatio || 'Auto');
    const [selectedResolution, setSelectedResolution] = useState(initialResolution || '1K');

    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const aspectDropdownRef = useRef<HTMLDivElement>(null);
    const resolutionDropdownRef = useRef<HTMLDivElement>(null);

    const currentModel = IMAGE_MODELS.find(m => m.id === selectedModel) || IMAGE_MODELS[0];

    // Reset state when modal opens with new data
    useEffect(() => {
        setPrompt(initialPrompt || '');
        setSelectedModel(initialModel || 'gemini-pro');
        setSelectedAspectRatio(initialAspectRatio || 'Auto');
        setSelectedResolution(initialResolution || '1K');
    }, [initialPrompt, initialModel, initialAspectRatio, initialResolution]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
            if (aspectDropdownRef.current && !aspectDropdownRef.current.contains(event.target as Node)) {
                setShowAspectDropdown(false);
            }
            if (resolutionDropdownRef.current && !resolutionDropdownRef.current.contains(event.target as Node)) {
                setShowResolutionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleGenerateClick = () => {
        // Save all settings to node before generating
        onUpdate(nodeId, {
            prompt,
            imageModel: selectedModel,
            aspectRatio: selectedAspectRatio,
            resolution: selectedResolution
        });
        onGenerate(nodeId, prompt, batchCount);
    };

    const handleModelChange = (modelId: string) => {
        setSelectedModel(modelId);
        const newModel = IMAGE_MODELS.find(m => m.id === modelId);

        // Reset aspect ratio if not supported
        if (newModel?.aspectRatios && !newModel.aspectRatios.includes(selectedAspectRatio)) {
            setSelectedAspectRatio('Auto');
        }

        // Update node
        onUpdate(nodeId, { imageModel: modelId });
        setShowModelDropdown(false);
    };

    const handleAspectChange = (ratio: string) => {
        setSelectedAspectRatio(ratio);
        onUpdate(nodeId, { aspectRatio: ratio });
        setShowAspectDropdown(false);
    };

    const handleResolutionChange = (res: string) => {
        setSelectedResolution(res);
        onUpdate(nodeId, { resolution: res });
        setShowResolutionDropdown(false);
    };

    if (!isOpen) return null;

    // Filter models that support image-to-image (since we have an input image)
    const hasInputImage = !!imageUrl;
    const availableModels = hasInputImage
        ? IMAGE_MODELS.filter(m => m.supportsImageToImage)
        : IMAGE_MODELS;

    return (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
            {/* Top Bar */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-blue-500"></div>
                    <span className="text-sm text-neutral-300">Image Editor</span>
                </div>

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
            </div>

            {/* Bottom Floating Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 w-full max-w-6xl px-4 pointer-events-none">

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

                {/* Prompt Bar - Single Row Layout */}
                <div className="w-full bg-[#2a2a2a] bg-opacity-95 backdrop-blur-sm rounded-xl border border-neutral-600 shadow-2xl pointer-events-auto flex items-center px-3 py-2.5 gap-3">
                    {/* Left - Image Icon */}
                    <button className="w-8 h-8 rounded-lg bg-neutral-700/50 hover:bg-neutral-600 flex items-center justify-center text-neutral-400 transition-colors border border-neutral-600 flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                        </svg>
                    </button>

                    {/* Prompt Input - Takes remaining space */}
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the changes you want to make..."
                        className="flex-1 min-w-0 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none"
                    />

                    {/* Right - Compact Controls Group */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Model Dropdown */}
                        <div className="relative" ref={modelDropdownRef}>
                            <button
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center gap-1 text-[11px] text-neutral-300 hover:bg-neutral-700 px-2 py-1.5 rounded-md transition-colors"
                            >
                                {currentModel.provider === 'google' ? (
                                    <Banana size={11} className="text-yellow-400" />
                                ) : (
                                    <ImageIcon size={11} className="text-cyan-400" />
                                )}
                                <span className="font-medium max-w-[80px] truncate">{currentModel.name}</span>
                                <ChevronDown size={10} className="opacity-50" />
                            </button>

                            {showModelDropdown && (
                                <div className="absolute bottom-full mb-2 right-0 w-48 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50">
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-[#1a1a1a] border-b border-neutral-700">
                                        {hasInputImage ? 'Image → Image' : 'Text → Image'}
                                    </div>
                                    {availableModels.filter(m => m.provider === 'google').length > 0 && (
                                        <>
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">Google</div>
                                            {availableModels.filter(m => m.provider === 'google').map(model => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => handleModelChange(model.id)}
                                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <Banana size={12} className="text-yellow-400" />
                                                        {model.name}
                                                    </span>
                                                    {currentModel.id === model.id && <Check size={12} />}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {availableModels.filter(m => m.provider === 'kling').length > 0 && (
                                        <>
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">Kling AI</div>
                                            {availableModels.filter(m => m.provider === 'kling').map(model => (
                                                <button
                                                    key={model.id}
                                                    onClick={() => handleModelChange(model.id)}
                                                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <ImageIcon size={12} className="text-cyan-400" />
                                                        {model.name}
                                                        {(model as any).recommended && (
                                                            <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                        )}
                                                    </span>
                                                    {currentModel.id === model.id && <Check size={12} />}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Aspect Ratio */}
                        <div className="relative" ref={aspectDropdownRef}>
                            <button
                                onClick={() => setShowAspectDropdown(!showAspectDropdown)}
                                className="flex items-center gap-1 text-[11px] font-medium bg-neutral-700/50 hover:bg-neutral-600 border border-neutral-600 text-white px-2 py-1.5 rounded-md transition-colors"
                            >
                                <Crop size={10} className="text-blue-400" />
                                <span>{selectedAspectRatio}</span>
                            </button>

                            {showAspectDropdown && (
                                <div className="absolute bottom-full mb-2 right-0 w-28 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                                    <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">Size</div>
                                    {(currentModel.aspectRatios || []).map(ratio => (
                                        <button
                                            key={ratio}
                                            onClick={() => handleAspectChange(ratio)}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedAspectRatio === ratio ? 'text-blue-400' : 'text-neutral-300'}`}
                                        >
                                            <span>{ratio}</span>
                                            {selectedAspectRatio === ratio && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Resolution */}
                        <div className="relative" ref={resolutionDropdownRef}>
                            <button
                                onClick={() => setShowResolutionDropdown(!showResolutionDropdown)}
                                className="flex items-center gap-1 text-[11px] font-medium bg-neutral-700/50 hover:bg-neutral-600 border border-neutral-600 text-white px-2 py-1.5 rounded-md transition-colors"
                            >
                                <Monitor size={10} className="text-green-400" />
                                <span>{selectedResolution}</span>
                            </button>

                            {showResolutionDropdown && (
                                <div className="absolute bottom-full mb-2 right-0 w-24 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50">
                                    <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">Resolution</div>
                                    {(currentModel.resolutions || ['1K']).map(res => (
                                        <button
                                            key={res}
                                            onClick={() => handleResolutionChange(res)}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${selectedResolution === res ? 'text-blue-400' : 'text-neutral-300'}`}
                                        >
                                            <span>{res}</span>
                                            {selectedResolution === res && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Batch Count */}
                        <div className="flex items-center bg-neutral-700/50 rounded-md px-2 py-1.5 gap-1 text-[11px] text-neutral-300 font-medium border border-neutral-600">
                            <button
                                className="hover:text-white disabled:opacity-50"
                                onClick={() => setBatchCount(Math.max(1, batchCount - 1))}
                                disabled={batchCount <= 1}
                            >‹</button>
                            <span className="w-3 text-center">{batchCount}</span>
                            <button
                                className="hover:text-white disabled:opacity-50"
                                onClick={() => setBatchCount(Math.min(4, batchCount + 1))}
                                disabled={batchCount >= 4}
                            >›</button>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerateClick}
                            className="px-4 py-1.5 bg-[#6c85ff] hover:bg-[#5a75ff] rounded-md text-[11px] font-bold text-white shadow-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M12 2v20M2 12h20" />
                            </svg>
                            Generate
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
