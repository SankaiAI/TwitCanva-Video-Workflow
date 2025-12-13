/**
 * ChatPanel.tsx
 * 
 * Agent chat panel that slides in from the right side.
 * Shows greeting, inspiration suggestions, chat messages, and input.
 * Supports drag-drop of image/video nodes from canvas.
 * Includes chat history panel for viewing past conversations.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, History, Paperclip, Globe, Settings, Send, Sparkles, Plus, Loader2, ChevronLeft, Trash2, MessageSquare } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { useChatAgent, ChatMessage as ChatMessageType, ChatSession } from '../hooks/useChatAgent';

// ============================================================================
// TYPES
// ============================================================================

interface AttachedMedia {
    type: 'image' | 'video';
    url: string;
    nodeId: string;
    base64?: string;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    userName?: string;
    isDraggingNode?: boolean;
    onNodeDrop?: (nodeId: string, url: string, type: 'image' | 'video') => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    userName = 'Creator',
    isDraggingNode = false,
}) => {
    // --- State ---
    const [message, setMessage] = useState('');
    const [showTip, setShowTip] = useState(true);
    const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // Chat agent hook
    const {
        messages,
        topic,
        isLoading,
        error,
        sessions,
        isLoadingSessions,
        sendMessage,
        startNewChat,
        loadSession,
        deleteSession,
        hasMessages,
    } = useChatAgent();

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // --- Effects ---

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // --- Event Handlers ---

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Only set false if leaving the panel entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragOver(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        // Get data from drag event
        const nodeData = e.dataTransfer.getData('application/json');
        if (nodeData) {
            try {
                const { nodeId, url, type } = JSON.parse(nodeData);
                if (url && (type === 'image' || type === 'video')) {
                    // Add to attachments if not already present
                    setAttachedMedia(prev => {
                        if (prev.some(m => m.nodeId === nodeId)) return prev;
                        return [...prev, { type, url, nodeId, base64: url }];
                    });
                }
            } catch (err) {
                console.error('Failed to parse dropped node data:', err);
            }
        }
    };

    const removeAttachment = (nodeId: string) => {
        setAttachedMedia(prev => prev.filter(m => m.nodeId !== nodeId));
    };

    const handleSend = async () => {
        if ((!message.trim() && attachedMedia.length === 0) || isLoading) return;

        const currentMessage = message;
        const currentMedia = attachedMedia;

        // Clear input immediately for better UX
        setMessage('');
        setAttachedMedia([]);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Hide tip after first message
        if (showTip) {
            setShowTip(false);
        }

        await sendMessage(
            currentMessage,
            currentMedia.length > 0 ? currentMedia.map(m => ({
                type: m.type,
                url: m.url,
                base64: m.base64,
            })) : undefined
        );
    };

    const handleNewChat = () => {
        startNewChat();
        setMessage('');
        setAttachedMedia([]);
        setShowTip(true);
        setShowHistory(false);
    };

    const handleLoadSession = async (sessionId: string) => {
        await loadSession(sessionId);
        setShowHistory(false);
        setShowTip(false);
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        await deleteSession(sessionId);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    // --- Render ---

    if (!isOpen) return null;

    const showHighlight = isDraggingNode || isDragOver;

    return (
        <div
            className={`fixed top-0 right-0 w-[400px] h-full bg-[#1a1a1a] border-l flex flex-col z-40 shadow-2xl transition-all duration-200 ${showHighlight ? 'border-cyan-500 border-2' : 'border-neutral-800'
                }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag Overlay */}
            {showHighlight && (
                <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none z-10 flex items-center justify-center">
                    <div className="bg-cyan-500/20 border-2 border-dashed border-cyan-400 rounded-2xl px-8 py-6 text-center">
                        <Sparkles className="w-10 h-10 mx-auto mb-2 text-cyan-400" />
                        <p className="text-cyan-300 font-medium">Drop image/video here</p>
                    </div>
                </div>
            )}

            {/* History Panel */}
            {showHistory && (
                <div className="absolute inset-0 bg-[#1a1a1a] z-20 flex flex-col">
                    {/* History Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800">
                        <button
                            onClick={() => setShowHistory(false)}
                            className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-white font-medium text-sm">Chat History</span>
                    </div>

                    {/* History List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {isLoadingSessions ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="text-center py-8">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
                                <p className="text-neutral-500 text-sm">No chat history yet</p>
                                <p className="text-neutral-600 text-xs mt-1">Start a conversation to see it here</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {sessions.map((session: ChatSession) => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleLoadSession(session.id)}
                                        className="w-full text-left p-3 bg-neutral-800/50 hover:bg-neutral-800 rounded-xl transition-colors group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium truncate">
                                                    {session.topic}
                                                </p>
                                                <p className="text-neutral-500 text-xs mt-1">
                                                    {session.messageCount} messages · {formatDate(session.updatedAt || session.createdAt)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session.id)}
                                                className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all text-neutral-500 hover:text-red-400"
                                                title="Delete chat"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* New Chat Button */}
                    <div className="p-4 border-t border-neutral-800">
                        <button
                            onClick={handleNewChat}
                            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 rounded-xl text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} />
                            New Chat
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                    {/* Topic or default title */}
                    <span className="text-white font-medium text-sm truncate max-w-[180px]">
                        {topic || (hasMessages ? 'New Chat' : 'ImageIdeas')}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {/* New Chat button - only show after messages exist */}
                    {hasMessages && (
                        <button
                            onClick={handleNewChat}
                            className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
                            title="New Chat"
                        >
                            <Plus size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => setShowHistory(true)}
                        className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
                        title="Chat History"
                    >
                        <History size={18} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {/* Show greeting and tip if no messages */}
                {!hasMessages ? (
                    <>
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
                    </>
                ) : (
                    /* Chat Messages */
                    <div className="space-y-1">
                        {messages.map((msg: ChatMessageType) => (
                            <ChatMessage
                                key={msg.id}
                                role={msg.role}
                                content={msg.content}
                                media={msg.media}
                                timestamp={msg.timestamp}
                            />
                        ))}

                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex justify-start mb-4">
                                <div className="bg-neutral-800 rounded-2xl rounded-bl-md px-4 py-3">
                                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                                </div>
                            </div>
                        )}

                        {/* Error message */}
                        {error && (
                            <div className="flex justify-center mb-4">
                                <div className="bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-2 text-red-400 text-sm">
                                    {error}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-neutral-800">
                <div className="bg-neutral-800 rounded-2xl p-3">
                    {/* Attached Media Preview */}
                    {attachedMedia.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {attachedMedia.map((media) => (
                                <div key={media.nodeId} className="relative">
                                    {media.type === 'image' ? (
                                        <img
                                            src={media.url}
                                            alt="Attached"
                                            className="w-14 h-14 object-cover rounded-lg"
                                        />
                                    ) : (
                                        <video
                                            src={media.url}
                                            className="w-14 h-14 object-cover rounded-lg"
                                        />
                                    )}
                                    <button
                                        onClick={() => removeAttachment(media.nodeId)}
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center text-white text-[10px]"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Start your journey of inspiration"
                        className="w-full bg-transparent text-white text-sm placeholder:text-neutral-500 outline-none mb-3 resize-none min-h-[24px] max-h-[120px]"
                        rows={1}
                        style={{ scrollbarWidth: 'none' }}
                        disabled={isLoading}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            const newHeight = Math.min(target.scrollHeight, 120);
                            target.style.height = newHeight + 'px';
                            target.style.overflowY = target.scrollHeight > 120 ? 'auto' : 'hidden';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
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
                            <button
                                onClick={handleSend}
                                disabled={isLoading || (!message.trim() && !attachedMedia)}
                                className={`p-2 rounded-full transition-colors text-white ${isLoading || (!message.trim() && !attachedMedia)
                                    ? 'bg-neutral-600 cursor-not-allowed'
                                    : 'bg-cyan-500 hover:bg-cyan-400'
                                    }`}
                            >
                                {isLoading ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Send size={14} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// CHAT BUBBLE
// ============================================================================

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
            className="fixed bottom-6 right-6 w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-110 z-50 animate-breathing"
            style={{
                animation: 'breathing 3s ease-in-out infinite',
            }}
        >
            <Sparkles size={22} className="text-white" />
            <style>{`
                @keyframes breathing {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 10px 15px -3px rgba(6, 182, 212, 0.3), 0 4px 6px -4px rgba(6, 182, 212, 0.3);
                    }
                    50% {
                        transform: scale(1.08);
                        box-shadow: 0 20px 25px -5px rgba(6, 182, 212, 0.5), 0 8px 10px -6px rgba(6, 182, 212, 0.5);
                    }
                }
            `}</style>
        </button>
    );
};
