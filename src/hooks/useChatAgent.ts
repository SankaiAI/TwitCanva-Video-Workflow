/**
 * useChatAgent.ts
 * 
 * Custom hook for chat agent interactions.
 * Manages messages, sessions, topics, and API communication.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    media?: {
        type: 'image' | 'video';
        url: string;
    }[]; // Array of media attachments
    timestamp: Date;
}

export interface ChatSession {
    id: string;
    topic: string;
    createdAt: string;
    updatedAt?: string;
    messageCount: number;
}

interface UseChatAgentReturn {
    messages: ChatMessage[];
    topic: string | null;
    sessionId: string | null;
    isLoading: boolean;
    error: string | null;
    sessions: ChatSession[];
    isLoadingSessions: boolean;
    sendMessage: (content: string, media?: { type: 'image' | 'video'; url: string; base64?: string }[]) => Promise<void>;
    startNewChat: () => void;
    loadSession: (sessionId: string) => Promise<void>;
    deleteSession: (sessionId: string) => Promise<void>;
    refreshSessions: () => Promise<void>;
    hasMessages: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
    return `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// HOOK
// ============================================================================

export function useChatAgent(): UseChatAgentReturn {
    // --- State ---
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [topic, setTopic] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    // Use ref to track if we've initialized a session
    const hasInitializedRef = useRef(false);

    // --- Callbacks ---

    /**
     * Initialize a new session if needed
     */
    const ensureSession = useCallback(() => {
        if (!sessionId) {
            const newSessionId = generateSessionId();
            setSessionId(newSessionId);
            return newSessionId;
        }
        return sessionId;
    }, [sessionId]);

    /**
     * Fetch all chat sessions from the server
     */
    const refreshSessions = useCallback(async () => {
        setIsLoadingSessions(true);
        try {
            const response = await fetch('/api/chat/sessions');
            if (response.ok) {
                const data = await response.json();
                setSessions(data);
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setIsLoadingSessions(false);
        }
    }, []);

    /**
     * Load a specific session by ID
     */
    const loadSession = useCallback(async (targetSessionId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/chat/sessions/${targetSessionId}`);
            if (!response.ok) {
                throw new Error('Session not found');
            }

            const data = await response.json();

            // Convert messages to ChatMessage format
            const loadedMessages: ChatMessage[] = data.messages.map((msg: any, index: number) => ({
                id: `loaded-${targetSessionId}-${index}`,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(msg.timestamp || data.createdAt),
            }));

            setSessionId(targetSessionId);
            setMessages(loadedMessages);
            setTopic(data.topic);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load session';
            setError(errorMessage);
            console.error('Load session error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Delete a session
     */
    const deleteSession = useCallback(async (targetSessionId: string) => {
        try {
            await fetch(`/api/chat/sessions/${targetSessionId}`, {
                method: 'DELETE',
            });

            // Refresh sessions list
            await refreshSessions();

            // If we deleted the current session, start a new one
            if (targetSessionId === sessionId) {
                setMessages([]);
                setTopic(null);
                setSessionId(generateSessionId());
            }
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    }, [sessionId, refreshSessions]);

    /**
     * Send a message to the chat agent
     */
    const sendMessage = useCallback(async (
        content: string,
        media?: { type: 'image' | 'video'; url: string; base64?: string }[]
    ) => {
        const currentSessionId = ensureSession();
        setError(null);
        setIsLoading(true);

        // Add user message immediately
        const userMessage: ChatMessage = {
            id: generateMessageId(),
            role: 'user',
            content,
            media: media ? media.map(m => ({ type: m.type, url: m.url })) : undefined,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    message: content,
                    media: media ? media.map(m => ({
                        type: m.type,
                        base64: m.base64 || m.url, // Use base64 if available, otherwise URL
                    })) : undefined,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || response.statusText);
            }

            const data = await response.json();

            // Add AI response
            const aiMessage: ChatMessage = {
                id: generateMessageId(),
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, aiMessage]);

            // Update topic if returned
            if (data.topic) {
                setTopic(data.topic);
            }

            // Refresh sessions list to show the new/updated session
            await refreshSessions();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
            setError(errorMessage);
            console.error('Chat error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [ensureSession, refreshSessions]);

    /**
     * Start a new chat session
     */
    const startNewChat = useCallback(() => {
        setMessages([]);
        setTopic(null);
        setSessionId(generateSessionId());
        setError(null);
        hasInitializedRef.current = false;
    }, []);

    // Load sessions on mount
    useEffect(() => {
        refreshSessions();
    }, [refreshSessions]);

    return {
        messages,
        topic,
        sessionId,
        isLoading,
        error,
        sessions,
        isLoadingSessions,
        sendMessage,
        startNewChat,
        loadSession,
        deleteSession,
        refreshSessions,
        hasMessages: messages.length > 0,
    };
}

export default useChatAgent;
