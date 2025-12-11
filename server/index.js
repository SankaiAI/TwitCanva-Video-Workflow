import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3001;

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

// --- Routes ---

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt, aspectRatio, resolution } = req.body;

        if (!API_KEY) {
            return res.status(500).json({ error: "Server missing API Key config" });
        }

        const ai = getClient();
        const model = 'gemini-2.5-flash-image-preview';
        const modelName = 'gemini-2.5-flash-image-preview';

        const apiRatio = mapAspectRatio(aspectRatio);

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: apiRatio,
                    imageSize: resolution === "4K" ? "4K" : "1K"
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return res.json({ resultUrl: `data:image/png;base64,${part.inlineData.data}` });
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

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("No video URI returned.");
        }

        // Server-side fetch to mask the key
        const videoRes = await fetch(`${downloadLink}&key=${API_KEY}`);
        const arrayBuffer = await videoRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Video = buffer.toString('base64');

        // Return base64 video directly to avoid complex streaming for now
        // Or return the proxied blob url? 
        // Ideally we stream it. But for simplicity let's return data URI or a binary response.
        // Client expects a blob URL. We can send base64 and client converts to blob.

        return res.json({ resultUrl: `data:video/mp4;base64,${base64Video}` });

    } catch (error) {
        console.error("Server Video Gen Error:", error);
        res.status(500).json({ error: error.message || "Video generation failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
