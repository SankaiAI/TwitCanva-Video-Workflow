import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Ensure assets/workflows directory exists
const WORKFLOWS_DIR = path.join(__dirname, '..', 'assets', 'workflows');
if (!fs.existsSync(WORKFLOWS_DIR)) {
    fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.warn("SERVER WARNING: GEMINI_API_KEY is not set in environment or .env file.");
}

const getClient = () => {
    return new GoogleGenAI({ apiKey: API_KEY || '' });
};

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
                nodeCount: workflow.nodes?.length || 0
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

// --- Image/Video Generation Routes ---

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, aspectRatio, resolution, imageBase64 } = req.body;

        if (!API_KEY) {
            return res.status(500).json({ error: "Server missing API Key config" });
        }

        const ai = getClient();
        const modelName = 'gemini-3-pro-image-preview';

        const apiRatio = mapAspectRatio(aspectRatio);

        const parts = [];

        if (imageBase64) {
            const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64];

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
                    return res.json({ resultUrl: `data:image/png;base64,${part.inlineData.data}` });
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
        const { prompt, imageBase64, aspectRatio, resolution } = req.body;

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

        const args = {
            model: model,
            prompt: prompt || "A cinematic video",
            config: videoConfig
        };

        if (imageBase64) {
            const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            args.image = {
                imageBytes: base64Clean,
                mimeType: 'image/png'
            };
        }

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
        const base64Video = buffer.toString('base64');

        return res.json({ resultUrl: `data:video/mp4;base64,${base64Video}` });

    } catch (error) {
        console.error("Server Video Gen Error:", error);
        res.status(500).json({ error: error.message || "Video generation failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
