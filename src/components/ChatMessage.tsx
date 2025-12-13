/**
 * ChatMessage.tsx
 * 
 * Reusable message bubble component for the chat panel.
 * Displays user and assistant messages with multiple media support.
 */

import React from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
    media?: {
        type: 'image' | 'video';
        url: string;
    }[];
    timestamp?: Date;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ChatMessage: React.FC<ChatMessageProps> = ({
    role,
    content,
    media,
    timestamp
}) => {
    const isUser = role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser
                    ? 'bg-cyan-600 text-white rounded-br-md'
                    : 'bg-neutral-800 text-neutral-100 rounded-bl-md'
                    }`}
            >
                {/* Media Attachments */}
                {media && media.length > 0 && (
                    <div className={`mb-2 ${media.length > 1 ? 'grid grid-cols-2 gap-2' : ''}`}>
                        {media.map((m, index) => (
                            <div key={index} className="relative">
                                {m.type === 'image' ? (
                                    <img
                                        src={m.url}
                                        alt={`Attached ${index + 1}`}
                                        className="w-full max-h-32 rounded-lg object-cover"
                                    />
                                ) : (
                                    <video
                                        src={m.url}
                                        className="w-full max-h-32 rounded-lg object-cover"
                                        controls
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Message Content */}
                <div className="text-sm whitespace-pre-wrap leading-relaxed select-text cursor-text">
                    {content}
                </div>

                {/* Timestamp (optional) */}
                {timestamp && (
                    <div
                        className={`text-[10px] mt-1 ${isUser ? 'text-cyan-200' : 'text-neutral-500'
                            }`}
                    >
                        {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;
