/**
 * NodeContent.tsx
 * 
 * Displays the content area of a canvas node.
 * Handles result display (image/video) and placeholder states.
 */

import React from 'react';
import { Loader2, Maximize2, ImageIcon as ImageIcon, Film } from 'lucide-react';
import { NodeData, NodeStatus, NodeType } from '../../types';

interface NodeContentProps {
    data: NodeData;
    inputUrl?: string;
    selected: boolean;
    isIdle: boolean;
    isLoading: boolean;
    isSuccess: boolean;
    getAspectRatioStyle: () => { aspectRatio: string };
}

export const NodeContent: React.FC<NodeContentProps> = ({
    data,
    inputUrl,
    selected,
    isIdle,
    isLoading,
    isSuccess,
    getAspectRatioStyle
}) => {
    return (
        <div className={`transition-all duration-200 ${!selected ? 'p-0 rounded-2xl overflow-hidden' : 'p-1'}`}>
            {/* Result View */}
            {isSuccess && data.resultUrl ? (
                <div
                    className={`relative w-full bg-black group/image ${!selected ? '' : 'rounded-xl overflow-hidden'}`}
                    style={getAspectRatioStyle()}
                >
                    {data.type === NodeType.VIDEO ? (
                        <video src={data.resultUrl} controls autoPlay loop className="w-full h-full object-cover" onPointerDown={(e) => e.stopPropagation()} />
                    ) : (
                        <img src={data.resultUrl} alt="Generated" className="w-full h-full object-cover pointer-events-none" />
                    )}

                    {/* Overlay Actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            className="p-1.5 bg-black/50 hover:bg-black/80 rounded-lg text-white backdrop-blur-md"
                        >
                            <Maximize2 size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                /* Placeholder / Empty State */
                <div className={`relative w-full aspect-[4/3] bg-[#141414] flex flex-col items-center justify-center gap-3 overflow-hidden
            ${isLoading ? 'animate-pulse' : ''} 
            ${!selected ? 'rounded-2xl' : 'rounded-xl border border-dashed border-neutral-800'}`
                }>
                    {/* Input Image Preview for Video Nodes */}
                    {data.type === NodeType.VIDEO && inputUrl && (
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
                            <div className="text-neutral-700">
                                {data.type === NodeType.VIDEO ? <Film size={40} /> : <ImageIcon size={40} />}
                            </div>
                            {selected && (
                                <>
                                    <div className="text-neutral-500 text-sm font-medium">
                                        {data.type === NodeType.VIDEO && inputUrl ? "Ready to animate" : (data.type === NodeType.VIDEO ? "Waiting for input..." : "Try to:")}
                                    </div>
                                    {data.type !== NodeType.VIDEO && (
                                        <div className="flex flex-col gap-1 text-xs text-neutral-600 text-center">
                                            <span>• Image to Image</span>
                                            <span>• Image to Video</span>
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
