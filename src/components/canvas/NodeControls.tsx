/**
 * NodeControls.tsx
 * 
 * Control panel for canvas nodes.
 * Handles prompt input, model selection, size/ratio settings, and generation button.
 * For Video nodes: includes Advanced Settings for frame-to-frame mode.
 */

import React, { useState, useRef, useEffect, memo } from 'react';
import { Sparkles, Banana, Settings2, Check, ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, Film } from 'lucide-react';
import { NodeData, NodeStatus, NodeType } from '../../types';

interface NodeControlsProps {
    data: NodeData;
    inputUrl?: string;
    isLoading: boolean;
    isSuccess: boolean;
    connectedImageNodes?: { id: string; url: string }[]; // Connected image nodes for frame-to-frame
    onUpdate: (id: string, updates: Partial<NodeData>) => void;
    onGenerate: (id: string) => void;
    onSelect: (id: string) => void;
}

const IMAGE_RATIOS = [
    "Auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"
];

const VIDEO_RESOLUTIONS = [
    "Auto", "1080p", "512p"
];

// Video model versions with metadata
const VIDEO_MODELS = [
    { id: 'veo-3.1', name: 'Veo 3.1', provider: 'google', supportsMultiImage: true },
    { id: 'kling-v1', name: 'Kling V1', provider: 'kling', supportsMultiImage: false },
    { id: 'kling-v1-5', name: 'Kling V1.5', provider: 'kling', supportsMultiImage: false },
    { id: 'kling-v1-6', name: 'Kling V1.6', provider: 'kling', supportsMultiImage: true },
    { id: 'kling-v2-master', name: 'Kling V2 Master', provider: 'kling', supportsMultiImage: false },
    { id: 'kling-v2-1', name: 'Kling V2.1', provider: 'kling', supportsMultiImage: false, recommended: true },
    { id: 'kling-v2-1-master', name: 'Kling V2.1 Master', provider: 'kling', supportsMultiImage: false },
    { id: 'kling-v2-5-turbo', name: 'Kling V2.5 Turbo', provider: 'kling', supportsMultiImage: false },
];

// Image model versions with metadata
const IMAGE_MODELS = [
    { id: 'gemini-pro', name: 'Nano Banana Pro', provider: 'google' },
    { id: 'kling-v1', name: 'Kling V1', provider: 'kling' },
    { id: 'kling-v1-5', name: 'Kling V1.5', provider: 'kling' },
    { id: 'kling-v2', name: 'Kling V2', provider: 'kling' },
    { id: 'kling-v2-new', name: 'Kling V2 New', provider: 'kling' },
    { id: 'kling-v2-1', name: 'Kling V2.1', provider: 'kling', recommended: true },
];

const NodeControlsComponent: React.FC<NodeControlsProps> = ({
    data,
    inputUrl,
    isLoading,
    isSuccess,
    connectedImageNodes = [],
    onUpdate,
    onGenerate,
    onSelect
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showSizeDropdown, setShowSizeDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [localPrompt, setLocalPrompt] = useState(data.prompt || '');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentPromptRef = useRef<string | undefined>(data.prompt); // Track what we sent

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSizeDropdown(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync local prompt with data.prompt ONLY when it changes externally (not from our own update)
    useEffect(() => {
        if (data.prompt !== lastSentPromptRef.current) {
            setLocalPrompt(data.prompt || '');
            lastSentPromptRef.current = data.prompt;
        }
    }, [data.prompt]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, []);

    // Handle prompt change with debounce
    const handlePromptChange = (value: string) => {
        setLocalPrompt(value); // Update local state immediately for responsive typing
        lastSentPromptRef.current = value; // Track that we're about to send this

        // Debounce the parent update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
            onUpdate(data.id, { prompt: value });
        }, 300); // 300ms debounce - increased for smoother typing
    };

    const handleSizeSelect = (value: string) => {
        if (data.type === NodeType.VIDEO) {
            onUpdate(data.id, { resolution: value });
        } else {
            onUpdate(data.id, { aspectRatio: value });
        }
        setShowSizeDropdown(false);
    };

    const handleVideoModeChange = (mode: 'standard' | 'frame-to-frame') => {
        if (mode === 'frame-to-frame') {
            // Initialize frameInputs from connected nodes
            const initialFrameInputs = connectedImageNodes.slice(0, 2).map((node, idx) => ({
                nodeId: node.id,
                order: idx === 0 ? 'start' : 'end' as 'start' | 'end'
            }));
            onUpdate(data.id, { videoMode: mode, frameInputs: initialFrameInputs });
        } else {
            onUpdate(data.id, { videoMode: mode, frameInputs: undefined });
        }
    };

    const handleFrameReorder = (fromIndex: number, toIndex: number) => {
        if (!data.frameInputs || fromIndex === toIndex) return;

        const newFrameInputs = [...data.frameInputs];
        const [moved] = newFrameInputs.splice(fromIndex, 1);
        newFrameInputs.splice(toIndex, 0, moved);

        // Update orders based on new positions
        const updatedFrameInputs = newFrameInputs.map((input, idx) => ({
            ...input,
            order: idx === 0 ? 'start' : 'end' as 'start' | 'end'
        }));

        onUpdate(data.id, { frameInputs: updatedFrameInputs });
    };

    const currentSizeLabel = data.type === NodeType.VIDEO
        ? (data.resolution || "Auto")
        : (data.aspectRatio || "Auto");

    const sizeOptions = data.type === NodeType.VIDEO ? VIDEO_RESOLUTIONS : IMAGE_RATIOS;
    const isVideoNode = data.type === NodeType.VIDEO;
    const hasConnectedImages = connectedImageNodes.length > 0;

    // Video model selection logic
    const currentVideoModel = VIDEO_MODELS.find(m => m.id === data.videoModel) || VIDEO_MODELS[0];
    const isFrameToFrame = data.videoMode === 'frame-to-frame';

    // Filter models based on mode - only show multi-image capable models for frame-to-frame
    const availableVideoModels = isFrameToFrame
        ? VIDEO_MODELS.filter(m => m.supportsMultiImage)
        : VIDEO_MODELS;

    const handleVideoModelChange = (modelId: string) => {
        onUpdate(data.id, { videoModel: modelId });
        setShowModelDropdown(false);
    };

    // Image model selection logic
    const currentImageModel = IMAGE_MODELS.find(m => m.id === data.imageModel) || IMAGE_MODELS[0];

    const handleImageModelChange = (modelId: string) => {
        onUpdate(data.id, { imageModel: modelId });
        setShowModelDropdown(false);
    };

    // Get frame inputs with their image URLs
    const frameInputsWithUrls = (data.frameInputs || []).map(input => {
        const node = connectedImageNodes.find(n => n.id === input.nodeId);
        return { ...input, url: node?.url };
    }).filter(input => input.url);

    return (
        <div
            className="p-3 bg-[#1a1a1a] border-t border-neutral-800 rounded-b-2xl cursor-default"
            onPointerDown={(e) => e.stopPropagation()} // Allow selecting text/interacting without dragging
            onClick={() => onSelect(data.id)} // Ensure clicking here selects the node
        >
            <textarea
                className="w-full bg-transparent text-sm text-white placeholder-neutral-600 outline-none resize-none mb-3 font-light"
                placeholder={
                    data.type === NodeType.VIDEO && isFrameToFrame && currentVideoModel.provider === 'kling'
                        ? "Prompt optional for Kling frame-to-frame..."
                        : data.type === NodeType.VIDEO && inputUrl
                            ? "Describe how to animate this frame..."
                            : "Describe what you want to generate..."
                }
                rows={2}
                value={localPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                onBlur={() => {
                    // Ensure final value is saved on blur
                    if (updateTimeoutRef.current) {
                        clearTimeout(updateTimeoutRef.current);
                    }
                    if (localPrompt !== data.prompt) {
                        onUpdate(data.id, { prompt: localPrompt });
                    }
                }}
            />

            {data.errorMessage && (
                <div className="text-red-400 text-xs mb-2 p-1 bg-red-900/20 rounded border border-red-900/50">
                    {data.errorMessage}
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                    {/* Model Selector - Image nodes use static display, Video nodes get dropdown */}
                    {data.type === NodeType.VIDEO ? (
                        <div className="relative" ref={modelDropdownRef}>
                            <button
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center gap-1.5 text-xs text-neutral-300 hover:bg-neutral-800 px-2 py-1.5 rounded-lg transition-colors"
                            >
                                <Film size={12} className="text-cyan-400" />
                                <span className="font-medium">{currentVideoModel.name}</span>
                                <ChevronDown size={12} className="ml-0.5 opacity-50" />
                            </button>

                            {/* Model Dropdown Menu */}
                            {showModelDropdown && (
                                <div className="absolute top-full mt-1 left-0 w-48 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {/* Google Models */}
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                        Google
                                    </div>
                                    {availableVideoModels.filter(m => m.provider === 'google').map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => handleVideoModelChange(model.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Film size={12} className="text-cyan-400" />
                                                {model.name}
                                            </span>
                                            {currentVideoModel.id === model.id && <Check size={12} />}
                                        </button>
                                    ))}

                                    {/* Kling Models */}
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                        Kling AI
                                    </div>
                                    {availableVideoModels.filter(m => m.provider === 'kling').map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => handleVideoModelChange(model.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentVideoModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Film size={12} className="text-cyan-400" />
                                                {model.name}
                                                {(model as any).recommended && (
                                                    <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                )}
                                            </span>
                                            {currentVideoModel.id === model.id && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative" ref={modelDropdownRef}>
                            <button
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center gap-1.5 text-xs text-neutral-300 hover:bg-neutral-800 px-2 py-1.5 rounded-lg transition-colors"
                            >
                                {currentImageModel.provider === 'google' ? (
                                    <Banana size={12} className="text-yellow-400" />
                                ) : (
                                    <ImageIcon size={12} className="text-cyan-400" />
                                )}
                                <span className="font-medium">{currentImageModel.name}</span>
                                <ChevronDown size={12} className="ml-0.5 opacity-50" />
                            </button>

                            {/* Image Model Dropdown Menu */}
                            {showModelDropdown && (
                                <div className="absolute top-full mt-1 left-0 w-44 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {/* Google Models */}
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                        Google
                                    </div>
                                    {IMAGE_MODELS.filter(m => m.provider === 'google').map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => handleImageModelChange(model.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Banana size={12} className="text-yellow-400" />
                                                {model.name}
                                            </span>
                                            {currentImageModel.id === model.id && <Check size={12} />}
                                        </button>
                                    ))}

                                    {/* Kling Models */}
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">
                                        Kling AI
                                    </div>
                                    {IMAGE_MODELS.filter(m => m.provider === 'kling').map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => handleImageModelChange(model.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentImageModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'
                                                }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <ImageIcon size={12} className="text-cyan-400" />
                                                {model.name}
                                                {(model as any).recommended && (
                                                    <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                                )}
                                            </span>
                                            {currentImageModel.id === model.id && <Check size={12} />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Unified Size/Ratio Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
                            className="flex items-center gap-1.5 text-xs font-medium bg-[#252525] hover:bg-[#333] border border-neutral-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                        >
                            {data.type === NodeType.VIDEO && currentSizeLabel === 'Auto' ? 'Auto' : currentSizeLabel}
                            {currentSizeLabel === 'Auto' && data.type !== NodeType.VIDEO && (
                                <span className="text-[10px] text-neutral-400 ml-0.5 opacity-50">1:1</span>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {showSizeDropdown && (
                            <div className="absolute bottom-full mb-2 right-0 w-32 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-60 overflow-y-auto">
                                <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">
                                    {data.type === NodeType.VIDEO ? 'Resolution' : 'Aspect Ratio'}
                                </div>
                                {sizeOptions.map(option => (
                                    <button
                                        key={option}
                                        onClick={() => handleSizeSelect(option)}
                                        className={`flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentSizeLabel === option ? 'text-blue-400' : 'text-neutral-300'
                                            }`}
                                    >
                                        <span>{option}</span>
                                        {currentSizeLabel === option && <Check size={12} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Generate Button - Active even after success to allow re-generation */}
                    {!isLoading && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onGenerate(data.id); }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${isSuccess
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/20'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                                }`}
                        >
                            <Sparkles size={14} fill={isSuccess ? "currentColor" : "currentColor"} />
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Settings Drawer */}
            <div className="mt-2 pt-2 border-t border-neutral-800">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-center gap-1 cursor-pointer"
                >
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400">
                        Advanced Settings
                    </span>
                    {showAdvanced ? (
                        <ChevronUp size={12} className="text-neutral-600" />
                    ) : (
                        <ChevronDown size={12} className="text-neutral-600" />
                    )}
                </button>

                {/* Advanced Settings Content - Only for Video nodes */}
                {showAdvanced && isVideoNode && (
                    <div className="mt-3 space-y-3">
                        {/* Video Mode Toggle */}
                        <div className="space-y-2">
                            <label className="text-[10px] text-neutral-500 uppercase tracking-wider">Video Mode</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleVideoModeChange('standard')}
                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${data.videoMode !== 'frame-to-frame'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                        }`}
                                >
                                    <Film size={12} />
                                    Standard
                                </button>
                                <button
                                    onClick={() => handleVideoModeChange('frame-to-frame')}
                                    disabled={!hasConnectedImages}
                                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${data.videoMode === 'frame-to-frame'
                                        ? 'bg-cyan-600 text-white'
                                        : hasConnectedImages
                                            ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                                            : 'bg-neutral-800/50 text-neutral-600 cursor-not-allowed'
                                        }`}
                                    title={!hasConnectedImages ? 'Connect image nodes first' : ''}
                                >
                                    <ImageIcon size={12} />
                                    Frame-to-Frame
                                </button>
                            </div>
                        </div>

                        {/* Frame Inputs - Only show when frame-to-frame mode is active */}
                        {data.videoMode === 'frame-to-frame' && (
                            <div className="space-y-2">
                                <label className="text-[10px] text-neutral-500 uppercase tracking-wider">
                                    Connected Frames <span className="text-neutral-600">(drag to reorder)</span>
                                </label>

                                {frameInputsWithUrls.length === 0 ? (
                                    <div className="text-xs text-neutral-600 italic py-2">
                                        Connect image nodes to use as start/end frames
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {frameInputsWithUrls.map((input, index) => (
                                            <div
                                                key={input.nodeId}
                                                draggable
                                                onDragStart={() => setDraggedIndex(index)}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={() => {
                                                    if (draggedIndex !== null) {
                                                        handleFrameReorder(draggedIndex, index);
                                                        setDraggedIndex(null);
                                                    }
                                                }}
                                                onDragEnd={() => setDraggedIndex(null)}
                                                className={`flex items-center gap-2 p-2 bg-neutral-800 rounded-lg cursor-grab active:cursor-grabbing transition-all ${draggedIndex === index ? 'opacity-50 scale-95' : ''
                                                    }`}
                                            >
                                                <GripVertical size={14} className="text-neutral-600" />
                                                <img
                                                    src={input.url}
                                                    alt={`Frame ${index + 1}`}
                                                    className="w-12 h-12 object-cover rounded"
                                                />
                                                <div className="flex-1">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${input.order === 'start'
                                                        ? 'bg-green-600/30 text-green-400'
                                                        : 'bg-orange-600/30 text-orange-400'
                                                        }`}>
                                                        {input.order === 'start' ? 'START' : 'END'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {connectedImageNodes.length > frameInputsWithUrls.length && (
                                    <div className="text-xs text-neutral-500 mt-1">
                                        {connectedImageNodes.length - frameInputsWithUrls.length} more connected image(s) available
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Memoize to prevent re-renders when parent state changes
export const NodeControls = memo(NodeControlsComponent);
