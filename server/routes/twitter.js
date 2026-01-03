/**
 * twitter.js (routes)
 * 
 * API routes for Twitter (X) integration.
 * Handles OAuth flow, media upload, and tweet posting.
 */

import { Router } from 'express';
import path from 'path';
import {
    generateAuthUrl,
    handleCallback,
    getSessionUser,
    uploadMediaFromUrl,
    postTweet,
    clearSession
} from '../services/twitter.js';

const router = Router();

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /auth
 * Initiate OAuth 2.0 flow - returns auth URL for popup
 */
router.get('/auth', (req, res) => {
    try {
        // Read env vars at request time (after dotenv has loaded)
        const clientId = process.env.TWITTER_CLIENT_ID;
        const callbackUrl = process.env.TWITTER_CALLBACK_URL || 'http://localhost:3001/api/twitter/callback';

        if (!clientId) {
            return res.status(500).json({
                error: 'Twitter API not configured. Please set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in .env'
            });
        }

        const { url, state } = generateAuthUrl(clientId, callbackUrl);

        res.json({
            authUrl: url,
            state
        });
    } catch (error) {
        console.error('[Twitter] Auth error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /callback
 * OAuth callback handler - exchanges code for tokens
 * This is loaded in the popup window, should close and notify parent
 */
router.get('/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            console.error('[Twitter] OAuth error:', error, error_description);
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head><title>Twitter Auth Error</title></head>
                <body>
                    <script>
                        window.opener.postMessage({ 
                            type: 'twitter-auth-error', 
                            error: '${error_description || error}' 
                        }, '*');
                        window.close();
                    </script>
                    <p>Authentication failed. This window should close automatically.</p>
                </body>
                </html>
            `);
        }

        if (!code || !state) {
            return res.status(400).send('Missing code or state parameter');
        }

        // Read env vars at request time
        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;
        const callbackUrl = process.env.TWITTER_CALLBACK_URL || 'http://localhost:3001/api/twitter/callback';

        const { sessionId, user } = await handleCallback(
            clientId,
            clientSecret,
            code,
            state,
            callbackUrl
        );

        console.log(`[Twitter] User authenticated: @${user.username}`);

        // Send message to parent window and close popup
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Twitter Auth Success</title></head>
            <body>
                <script>
                    window.opener.postMessage({ 
                        type: 'twitter-auth-success', 
                        sessionId: '${sessionId}',
                        user: ${JSON.stringify(user)}
                    }, '*');
                    window.close();
                </script>
                <p>Authentication successful! This window should close automatically.</p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('[Twitter] Callback error:', error);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Twitter Auth Error</title></head>
            <body>
                <script>
                    window.opener.postMessage({ 
                        type: 'twitter-auth-error', 
                        error: '${error.message.replace(/'/g, "\\'")}' 
                    }, '*');
                    window.close();
                </script>
                <p>Authentication failed. This window should close automatically.</p>
            </body>
            </html>
        `);
    }
});

/**
 * GET /status
 * Check if user is authenticated
 */
router.get('/status', (req, res) => {
    try {
        const sessionId = req.headers['x-twitter-session'] || req.query.sessionId;

        if (!sessionId) {
            return res.json({ authenticated: false });
        }

        const user = getSessionUser(sessionId);

        if (user) {
            res.json({
                authenticated: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name
                }
            });
        } else {
            res.json({ authenticated: false });
        }
    } catch (error) {
        console.error('[Twitter] Status check error:', error);
        res.json({ authenticated: false, error: error.message });
    }
});

/**
 * POST /post
 * Upload media and post a tweet
 */
router.post('/post', async (req, res) => {
    try {
        const sessionId = req.headers['x-twitter-session'];
        const { text, mediaUrl, mediaType } = req.body;

        if (!sessionId) {
            return res.status(401).json({ error: 'Not authenticated. Please login first.' });
        }

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Tweet text is required' });
        }

        if (text.length > 280) {
            return res.status(400).json({ error: 'Tweet exceeds 280 character limit' });
        }

        // Get library directory from app locals
        const libraryDir = req.app.locals.LIBRARY_DIR || path.join(process.cwd(), 'library');

        let mediaId = null;

        // Upload media if provided
        if (mediaUrl && mediaType) {
            console.log(`[Twitter] Uploading ${mediaType} from: ${mediaUrl}`);
            mediaId = await uploadMediaFromUrl(sessionId, mediaUrl, mediaType, libraryDir);
        }

        // Post tweet
        const result = await postTweet(sessionId, text.trim(), mediaId);

        res.json({
            success: true,
            tweetId: result.tweetId,
            tweetUrl: result.tweetUrl
        });
    } catch (error) {
        console.error('[Twitter] Post error:', error);

        // Handle specific Twitter API errors
        if (error.code === 401 || error.message?.includes('Not authenticated')) {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        }

        if (error.code === 403) {
            return res.status(403).json({ error: 'Permission denied. Check your Twitter app permissions.' });
        }

        if (error.code === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }

        res.status(500).json({ error: error.message || 'Failed to post tweet' });
    }
});

/**
 * POST /logout
 * Clear the session
 */
router.post('/logout', (req, res) => {
    try {
        const sessionId = req.headers['x-twitter-session'];

        if (sessionId) {
            clearSession(sessionId);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[Twitter] Logout error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
