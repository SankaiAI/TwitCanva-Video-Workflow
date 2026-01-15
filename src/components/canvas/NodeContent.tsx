/**
 * NodeContent.tsx
 * 
 * Displays the content area of a canvas node.
 * Handles result display (image/video) and placeholder states.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Loader2, Maximize2, ImageIcon as ImageIcon, Film, Upload, Pencil, Video, GripVertical, Download, Expand, Shrink, HardDrive } from 'lucide-react';
import { NodeData, NodeStatus, NodeType } from '../../types';

interface NodeContentProps {
    data: NodeData;
    inputUrl?: string;
    selected: boolean;
    isIdle: boolean;
    isLoading: boolean;
    isSuccess: boolean;
    getAspectRatioStyle: () => { aspectRatio: string };
    onUpload?: (nodeId: string, imageDataUrl: string) => void;
    onExpand?: (imageUrl: string) => void;
    onDragStart?: (nodeId: string, hasContent: boolean) => void;
    onDragEnd?: () => void;
    // Text node callbacks
    onWriteContent?: (nodeId: string) => void;
    onTextToVideo?: (nodeId: string) => void;
    onTextToImage?: (nodeId: string) => void;
    // Image node callbacks
    onImageToImage?: (nodeId: string) => void;
    onImageToVideo?: (nodeId: string) => void;
    onUpdate?: (nodeId: string, updates: Partial<NodeData>) => void;
    // Social sharing
    onPostToX?: (nodeId: string, mediaUrl: string, mediaType: 'image' | 'video') => void;
}

export const NodeContent: React.FC<NodeContentProps> = ({
    data,
    inputUrl,
    selected,
    isIdle,
    isLoading,
    isSuccess,
    getAspectRatioStyle,
    onUpload,
    onExpand,
    onDragStart,
    onDragEnd,
    onWriteContent,
    onTextToVideo,
    onTextToImage,
    onImageToImage,
    onImageToVideo,
    onUpdate,
    onPostToX
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Local state for text node textarea to prevent lag
    const [localPrompt, setLocalPrompt] = useState(data.prompt || '');
    const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentPromptRef = useRef<string | undefined>(data.prompt); // Track what we sent

    // Helper: Check if node is image-type (includes local image model)
    const isImageType = data.type === NodeType.IMAGE || data.type === NodeType.LOCAL_IMAGE_MODEL;
    // Helper: Check if node is video-type (includes local video model)
    const isVideoType = data.type === NodeType.VIDEO || data.type === NodeType.LOCAL_VIDEO_MODEL;
    // Helper: Check if node is local model
    const isLocalModel = data.type === NodeType.LOCAL_IMAGE_MODEL || data.type === NodeType.LOCAL_VIDEO_MODEL;

    // Sync local state ONLY when data.prompt changes externally (not from our own update)
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

    const handleTextChange = (value: string) => {
        setLocalPrompt(value); // Update local state immediately
        lastSentPromptRef.current = value; // Track that we're about to send this

        // Debounce parent update
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
            onUpdate?.(data.id, { prompt: value });
        }, 150);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUpload) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            onUpload(data.id, reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className={`transition-all duration-200 ${!selected ? 'p-0 rounded-2xl overflow-hidden' : 'p-1'}`}>
            {/* Hidden File Input - Always rendered for upload functionality (image types only) */}
            {isImageType && onUpload && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
            )}

            {/* Result View - Show when successful OR when regenerating (loading with existing content) */}
            {(isSuccess || isLoading) && data.resultUrl ? (
                <div
                    className={`relative w-full bg-black group/image ${!selected ? '' : 'rounded-xl overflow-hidden'}`}
                    style={getAspectRatioStyle()}
                >
                    {isVideoType ? (
                        <video src={data.resultUrl} controls loop className="w-full h-full object-cover" />
                    ) : (
                        <img src={data.resultUrl} alt="Generated" className="w-full h-full object-cover pointer-events-none" />
                    )}

                    {/* Regenerating Overlay - Shows when loading with existing content */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                            <Loader2 size={40} className="animate-spin text-blue-400" />
                            <span className="mt-3 text-sm text-white font-medium">Regenerating...</span>
                        </div>
                    )}
                </div>
            ) : data.type === NodeType.TEXT ? (
                /* Text Node - Menu or Editing Mode */
                <div className={`relative w-full bg-[#1a1a1a] rounded-2xl overflow-hidden ${selected ? 'ring-1 ring-blue-500/30' : ''}`}>
                    {data.textMode === 'editing' ? (
                        /* Editing Mode - Text Area */
                        <div className="p-4">
                            <textarea
                                value={localPrompt}
                                onChange={(e) => handleTextChange(e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onWheel={(e) => e.stopPropagation()}
                                onBlur={() => {
                                    // Ensure final value is saved on blur
                                    if (updateTimeoutRef.current) {
                                        clearTimeout(updateTimeoutRef.current);
                                    }
                                    if (localPrompt !== data.prompt) {
                                        onUpdate?.(data.id, { prompt: localPrompt });
                                    }
                                }}
                                placeholder="Write your text content here..."
                                className="w-full bg-transparent text-white text-sm resize-none outline-none placeholder:text-neutral-600"
                                style={{ minHeight: data.isPromptExpanded ? '300px' : '150px' }}
                                autoFocus
                            />
                            {/* Expand/Shrink Button */}
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={() => onUpdate?.(data.id, { isPromptExpanded: !data.isPromptExpanded })}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-white hover:bg-neutral-700 rounded transition-colors"
                                    title={data.isPromptExpanded ? 'Shrink text area' : 'Expand text area'}
                                >
                                    {data.isPromptExpanded ? <Shrink size={12} /> : <Expand size={12} />}
                                    <span>{data.isPromptExpanded ? 'Shrink' : 'Expand'}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Menu Mode - Show Options */
                        <div className="p-5 flex flex-col gap-4">
                            {/* Header */}
                            <div className="text-neutral-500 text-sm font-medium">
                                Try to:
                            </div>

                            {/* Menu Options */}
                            <div className="flex flex-col gap-1">
                                <TextNodeMenuItem
                                    icon={<Pencil size={16} />}
                                    label="Write your own content"
                                    onClick={() => onWriteContent?.(data.id)}
                                />
                                <TextNodeMenuItem
                                    icon={<Video size={16} />}
                                    label="Text to Video"
                                    onClick={() => onTextToVideo?.(data.id)}
                                />
                                <TextNodeMenuItem
                                    icon={<ImageIcon size={16} />}
                                    label="Text to Image"
                                    onClick={() => onTextToImage?.(data.id)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Placeholder / Empty State for Image/Video */
                <div className={`relative w-full aspect-[4/3] bg-[#141414] flex flex-col items-center justify-center gap-3 overflow-hidden
            ${isLoading ? 'animate-pulse' : ''} 
            ${!selected ? 'rounded-2xl' : 'rounded-xl border border-dashed border-neutral-800'}`
                }>
                    {/* Input Image Preview for Video Nodes */}
                    {isVideoType && inputUrl && (
                        <div className="absolute inset-0 z-0">
                            <img src={inputUrl} alt="Input Frame" className="w-full h-full object-cover opacity-30 blur-sm" />
                            <div className="absolute inset-0 bg-black/40" />
                            <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white font-medium flex items-center gap-1">
                                <ImageIcon size={10} />
                                Input Frame
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="relative z-10 flex flex-col items-center gap-2">
                            <Loader2 size={32} className="animate-spin text-blue-400" />
                            <span className="text-xs text-neutral-500 font-medium">Generating...</span>
                        </div>
                    ) : (
                        <div className="relative z-10 flex flex-col items-center gap-3">
                            {/* Upload Button for Image Nodes (including local image models) */}
                            {isImageType && onUpload && (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2 px-4 py-2 bg-neutral-800/80 hover:bg-neutral-700 rounded-lg text-white text-sm font-medium transition-colors"
                                    >
                                        <Upload size={16} />
                                        Upload
                                    </button>
                                </>
                            )}

                            <div className="text-neutral-700">
                                {isVideoType ? (
                                    isLocalModel ? <><Film size={40} /><HardDrive size={16} className="absolute -bottom-1 -right-1 text-purple-400" /></> : <Film size={40} />
                                ) : (
                                    isLocalModel ? <><ImageIcon size={40} /><HardDrive size={16} className="absolute -bottom-1 -right-1 text-purple-400" /></> : <ImageIcon size={40} />
                                )}
                            </div>
                            {selected && (
                                <>
                                    <div className="text-neutral-500 text-sm font-medium">
                                        {isVideoType && inputUrl
                                            ? "Ready to animate"
                                            : isVideoType
                                                ? "Waiting for input..."
                                                : isLocalModel
                                                    ? "Select a model and enter prompt"
                                                    : "Try to:"
                                        }
                                    </div>
                                    {!isVideoType && !isLocalModel && (
                                        <div className="flex flex-col gap-1 w-full px-2">
                                            <TextNodeMenuItem
                                                icon={<ImageIcon size={16} />}
                                                label="Image to Image"
                                                onClick={() => onImageToImage?.(data.id)}
                                            />
                                            <TextNodeMenuItem
                                                icon={<Film size={16} />}
                                                label="Image to Video"
                                                onClick={() => onImageToVideo?.(data.id)}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface TextNodeMenuItemProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}

/**
 * Menu item component for Text node options
 */
const TextNodeMenuItem: React.FC<TextNodeMenuItemProps> = ({ icon, label, onClick }) => (
    <button
        className="flex items-center gap-3 w-full p-2.5 rounded-lg text-left text-neutral-400 hover:bg-[#252525] hover:text-white transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClick}
    >
        <span className="text-neutral-500">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
    </button>
);
