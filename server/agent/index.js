/**
 * agent/index.js
 * 
 * Main entry point for the LangGraph chat agent.
 * Exports the compiled graph and utility functions.
 * 
 * NOTE: Currently implemented in JavaScript/LangGraph.js for simplicity.
 * If more advanced agent capabilities are needed (complex tool chains,
 * multi-agent systems, advanced memory), consider migrating to Python
 * LangGraph which has a more mature and feature-rich ecosystem.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createChatGraph, generateTopicTitle } from "./graph/chatGraph.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

// ============================================================================
// FILE PATHS
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHATS_DIR = path.join(__dirname, '..', '..', 'assets', 'chats');
const IMAGES_DIR = path.join(__dirname, '..', '..', 'assets', 'images');

// Ensure chats directory exists
if (!fs.existsSync(CHATS_DIR)) {
    fs.mkdirSync(CHATS_DIR, { recursive: true });
}

/**
 * Resolve an image URL or base64 to a base64 data URL
 * Handles both file paths (/assets/images/...) and data URLs
 */
function resolveImageToBase64(imageInput) {
    if (!imageInput) return null;

    // Already a base64 data URL
    if (imageInput.startsWith('data:')) {
        return imageInput;
    }

    // File URL - read from disk
    if (imageInput.startsWith('/assets/images/')) {
        const filename = imageInput.replace('/assets/images/', '');
        const filePath = path.join(IMAGES_DIR, filename);
        if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filename).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        }
    }

    // Return as-is if unknown format
    return imageInput;
}

// ============================================================================
// SESSION MANAGEMENT (FILE-BASED)
// ============================================================================

/**
 * In-memory cache for active sessions
 * Sessions are also persisted to disk after each message
 */
const sessionCache = new Map();

/**
 * Convert multimodal content to text representation for serialization
 * This ensures context is preserved without huge base64 data
 */
function contentToText(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        const parts = [];
        let imageCount = 0;

        for (const part of content) {
            if (part.type === 'text') {
                parts.push(part.text);
            } else if (part.type === 'image_url') {
                imageCount++;
                parts.push(`[IMAGE ${imageCount} ATTACHED]`);
            }
        }

        return parts.join('\n');
    }

    return JSON.stringify(content);
}

/**
 * Convert LangChain messages to serializable format
 * Multimodal messages are converted to text with [IMAGE ATTACHED] markers
 */
function serializeMessages(messages) {
    return messages.map(msg => ({
        role: msg._getType?.() === 'human' ? 'user' : 'assistant',
        content: contentToText(msg.content),
        timestamp: new Date().toISOString()
    }));
}

/**
 * Convert serialized messages back to LangChain format
 * All messages are now stored as text (images converted to markers)
 */
function deserializeMessages(messages) {
    return messages.map(msg => {
        if (msg.role === 'user') {
            return new HumanMessage(msg.content);
        } else {
            return new AIMessage(msg.content);
        }
    });
}

/**
 * Get the file path for a session
 */
function getSessionPath(sessionId) {
    return path.join(CHATS_DIR, `${sessionId}.json`);
}

/**
 * Save a session to disk
 */
function saveSession(sessionId, session) {
    const filePath = getSessionPath(sessionId);
    const data = {
        id: sessionId,
        topic: session.topic,
        createdAt: session.createdAt,
        updatedAt: new Date().toISOString(),
        messages: serializeMessages(session.messages)
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Load a session from disk
 */
function loadSession(sessionId) {
    const filePath = getSessionPath(sessionId);
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        return {
            messages: deserializeMessages(data.messages),
            topic: data.topic,
            createdAt: new Date(data.createdAt)
        };
    } catch (err) {
        console.error(`Failed to load session ${sessionId}:`, err);
        return null;
    }
}

/**
 * Get or create a chat session
 * @param {string} sessionId - Unique session identifier
 * @returns {object} Session object
 */
export function getSession(sessionId) {
    // Check cache first
    if (sessionCache.has(sessionId)) {
        return sessionCache.get(sessionId);
    }

    // Try to load from disk
    const loaded = loadSession(sessionId);
    if (loaded) {
        sessionCache.set(sessionId, loaded);
        return loaded;
    }

    // Create new session
    const newSession = {
        messages: [],
        topic: null,
        createdAt: new Date(),
    };
    sessionCache.set(sessionId, newSession);
    return newSession;
}

/**
 * Delete a chat session
 * @param {string} sessionId - Session to delete
 * @returns {boolean} Whether session existed and was deleted
 */
export function deleteSession(sessionId) {
    sessionCache.delete(sessionId);

    const filePath = getSessionPath(sessionId);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}

/**
 * List all sessions from disk (for chat history)
 * @returns {Array} Array of session summaries
 */
export function listSessions() {
    if (!fs.existsSync(CHATS_DIR)) {
        return [];
    }

    const files = fs.readdirSync(CHATS_DIR).filter(f => f.endsWith('.json'));
    const sessions = [];

    for (const file of files) {
        try {
            const filePath = path.join(CHATS_DIR, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            sessions.push({
                id: data.id,
                topic: data.topic || "New Chat",
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                messageCount: data.messages?.length || 0
            });
        } catch (err) {
            console.error(`Failed to read session file ${file}:`, err);
        }
    }

    // Sort by most recent first
    return sessions.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

/**
 * Get full session data (for loading a specific chat)
 * @param {string} sessionId - Session ID
 * @returns {object|null} Full session data with messages
 */
export function getSessionData(sessionId) {
    const filePath = getSessionPath(sessionId);
    if (!fs.existsSync(filePath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`Failed to load session data ${sessionId}:`, err);
        return null;
    }
}

// ============================================================================
// CHAT FUNCTIONS
// ============================================================================

/**
 * Send a message to the chat agent and get a response
 * @param {string} sessionId - Session identifier
 * @param {string} content - User message content
 * @param {Array} media - Optional media attachments [{ type, url, base64 }, ...]
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<object>} { response: string, topic?: string }
 */
export async function sendMessage(sessionId, content, media, apiKey) {
    const session = getSession(sessionId);
    const graph = createChatGraph();

    // Debug: Log session state
    console.log(`[Chat] Session ${sessionId} has ${session.messages.length} existing messages`);

    // Build the user message content
    let messageContent;
    if (media && Array.isArray(media) && media.length > 0) {
        // Multimodal message with images/videos
        const contentParts = [{ type: "text", text: content || "What do you see in these images?" }];

        for (const m of media) {
            // Resolve file URLs to base64 if needed
            const resolvedBase64 = resolveImageToBase64(m.base64);
            if (!resolvedBase64) continue;

            const mimeType = m.type === 'video' ? 'video/mp4' : 'image/png';
            // Extract base64 data if it's a data URL
            const base64Data = resolvedBase64.includes(',')
                ? resolvedBase64.split(',')[1]
                : resolvedBase64;

            contentParts.push({
                type: "image_url",
                image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                },
            });
        }

        messageContent = contentParts;
    } else {
        messageContent = content;
    }

    // Add user message to session
    const userMessage = new HumanMessage(messageContent);
    session.messages.push(userMessage);

    console.log(`[Chat] Sending ${session.messages.length} messages to LLM`);

    // Invoke the graph
    const result = await graph.invoke(
        { messages: session.messages },
        { configurable: { apiKey } }
    );

    // Extract AI response from result
    const aiResponse = result.messages[result.messages.length - 1];
    session.messages.push(aiResponse);

    // Convert the multimodal user message to text for future context
    // This ensures the AI remembers what images contained in subsequent turns
    if (typeof messageContent !== 'string') {
        const textVersion = contentToText(messageContent);
        // Replace the last user message with text version
        const userMsgIndex = session.messages.length - 2;
        session.messages[userMsgIndex] = new HumanMessage(textVersion);
    }

    // Generate topic if this is the first exchange (2 messages: user + AI)
    let topic = session.topic;
    if (session.messages.length === 2 && !session.topic) {
        try {
            topic = await generateTopicTitle(session.messages, apiKey);
            session.topic = topic;
        } catch (err) {
            console.error("Failed to generate topic:", err);
            topic = "New Chat";
        }
    }

    // Save session to disk after each message
    saveSession(sessionId, session);

    return {
        response: aiResponse.content.toString(),
        topic: topic,
        messageCount: session.messages.length,
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { createChatGraph, generateTopicTitle };

export default {
    getSession,
    deleteSession,
    listSessions,
    getSessionData,
    sendMessage,
    createChatGraph,
    generateTopicTitle,
};
