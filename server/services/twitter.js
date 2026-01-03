/**
 * twitter.js
 * 
 * Twitter (X) API service for posting media.
 * Handles OAuth 2.0 with PKCE authentication and media uploads.
 */

import { TwitterApi } from 'twitter-api-v2';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES & STATE
// ============================================================================

/**
 * In-memory storage for OAuth sessions and authenticated clients
 * In production, use Redis or a database
 */
const oauthSessions = new Map(); // state -> { codeVerifier, codeChallenge }
const authenticatedClients = new Map(); // sessionId -> { client, expiresAt }

// ============================================================================
// OAUTH FLOW
// ============================================================================

/**
 * Generate OAuth 2.0 authorization URL with PKCE
 * 
 * @param {string} clientId - Twitter OAuth client ID
 * @param {string} callbackUrl - Callback URL registered in Twitter app
 * @returns {Object} - { url, state, codeVerifier }
 */
export function generateAuthUrl(clientId, callbackUrl) {
    const client = new TwitterApi({ clientId, clientSecret: undefined });

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Generate PKCE code verifier and challenge
    const { url, codeVerifier } = client.generateOAuth2AuthLink(callbackUrl, {
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
        state
    });

    // Store session data
    oauthSessions.set(state, {
        codeVerifier,
        createdAt: Date.now()
    });

    // Clean up old sessions (older than 10 minutes)
    cleanupOldSessions();

    return { url, state };
}

/**
 * Handle OAuth callback and exchange authorization code for tokens
 * 
 * @param {string} clientId - Twitter OAuth client ID
 * @param {string} clientSecret - Twitter OAuth client secret
 * @param {string} code - Authorization code from callback
 * @param {string} state - State parameter for CSRF verification
 * @param {string} callbackUrl - Callback URL (must match original)
 * @returns {Promise<Object>} - { sessionId, accessToken, user }
 */
export async function handleCallback(clientId, clientSecret, code, state, callbackUrl) {
    // Verify state and get code verifier
    const session = oauthSessions.get(state);
    if (!session) {
        throw new Error('Invalid or expired OAuth session');
    }

    const { codeVerifier } = session;
    oauthSessions.delete(state);

    // Exchange code for tokens
    const client = new TwitterApi({ clientId, clientSecret });
    const { accessToken, refreshToken, expiresIn, client: loggedClient } =
        await client.loginWithOAuth2({
            code,
            codeVerifier,
            redirectUri: callbackUrl
        });

    // Get user info
    const { data: user } = await loggedClient.v2.me();

    // Generate session ID and store authenticated client
    const sessionId = crypto.randomBytes(32).toString('hex');
    authenticatedClients.set(sessionId, {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (expiresIn * 1000),
        user,
        clientId,
        clientSecret
    });

    return {
        sessionId,
        user: {
            id: user.id,
            username: user.username,
            name: user.name
        }
    };
}

/**
 * Get authenticated client from session
 * 
 * @param {string} sessionId - Session ID from cookie/header
 * @returns {TwitterApi|null} - Authenticated client or null
 */
export function getAuthenticatedClient(sessionId) {
    const session = authenticatedClients.get(sessionId);
    if (!session) return null;

    // Check if expired
    if (Date.now() > session.expiresAt) {
        authenticatedClients.delete(sessionId);
        return null;
    }

    return new TwitterApi(session.accessToken);
}

/**
 * Check if session is authenticated
 * 
 * @param {string} sessionId - Session ID
 * @returns {Object|null} - User info or null
 */
export function getSessionUser(sessionId) {
    const session = authenticatedClients.get(sessionId);
    if (!session || Date.now() > session.expiresAt) {
        return null;
    }
    return session.user;
}

// ============================================================================
// MEDIA UPLOAD (uses OAuth 1.0a for v1.1 API)
// ============================================================================

/**
 * Get OAuth 1.0a client for media uploads
 * v1.1 API requires OAuth 1.0a authentication
 * 
 * @returns {TwitterApi|null} - OAuth 1.0a client or null if not configured
 */
function getOAuth1Client() {
    const apiKey = process.env.TWITTER_API_KEY;
    const apiSecret = process.env.TWITTER_API_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret ||
        apiKey === 'your_api_key_here' || accessToken === 'your_access_token_here') {
        console.warn('[Twitter] OAuth 1.0a credentials not configured for media upload');
        return null;
    }

    return new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessTokenSecret
    });
}

/**
 * Upload media to Twitter using OAuth 1.0a
 * 
 * @param {string} sessionId - Session ID (for logging/context)
 * @param {string} mediaPath - Absolute path to media file
 * @param {string} mediaType - 'image' or 'video'
 * @returns {Promise<string>} - media_id_string
 */
export async function uploadMedia(sessionId, mediaPath, mediaType) {
    // Use OAuth 1.0a client for v1.1 media upload
    const oauth1Client = getOAuth1Client();
    if (!oauth1Client) {
        throw new Error('Media upload requires OAuth 1.0a credentials. Please add TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, and TWITTER_ACCESS_TOKEN_SECRET to .env');
    }

    // Read file into buffer
    const mediaBuffer = fs.readFileSync(mediaPath);

    // Determine MIME type
    const ext = path.extname(mediaPath).toLowerCase();
    let mimeType;
    if (mediaType === 'video') {
        mimeType = 'video/mp4';
    } else {
        mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    }

    console.log(`[Twitter] Uploading ${mediaType}: ${mediaPath} (${mimeType})`);

    // Upload media using v1 API with OAuth 1.0a
    const mediaId = await oauth1Client.v1.uploadMedia(mediaBuffer, {
        mimeType,
        target: mediaType === 'video' ? 'tweet' : undefined
    });

    console.log(`[Twitter] Media uploaded successfully: ${mediaId}`);

    return mediaId;
}

/**
 * Upload media from URL (downloads first, then uploads)
 * 
 * @param {string} sessionId - Session ID
 * @param {string} mediaUrl - URL of media (local server URL like /library/images/xxx.png)
 * @param {string} mediaType - 'image' or 'video'
 * @param {string} libraryDir - Base library directory path
 * @returns {Promise<string>} - media_id_string
 */
export async function uploadMediaFromUrl(sessionId, mediaUrl, mediaType, libraryDir) {
    // Convert local URL to file path
    // mediaUrl format: /library/images/xxx.png or /library/videos/xxx.mp4
    let mediaPath;

    if (mediaUrl.startsWith('/library/')) {
        // Local library URL
        const relativePath = mediaUrl.replace('/library/', '');
        mediaPath = path.join(libraryDir, relativePath);
    } else if (mediaUrl.startsWith('data:')) {
        // Base64 data URL - save to temp file first
        const matches = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error('Invalid data URL');

        const base64Data = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');

        const tempDir = path.join(libraryDir, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const ext = mediaType === 'video' ? 'mp4' : 'png';
        mediaPath = path.join(tempDir, `twitter_upload_${Date.now()}.${ext}`);
        fs.writeFileSync(mediaPath, buffer);
    } else {
        throw new Error('Unsupported media URL format');
    }

    if (!fs.existsSync(mediaPath)) {
        throw new Error(`Media file not found: ${mediaPath}`);
    }

    return uploadMedia(sessionId, mediaPath, mediaType);
}

// ============================================================================
// TWEET POSTING
// ============================================================================

/**
 * Post a tweet with optional media
 * 
 * @param {string} sessionId - Session ID
 * @param {string} text - Tweet text
 * @param {string|null} mediaId - Optional media ID from uploadMedia
 * @returns {Promise<Object>} - { tweetId, tweetUrl }
 */
export async function postTweet(sessionId, text, mediaId = null) {
    const client = getAuthenticatedClient(sessionId);
    if (!client) {
        throw new Error('Not authenticated');
    }

    const session = authenticatedClients.get(sessionId);
    const username = session?.user?.username;

    console.log(`[Twitter] Posting tweet: "${text.substring(0, 50)}..." with media: ${mediaId || 'none'}`);

    const tweetPayload = { text };
    if (mediaId) {
        tweetPayload.media = { media_ids: [mediaId] };
    }

    const { data } = await client.v2.tweet(tweetPayload);

    const tweetUrl = username
        ? `https://twitter.com/${username}/status/${data.id}`
        : `https://twitter.com/i/status/${data.id}`;

    console.log(`[Twitter] Tweet posted: ${tweetUrl}`);

    return {
        tweetId: data.id,
        tweetUrl
    };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Clean up expired OAuth sessions
 */
function cleanupOldSessions() {
    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();

    for (const [state, session] of oauthSessions.entries()) {
        if (now - session.createdAt > TEN_MINUTES) {
            oauthSessions.delete(state);
        }
    }
}

/**
 * Logout / clear session
 * 
 * @param {string} sessionId - Session ID to clear
 */
export function clearSession(sessionId) {
    authenticatedClients.delete(sessionId);
}
