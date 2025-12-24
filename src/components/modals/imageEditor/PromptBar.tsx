/**
 * PromptBar.tsx
 * 
 * Prompt input bar with model, aspect ratio, and resolution dropdowns.
 * Contains batch count controls and generate button.
 */

import React, { useRef, useEffect } from 'react';
import { ChevronDown, Check, Banana, Image as ImageIcon, Crop, Monitor } from 'lucide-react';
import { ImageModel, IMAGE_MODELS } from './imageEditor.types';
import { OpenAIIcon, KlingIcon } from '../../icons/BrandIcons';

// ============================================================================
// TYPES
// ============================================================================

interface PromptBarProps {
    // Prompt state
    prompt: string;
    setPrompt: (prompt: string) => void;
    // Model state
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    showModelDropdown: boolean;
    setShowModelDropdown: (show: boolean) => void;
    // Aspect ratio state
    selectedAspectRatio: string;
    onAspectChange: (ratio: string) => void;
    showAspectDropdown: boolean;
    setShowAspectDropdown: (show: boolean) => void;
    // Resolution state
    selectedResolution: string;
    onResolutionChange: (res: string) => void;
    showResolutionDropdown: boolean;
    setShowResolutionDropdown: (show: boolean) => void;
    // Batch count
    batchCount: number;
    setBatchCount: (count: number) => void;
    // Actions
    onGenerate: () => void;
    // Flags
    hasInputImage: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PromptBar: React.FC<PromptBarProps> = ({
    prompt,
    setPrompt,
    selectedModel,
    onModelChange,
    showModelDropdown,
    setShowModelDropdown,
    selectedAspectRatio,
    onAspectChange,
    showAspectDropdown,
    setShowAspectDropdown,
    selectedResolution,
    onResolutionChange,
    showResolutionDropdown,
    setShowResolutionDropdown,
    batchCount,
    setBatchCount,
    onGenerate,
    hasInputImage
}) => {
    // --- Refs ---
    const modelDropdownRef = useRef<HTMLDivElement>(null);
    const aspectDropdownRef = useRef<HTMLDivElement>(null);
    const resolutionDropdownRef = useRef<HTMLDivElement>(null);

    // --- Derived State ---
    const currentModel = IMAGE_MODELS.find(m => m.id === selectedModel) || IMAGE_MODELS[0];
    const availableModels = hasInputImage
        ? IMAGE_MODELS.filter(m => m.supportsImageToImage)
        : IMAGE_MODELS;

    // --- Effects ---

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
    }, [setShowModelDropdown, setShowAspectDropdown, setShowResolutionDropdown]);

    return (
        <div className="w-full bg-[#2a2a2a] bg-opacity-95 backdrop-blur-sm rounded-xl border border-neutral-600 shadow-2xl pointer-events-auto flex items-center px-3 py-2.5 gap-3">
            {/* Left - Model Dropdown */}
            <div className="relative flex-shrink-0" ref={modelDropdownRef}>
                <button
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex items-center gap-1 text-[11px] text-neutral-300 hover:bg-neutral-700 px-2 py-1.5 rounded-md transition-colors border border-neutral-600"
                >
                    {currentModel.provider === 'google' ? (
                        <Banana size={11} className="text-yellow-400" />
                    ) : currentModel.provider === 'openai' ? (
                        <OpenAIIcon size={11} className="text-green-400" />
                    ) : currentModel.provider === 'kling' ? (
                        <KlingIcon size={14} />
                    ) : (
                        <ImageIcon size={11} className="text-cyan-400" />
                    )}
                    <span className="font-medium whitespace-nowrap">{currentModel.name}</span>
                    <ChevronDown size={10} className="opacity-50" />
                </button>

                {showModelDropdown && (
                    <div className="absolute bottom-full mb-2 left-0 w-48 bg-[#252525] border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-50">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider bg-[#1a1a1a] border-b border-neutral-700">
                            {hasInputImage ? 'Image → Image' : 'Text → Image'}
                        </div>
                        {availableModels.filter(m => m.provider === 'openai').length > 0 && (
                            <>
                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">OpenAI</div>
                                {availableModels.filter(m => m.provider === 'openai').map(model => (
                                    <button
                                        key={model.id}
                                        onClick={() => onModelChange(model.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <OpenAIIcon size={12} className="text-green-400" />
                                            {model.name}
                                            {model.recommended && (
                                                <span className="text-[9px] px-1 py-0.5 bg-green-600/30 text-green-400 rounded">REC</span>
                                            )}
                                        </span>
                                        {currentModel.id === model.id && <Check size={12} />}
                                    </button>
                                ))}
                            </>
                        )}
                        {availableModels.filter(m => m.provider === 'google').length > 0 && (
                            <>
                                <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f] border-t border-neutral-700">Google</div>
                                {availableModels.filter(m => m.provider === 'google').map(model => (
                                    <button
                                        key={model.id}
                                        onClick={() => onModelChange(model.id)}
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
                                        onClick={() => onModelChange(model.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-[#333] transition-colors ${currentModel.id === model.id ? 'text-blue-400' : 'text-neutral-300'}`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <KlingIcon size={14} />
                                            {model.name}
                                            {model.recommended && (
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
                                    onClick={() => onAspectChange(ratio)}
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
                            <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-wider bg-[#1f1f1f]">Quality</div>
                            {(currentModel.resolutions || ['1K']).map(res => (
                                <button
                                    key={res}
                                    onClick={() => onResolutionChange(res)}
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
                    onClick={onGenerate}
                    className="px-4 py-1.5 bg-[#6c85ff] hover:bg-[#5a75ff] rounded-md text-[11px] font-bold text-white shadow-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2v20M2 12h20" />
                    </svg>
                    Generate
                </button>
            </div>
        </div>
    );
};
