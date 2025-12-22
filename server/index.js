import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import chatAgent from './agent/index.js';
import generationRoutes from './routes/generation.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Ensure library directories exist
const LIBRARY_DIR = path.join(__dirname, '..', 'library');
const WORKFLOWS_DIR = path.join(LIBRARY_DIR, 'workflows');
const IMAGES_DIR = path.join(LIBRARY_DIR, 'images');
const VIDEOS_DIR = path.join(LIBRARY_DIR, 'videos');
const CHATS_DIR = path.join(LIBRARY_DIR, 'chats');
const LIBRARY_ASSETS_DIR = path.join(LIBRARY_DIR, 'assets');

[LIBRARY_DIR, WORKFLOWS_DIR, IMAGES_DIR, VIDEOS_DIR, CHATS_DIR, LIBRARY_ASSETS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Enable CORS for all routes (must come before static file serving)
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Serve static assets from library with CORS headers for cross-origin image access
app.use('/library', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(LIBRARY_DIR));


const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("SERVER WARNING: GEMINI_API_KEY is not set in environment or .env file.");
}

const getClient = () => {
    return new GoogleGenAI({ apiKey: API_KEY || '' });
};

// ============================================================================
// KLING AI CONFIGURATION
// ============================================================================

const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY;
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY;
const KLING_BASE_URL = 'https://api-singapore.klingai.com';

if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
    console.warn("SERVER WARNING: KLING_ACCESS_KEY or KLING_SECRET_KEY not set. Kling AI models will not work.");
}

// ============================================================================
// HAILUO AI CONFIGURATION
// ============================================================================

const HAILUO_API_KEY = process.env.HAILUO_API_KEY;

if (!HAILUO_API_KEY) {
    console.warn("SERVER WARNING: HAILUO_API_KEY not set. Hailuo AI models will not work.");
}

// ============================================================================
// OPENAI GPT IMAGE CONFIGURATION
// ============================================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.warn("SERVER WARNING: OPENAI_API_KEY not set. OpenAI GPT Image models will not work.");
}

// ============================================================================
// FAL.AI CONFIGURATION (for Kling 2.6 Motion Control)
// ============================================================================

const FAL_API_KEY = process.env.FAL_API_KEY;

if (!FAL_API_KEY) {
    console.warn("SERVER WARNING: FAL_API_KEY not set. Kling 2.6 Motion Control will not work.");
}

// Set up app.locals for sharing config with route modules
app.locals.GEMINI_API_KEY = API_KEY;
app.locals.KLING_ACCESS_KEY = KLING_ACCESS_KEY;
app.locals.KLING_SECRET_KEY = KLING_SECRET_KEY;
app.locals.HAILUO_API_KEY = HAILUO_API_KEY;
app.locals.OPENAI_API_KEY = OPENAI_API_KEY;
app.locals.FAL_API_KEY = FAL_API_KEY;
app.locals.IMAGES_DIR = IMAGES_DIR;
app.locals.VIDEOS_DIR = VIDEOS_DIR;

// ============================================================================
// WORKFLOW SANITIZATION HELPERS
// ============================================================================

/**
 * Saves base64 data URL to a file and returns the file URL path.
 * @param {string} dataUrl - Base64 data URL (e.g., data:image/png;base64,...)
 * @returns {{ url: string } | null} - File URL path or null if not base64
 */
function saveBase64ToFile(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        return null;
    }

    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;

    const mimeType = matches[1];
    const base64Data = matches[2];

    try {
        const buffer = Buffer.from(base64Data, 'base64');
        const id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        let filename, targetDir, urlType;

        if (mimeType.startsWith('video/')) {
            filename = `${id}.mp4`;
            targetDir = VIDEOS_DIR;
            urlType = 'videos';
        } else {
            const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
            filename = `${id}.${ext}`;
            targetDir = IMAGES_DIR;
            urlType = 'images';
        }

        fs.writeFileSync(path.join(targetDir, filename), buffer);
        console.log(`  [Workflow Sanitize] Saved base64 → /library/${urlType}/${filename}`);

        return { url: `/library/${urlType}/${filename}` };
    } catch (err) {
        console.error('  [Workflow Sanitize] Failed to save base64:', err.message);
        return null;
    }
}

/**
 * Sanitizes workflow nodes by converting base64 data to file URLs.
 * Prevents large base64 strings from bloating workflow JSON files.
 * @param {Array} nodes - Array of workflow nodes
 * @returns {Array} - Sanitized nodes with file URLs instead of base64
 */
function sanitizeWorkflowNodes(nodes) {
    if (!nodes || !Array.isArray(nodes)) return nodes;

    let sanitizedCount = 0;

    const sanitized = nodes.map(node => {
        const cleanNode = { ...node };

        // Check resultUrl for base64 data
        if (cleanNode.resultUrl && cleanNode.resultUrl.startsWith('data:')) {
            const saved = saveBase64ToFile(cleanNode.resultUrl);
            if (saved) {
                cleanNode.resultUrl = saved.url;
                sanitizedCount++;
            }
        }

        // Check lastFrame for base64 data (video nodes)
        if (cleanNode.lastFrame && cleanNode.lastFrame.startsWith('data:')) {
            const saved = saveBase64ToFile(cleanNode.lastFrame);
            if (saved) {
                cleanNode.lastFrame = saved.url;
                sanitizedCount++;
            }
        }

        return cleanNode;
    });

    if (sanitizedCount > 0) {
        console.log(`[Workflow Sanitize] Converted ${sanitizedCount} base64 field(s) to file URLs`);
    }

    return sanitized;
}

// Mount generation routes (image and video generation)

app.use('/api', generationRoutes);

// NOTE: Old Kling helpers removed - now in server/services/kling.js

// --- Library Assets API ---

// Save curated asset to library
app.post('/api/library', async (req, res) => {
    try {
        const { sourceUrl, name, category, meta } = req.body;

        if (!sourceUrl || !name || !category) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Determine destination directory
        const destDir = path.join(LIBRARY_ASSETS_DIR, category);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        // Sanitize name for filesystem
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        let destFilename;
        let destPath;

        // HANDLE DATA URL (Base64)
        if (sourceUrl.startsWith('data:')) {
            const matches = sourceUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ error: 'Invalid data URL format' });
            }

            const mimeType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            // Determine extension from mime
            let ext = '.png';
            if (mimeType === 'image/jpeg') ext = '.jpg';
            else if (mimeType === 'video/mp4') ext = '.mp4';
            // Add more as needed

            destFilename = `${safeName}${ext}`;
            destPath = path.join(destDir, destFilename);

            fs.writeFileSync(destPath, buffer);
        }
        // HANDLE FILE PATH OR URL
        else {
            // Determine source file path
            let sourcePath = null;

            // Normalize URL: remove origin if present to get just the path
            let cleanUrl = sourceUrl;
            try {
                // If it's a full URL, extract pathname
                if (sourceUrl.startsWith('http')) {
                    const u = new URL(sourceUrl);
                    cleanUrl = u.pathname;
                }
            } catch (e) {
                // Not a valid URL, treat as path
                cleanUrl = sourceUrl.split('?')[0];
            }

            // Ensure cleanUrl starts with / if it doesn't (though URL.pathname does)
            if (!cleanUrl.startsWith('/')) cleanUrl = '/' + cleanUrl;

            // Handle URL decoding (e.g. %20 -> space)
            cleanUrl = decodeURIComponent(cleanUrl);

            if (cleanUrl.startsWith('/library/images/')) {
                sourcePath = path.join(IMAGES_DIR, cleanUrl.replace('/library/images/', ''));
            } else if (cleanUrl.startsWith('/library/videos/')) {
                sourcePath = path.join(VIDEOS_DIR, cleanUrl.replace('/library/videos/', ''));
            } else if (cleanUrl.startsWith('/assets/images/')) { // Legacy support
                sourcePath = path.join(IMAGES_DIR, cleanUrl.replace('/assets/images/', ''));
            } else if (cleanUrl.startsWith('/assets/videos/')) { // Legacy support
                sourcePath = path.join(VIDEOS_DIR, cleanUrl.replace('/assets/videos/', ''));
            }

            if (!sourcePath || !fs.existsSync(sourcePath)) {
                console.error(`Save asset failed: Source file not found. URL: ${sourceUrl}, Path: ${sourcePath}`);
                return res.status(404).json({ error: "Source file not found", debug: { sourceUrl, sourcePath, cleanUrl } });
            }

            // Copy file
            const ext = path.extname(sourcePath);
            destFilename = `${safeName}${ext}`;
            destPath = path.join(destDir, destFilename);

            fs.copyFileSync(sourcePath, destPath);
        }

        // Update assets.json
        const libraryJsonPath = path.join(LIBRARY_ASSETS_DIR, 'assets.json');
        let libraryData = [];
        if (fs.existsSync(libraryJsonPath)) {
            libraryData = JSON.parse(fs.readFileSync(libraryJsonPath, 'utf8'));
        }

        const newEntry = {
            id: crypto.randomUUID(),
            name: name,
            category: category,
            url: `/library/assets/${category}/${destFilename}`,
            type: sourceUrl.includes('video') || (sourceUrl.startsWith('data:video')) ? 'video' : 'image',
            createdAt: new Date().toISOString(),
            ...meta
        };

        libraryData.push(newEntry);
        fs.writeFileSync(libraryJsonPath, JSON.stringify(libraryData, null, 2));

        res.json({ success: true, asset: newEntry });
    } catch (error) {
        console.error("Save to library error:", error);
        res.status(500).json({ error: error.message });
    }
});

// List library assets
app.get('/api/library', async (req, res) => {
    try {
        const libraryJsonPath = path.join(LIBRARY_ASSETS_DIR, 'assets.json');
        if (!fs.existsSync(libraryJsonPath)) {
            return res.json([]);
        }
        const libraryData = JSON.parse(fs.readFileSync(libraryJsonPath, 'utf8'));
        // Sort newest first
        libraryData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(libraryData);
    } catch (error) {
        console.error("List library error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Delete library asset
app.delete('/api/library/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const libraryJsonPath = path.join(LIBRARY_ASSETS_DIR, 'assets.json');

        if (!fs.existsSync(libraryJsonPath)) {
            return res.status(404).json({ error: "Library not found" });
        }

        let libraryData = JSON.parse(fs.readFileSync(libraryJsonPath, 'utf8'));
        const assetIndex = libraryData.findIndex(a => a.id === id);

        if (assetIndex === -1) {
            return res.status(404).json({ error: "Asset not found" });
        }

        const asset = libraryData[assetIndex];

        // Delete the actual file if it exists in our assets folder
        // asset.url usually looks like /library/assets/Category/file.ext
        if (asset.url && asset.url.startsWith('/library/assets/')) {
            const relativePath = asset.url.replace('/library/assets/', '');
            const filePath = path.join(LIBRARY_ASSETS_DIR, relativePath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Remove from array
        libraryData.splice(assetIndex, 1);
        fs.writeFileSync(libraryJsonPath, JSON.stringify(libraryData, null, 2));

        res.json({ success: true });
    } catch (error) {
        console.error("Delete library asset error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Workflow API Routes ---

// Save/Update workflow
app.post('/api/workflows', async (req, res) => {
    try {
        const workflow = req.body;
        if (!workflow.id) {
            workflow.id = crypto.randomUUID();
        }
        workflow.updatedAt = new Date().toISOString();
        if (!workflow.createdAt) {
            workflow.createdAt = workflow.updatedAt;
        }


        const filePath = path.join(WORKFLOWS_DIR, `${workflow.id}.json`);

        // Preserve existing coverUrl if it exists
        if (fs.existsSync(filePath)) {
            try {
                const existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (existingData.coverUrl) {
                    workflow.coverUrl = existingData.coverUrl;
                }
            } catch (readError) {
                console.warn("Could not read existing workflow to preserve cover:", readError);
            }
        }

        // Sanitize nodes: convert any base64 data to file URLs before saving
        if (workflow.nodes) {
            workflow.nodes = sanitizeWorkflowNodes(workflow.nodes);
        }

        fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));


        res.json({ success: true, id: workflow.id });
    } catch (error) {
        console.error("Save workflow error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Public Workflows API (bundled examples) ---

// List public workflows (shipped with the repo in public/workflows/)
// Dynamically scans directory - no need to maintain index.json manually
app.get('/api/public-workflows', async (req, res) => {
    try {
        const publicWorkflowsDir = path.join(__dirname, '..', 'public', 'workflows');

        if (!fs.existsSync(publicWorkflowsDir)) {
            return res.json([]);
        }

        // Scan all .json files except index.json
        const files = fs.readdirSync(publicWorkflowsDir)
            .filter(f => f.endsWith('.json') && f !== 'index.json');

        const workflows = files.map(file => {
            try {
                const content = fs.readFileSync(path.join(publicWorkflowsDir, file), 'utf8');
                const workflow = JSON.parse(content);

                // Generate description from workflow content
                const nodeTypes = workflow.nodes?.reduce((acc, n) => {
                    acc[n.type] = (acc[n.type] || 0) + 1;
                    return acc;
                }, {}) || {};
                const typesSummary = Object.entries(nodeTypes)
                    .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
                    .join(', ');
                const description = workflow.description ||
                    (typesSummary ? `Workflow with ${typesSummary}` : 'A public workflow template');

                return {
                    id: file.replace('.json', ''),
                    title: workflow.title || 'Untitled Workflow',
                    description,
                    nodeCount: workflow.nodes?.length || 0,
                    coverUrl: workflow.coverUrl || null
                };
            } catch (parseError) {
                console.warn(`Skipping invalid workflow file: ${file}`, parseError.message);
                return null;
            }
        }).filter(Boolean); // Remove any null entries from parse errors

        // Sort by title alphabetically
        workflows.sort((a, b) => a.title.localeCompare(b.title));

        res.json(workflows);
    } catch (error) {
        console.error("List public workflows error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Load specific public workflow
app.get('/api/public-workflows/:id', async (req, res) => {
    try {
        const publicWorkflowsDir = path.join(__dirname, '..', 'public', 'workflows');
        const filePath = path.join(publicWorkflowsDir, `${req.params.id}.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Public workflow not found" });
        }

        const content = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(content));
    } catch (error) {
        console.error("Load public workflow error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- User Workflows API ---

// List all workflows
app.get('/api/workflows', async (req, res) => {
    try {
        const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
        const workflows = files.map(file => {
            const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');
            const workflow = JSON.parse(content);
            return {
                id: workflow.id,
                title: workflow.title,
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt,
                nodeCount: workflow.nodes?.length || 0,
                coverUrl: workflow.coverUrl
            };
        });
        workflows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        res.json(workflows);
    } catch (error) {
        console.error("List workflows error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Load specific workflow
app.get('/api/workflows/:id', async (req, res) => {
    try {
        const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Workflow not found" });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(content));
    } catch (error) {
        console.error("Load workflow error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Delete workflow
app.delete('/api/workflows/:id', async (req, res) => {
    try {
        const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Workflow not found" });
        }
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } catch (error) {
        console.error("Delete workflow error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update workflow cover
app.put('/api/workflows/:id/cover', async (req, res) => {
    try {
        const { coverUrl } = req.body;
        const filePath = path.join(WORKFLOWS_DIR, `${req.params.id}.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Workflow not found" });
        }

        const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        workflowData.coverUrl = coverUrl;
        fs.writeFileSync(filePath, JSON.stringify(workflowData, null, 2));

        res.json({ success: true, coverUrl });
    } catch (error) {
        console.error("Update cover error:", error);
        res.status(500).json({ error: error.message });
    }
});

// NOTE: Old generation routes removed - now in server/routes/generation.js


// ============================================================================
// ASSET HISTORY API
// ============================================================================

// Save an asset (image or video)
app.post('/api/assets/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { data, prompt } = req.body;

        if (!['images', 'videos'].includes(type)) {
            return res.status(400).json({ error: 'Invalid asset type' });
        }

        const targetDir = type === 'images' ? IMAGES_DIR : VIDEOS_DIR;
        const id = Date.now().toString();
        const ext = type === 'images' ? 'png' : 'mp4';
        const filename = `${id}.${ext}`;
        const metaFilename = `${id}.json`;

        // Save the asset file
        const base64Data = data.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(path.join(targetDir, filename), base64Data, 'base64');

        // Save metadata
        const metadata = {
            id,
            filename,
            prompt: prompt || '',
            createdAt: new Date().toISOString(),
            type
        };
        fs.writeFileSync(path.join(targetDir, metaFilename), JSON.stringify(metadata, null, 2));

        res.json({ success: true, id, filename, url: `/library/${type}/${filename}` });
    } catch (error) {
        console.error('Save asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// List all assets of a type
app.get('/api/assets/:type', async (req, res) => {
    try {
        const { type } = req.params;

        if (!['images', 'videos'].includes(type)) {
            return res.status(400).json({ error: 'Invalid asset type' });
        }

        const targetDir = type === 'images' ? IMAGES_DIR : VIDEOS_DIR;

        if (!fs.existsSync(targetDir)) {
            return res.json([]);
        }

        const files = fs.readdirSync(targetDir);
        const assets = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(path.join(targetDir, file), 'utf8');
                    const metadata = JSON.parse(content);
                    metadata.url = `/library/${type}/${metadata.filename}`;
                    assets.push(metadata);
                } catch (e) {
                    // Skip invalid JSON files
                }
            }
        }

        // Sort by createdAt descending (newest first)
        assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json(assets);
    } catch (error) {
        console.error('List assets error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete an asset
app.delete('/api/assets/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;

        if (!['images', 'videos'].includes(type)) {
            return res.status(400).json({ error: 'Invalid asset type' });
        }

        const targetDir = type === 'images' ? IMAGES_DIR : VIDEOS_DIR;
        const ext = type === 'images' ? 'png' : 'mp4';
        const assetPath = path.join(targetDir, `${id}.${ext}`);
        const metaPath = path.join(targetDir, `${id}.json`);

        if (fs.existsSync(assetPath)) fs.unlinkSync(assetPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete asset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// CHAT AGENT API
// NOTE: Currently using LangGraph.js. If more complex agent capabilities
// are needed (multi-agent, advanced tools), consider migrating to Python.
// ============================================================================

// Send a message to the chat agent
app.post('/api/chat', async (req, res) => {
    try {
        const { sessionId, message, media } = req.body;

        if (!API_KEY) {
            return res.status(500).json({ error: "Server missing API Key config" });
        }

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        if (!message && !media) {
            return res.status(400).json({ error: "message or media is required" });
        }

        const result = await chatAgent.sendMessage(sessionId, message, media, API_KEY);

        res.json({
            success: true,
            response: result.response,
            topic: result.topic,
            messageCount: result.messageCount
        });
    } catch (error) {
        console.error("Chat API Error:", error);
        res.status(500).json({ error: error.message || "Chat failed" });
    }
});

// List all chat sessions
app.get('/api/chat/sessions', async (req, res) => {
    try {
        const sessions = chatAgent.listSessions();
        res.json(sessions);
    } catch (error) {
        console.error("List sessions error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Delete a chat session
app.delete('/api/chat/sessions/:id', async (req, res) => {
    try {
        chatAgent.deleteSession(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error("Delete session error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Get full session data (for loading a specific chat)
app.get('/api/chat/sessions/:id', async (req, res) => {
    try {
        const sessionData = chatAgent.getSessionData(req.params.id);
        if (!sessionData) {
            return res.status(404).json({ error: "Session not found" });
        }
        res.json(sessionData);
    } catch (error) {
        console.error("Get session error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
