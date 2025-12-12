/**
 * ChatPanel.tsx
 * 
 * Agent chat panel that slides in from the right side.
 * Shows greeting, inspiration suggestions, and chat input.
 */

import React, { useState } from 'react';
import { X, History, MessageCircle, Paperclip, Globe, Settings, Send, Sparkles } from 'lucide-react';

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    userName?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    userName = 'Creator'
}) => {
    const [message, setMessage] = useState('');
    const [showTip, setShowTip] = useState(true);

    if (!isOpen) return null;

    return (
        <div className="fixed top-0 right-0 w-[340px] h-full bg-[#1a1a1a] border-l border-neutral-800 flex flex-col z-40 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                    <History size={18} className="text-neutral-400" />
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Greeting */}
                <h1 className="text-2xl font-bold text-white mb-1">
                    Hi, {userName}
                </h1>
                <p className="text-cyan-400 text-lg mb-6">
                    Looking for inspiration?
                </p>

                {/* Tip Card */}
                {showTip && (
                    <div className="bg-neutral-800/50 rounded-2xl p-4 mb-4">
                        <div className="bg-neutral-700/50 rounded-xl h-24 mb-3 flex items-center justify-center">
                            <div className="text-neutral-500 text-sm">Preview Area</div>
                        </div>
                        <p className="text-neutral-400 text-sm leading-relaxed mb-3">
                            Drag image/video nodes into the chat dialog to unlock advanced features like prompt generation based on node content, providing more inspiration for your creativity~
                        </p>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setShowTip(false)}
                                className="px-4 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-white transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-neutral-800">
                <div className="bg-neutral-800 rounded-2xl p-3">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Start your journey of inspiration"
                        className="w-full bg-transparent text-white text-sm placeholder:text-neutral-500 outline-none mb-3"
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-neutral-300 transition-colors">
                                <MessageCircle size={14} />
                                Chat Mode
                                <span className="text-neutral-500">▾</span>
                            </button>
                            <button className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400">
                                <Paperclip size={16} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400">
                                <Globe size={16} />
                            </button>
                            <button className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400">
                                <Settings size={16} />
                            </button>
                            <button className="p-2 bg-cyan-500 hover:bg-cyan-400 rounded-full transition-colors text-white">
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * ChatBubble - Floating button to open chat
 */
interface ChatBubbleProps {
    onClick: () => void;
    isOpen: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ onClick, isOpen }) => {
    if (isOpen) return null;

    return (
        <button
            onClick={onClick}
            className="fixed bottom-6 right-6 w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-110 z-50"
        >
            <Sparkles size={22} className="text-white" />
        </button>
    );
};
