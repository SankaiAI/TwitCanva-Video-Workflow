import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatAgent from './agent/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Ensure assets directories exist
const WORKFLOWS_DIR = path.join(__dirname, '..', 'assets', 'workflows');
const IMAGES_DIR = path.join(__dirname, '..', 'assets', 'images');
const VIDEOS_DIR = path.join(__dirname, '..', 'assets', 'videos');

[WORKFLOWS_DIR, IMAGES_DIR, VIDEOS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Serve static assets
app.use('/assets/images', express.static(IMAGES_DIR));
app.use('/assets/videos', express.static(VIDEOS_DIR));

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("SERVER WARNING: GEMINI_API_KEY is not set in environment or .env file.");
}

const getClient = () => {
    return new GoogleGenAI({ apiKey: API_KEY || '' });
};

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

// --- Helper Functions ---

const mapAspectRatio = (ratio) => {
    if (!ratio || ratio === 'Auto') return "1:1";
    switch (ratio) {
        case "1:1": return "1:1";
        case "3:4": return "3:4";
        case "4:3": return "4:3";
        case "9:16": return "9:16";
        case "16:9": return "16:9";
        case "3:2": return "4:3";
        case "2:3": return "3:4";
        case "5:4": return "4:3";
        case "4:5": return "3:4";
        case "21:9": return "16:9";
        default: return "1:1";
    }
};

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
        fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));

        res.json({ success: true, id: workflow.id });
    } catch (error) {
        console.error("Save workflow error:", error);
        res.status(500).json({ error: error.message });
    }
});

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

// --- Image/Video Generation Routes ---

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, aspectRatio, resolution, imageBase64: rawImageBase64 } = req.body;

        if (!API_KEY) {
            return res.status(500).json({ error: "Server missing API Key config" });
        }

        const ai = getClient();
        const modelName = 'gemini-3-pro-image-preview';

        const apiRatio = mapAspectRatio(aspectRatio);

        const parts = [];

        if (rawImageBase64) {
            const rawImages = Array.isArray(rawImageBase64) ? rawImageBase64 : [rawImageBase64];
            // Resolve each image to base64 (handles file URLs)
            const images = rawImages.map(img => resolveImageToBase64(img)).filter(Boolean);

            for (const img of images) {
                const match = img.match(/^data:(image\/\w+);base64,/);
                const mimeType = match ? match[1] : "image/png";
                const base64Clean = img.replace(/^data:image\/\w+;base64,/, "");
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Clean
                    }
                });
            }
        }

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: parts
            },
            config: {
                responseModalities: ["TEXT", "IMAGE"],
                temperature: 1.0,
            }
        });

        const candidates = response.candidates || [];
        if (candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    // Save image to file instead of returning base64
                    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const imagePath = path.join(IMAGES_DIR, `${imageId}.png`);
                    const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
                    fs.writeFileSync(imagePath, imageBuffer);

                    // Return URL to the saved file
                    const imageUrl = `/assets/images/${imageId}.png`;
                    console.log(`Image saved: ${imageUrl}`);
                    return res.json({ resultUrl: imageUrl });
                }
            }
        }

        throw new Error("No image data returned from provider");

    } catch (error) {
        console.error("Server Image Gen Error:", error);
        res.status(500).json({ error: error.message || "Image generation failed" });
    }
});

app.post('/api/generate-video', async (req, res) => {
    try {
        const { prompt, imageBase64: rawImageBase64, lastFrameBase64: rawLastFrameBase64, aspectRatio, resolution } = req.body;

        // Resolve file URLs to base64 if needed
        const imageBase64 = resolveImageToBase64(rawImageBase64);
        const lastFrameBase64 = resolveImageToBase64(rawLastFrameBase64);

        if (!API_KEY) {
            return res.status(500).json({ error: "Server missing API Key config" });
        }

        const ai = getClient();
        const model = 'veo-3.1-fast-generate-preview';

        let apiResolution = '720p';
        if (resolution === '1080p') apiResolution = '1080p';

        const apiAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

        const videoConfig = {
            numberOfVideos: 1,
            resolution: apiResolution,
            aspectRatio: apiAspectRatio
        };

        // Add last_frame for frame-to-frame interpolation (Veo 3.1 feature)
        if (lastFrameBase64) {
            const lastMatch = lastFrameBase64.match(/^data:(image\/\w+);base64,/);
            let lastMimeType = lastMatch ? lastMatch[1] : 'image/jpeg';
            const lastBase64Clean = lastFrameBase64.replace(/^data:image\/\w+;base64,/, "");

            if (lastMimeType === 'image/png' || lastMimeType === 'image/webp') {
                lastMimeType = 'image/jpeg';
            }

            videoConfig.lastFrame = {
                imageBytes: lastBase64Clean,
                mimeType: lastMimeType
            };
            console.log(`Video Gen: Using last_frame with mimeType: ${lastMimeType}, base64 length: ${lastBase64Clean.length}`);
        }

        const args = {
            model: model,
            prompt: prompt || "A cinematic video",
            config: videoConfig
        };

        if (imageBase64) {
            // Extract MIME type from data URL or default to jpeg (more compatible)
            const match = imageBase64.match(/^data:(image\/\w+);base64,/);
            let mimeType = match ? match[1] : 'image/jpeg';
            const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");

            // Log for debugging
            console.log(`Video Gen: Using image with mimeType: ${mimeType}, base64 length: ${base64Clean.length}`);

            // Veo requires specific format - use image/jpeg for best compatibility
            if (mimeType === 'image/png' || mimeType === 'image/webp') {
                mimeType = 'image/jpeg';
            }

            args.image = {
                imageBytes: base64Clean,
                mimeType: mimeType
            };
        }

        console.log('Calling Veo API with args:', { ...args, image: args.image ? { mimeType: args.image.mimeType, length: args.image.imageBytes?.length } : undefined });

        let operation = await ai.models.generateVideos(args);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("No video URI returned.");
        }

        const videoRes = await fetch(`${downloadLink}&key=${API_KEY}`);
        const arrayBuffer = await videoRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Save video to file instead of returning base64
        const videoId = `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const videoPath = path.join(VIDEOS_DIR, `${videoId}.mp4`);
        fs.writeFileSync(videoPath, buffer);

        // Return URL to the saved file
        const videoUrl = `/assets/videos/${videoId}.mp4`;
        console.log(`Video saved: ${videoUrl}`);
        return res.json({ resultUrl: videoUrl });

    } catch (error) {
        console.error("Server Video Gen Error:", error);
        res.status(500).json({ error: error.message || "Video generation failed" });
    }
});

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

        res.json({ success: true, id, filename, url: `/assets/${type}/${filename}` });
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
                    metadata.url = `/assets/${type}/${metadata.filename}`;
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
