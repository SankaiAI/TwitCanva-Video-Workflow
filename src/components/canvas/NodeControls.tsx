/**
 * NodeControls.tsx
 * 
 * Control panel for canvas nodes.
 * Handles prompt input, model selection, size/ratio settings, and generation button.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Banana, Settings2, Check } from 'lucide-react';
import { NodeData, NodeStatus, NodeType } from '../../types';

interface NodeControlsProps {
    data: NodeData;
    inputUrl?: string;
    isLoading: boolean;
    isSuccess: boolean;
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

export const NodeControls: React.FC<NodeControlsProps> = ({
    data,
    inputUrl,
    isLoading,
    isSuccess,
    onUpdate,
    onGenerate,
    onSelect
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showSizeDropdown, setShowSizeDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSizeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSizeSelect = (value: string) => {
        if (data.type === NodeType.VIDEO) {
            onUpdate(data.id, { resolution: value });
        } else {
            onUpdate(data.id, { aspectRatio: value });
        }
        setShowSizeDropdown(false);
    };

    const currentSizeLabel = data.type === NodeType.VIDEO
        ? (data.resolution || "Auto")
        : (data.aspectRatio || "Auto");

    const sizeOptions = data.type === NodeType.VIDEO ? VIDEO_RESOLUTIONS : IMAGE_RATIOS;

    return (
        <div
            className="p-3 bg-[#1a1a1a] border-t border-neutral-800 rounded-b-2xl cursor-default"
            onPointerDown={(e) => e.stopPropagation()} // Allow selecting text/interacting without dragging
            onClick={() => onSelect(data.id)} // Ensure clicking here selects the node
        >
            <textarea
                className="w-full bg-transparent text-sm text-white placeholder-neutral-600 outline-none resize-none mb-3 font-light"
                placeholder={data.type === NodeType.VIDEO && inputUrl ? "Describe how to animate this frame..." : "Describe what you want to generate..."}
                rows={2}
                value={data.prompt}
                onChange={(e) => onUpdate(data.id, { prompt: e.target.value })}
            // Always allow editing, even if loading or success, to support re-generation
            />

            {data.errorMessage && (
                <div className="text-red-400 text-xs mb-2 p-1 bg-red-900/20 rounded border border-red-900/50">
                    {data.errorMessage}
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                    {/* Model Selector */}
                    <button className="flex items-center gap-1.5 text-xs text-neutral-300 hover:bg-neutral-800 px-2 py-1.5 rounded-lg transition-colors">
                        <Banana size={12} className="text-yellow-400" />
                        <span className="font-medium">
                            {data.type === NodeType.VIDEO ? "Veo 3.1" : "Banana Pro"}
                        </span>
                        <Settings2 size={12} className="ml-1 opacity-50" />
                    </button>
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
            <div
                className="mt-2 pt-2 border-t border-neutral-800"
                onClick={() => setShowAdvanced(!showAdvanced)}
            >
                <div className="flex items-center justify-center cursor-pointer">
                    <span className="text-[10px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400">Advanced Settings</span>
                </div>
            </div>
        </div>
    );
};
