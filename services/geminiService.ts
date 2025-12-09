import { GoogleGenAI } from "@google/genai";

// Initialize the client
// Ideally this should be handled with a context or hook if keys change, but for this demo process.env is assumed
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing from environment");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
}

export interface GenerateVideoParams {
  prompt: string;
  imageBase64?: string; // For Image-to-Video
  aspectRatio?: string;
  resolution?: string; // Add resolution to params
}

// Helper to map UI ratios to API supported ratios
const mapAspectRatio = (ratio?: string): string => {
  if (!ratio || ratio === 'Auto') return "1:1";
  
  // Supported: "1:1", "3:4", "4:3", "9:16", "16:9"
  switch (ratio) {
    case "1:1": return "1:1";
    case "3:4": return "3:4";
    case "4:3": return "4:3";
    case "9:16": return "9:16";
    case "16:9": return "16:9";
    
    // Mappings for unsupported UI options
    case "3:2": return "4:3";  // Closest landscape
    case "2:3": return "3:4";  // Closest portrait
    case "5:4": return "4:3";  // Closest
    case "4:5": return "3:4";  // Closest
    case "21:9": return "16:9"; // Ultrawide -> Wide
    default: return "1:1";
  }
};

/**
 * Generates an image using Gemini 3 Pro Image Preview (Banana Pro)
 */
export const generateImage = async (params: GenerateImageParams): Promise<string> => {
  const ai = getClient();
  const model = 'gemini-3-pro-image-preview'; // "Banana Pro"

  try {
    const apiRatio = mapAspectRatio(params.aspectRatio);

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: params.prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: apiRatio,
          imageSize: params.resolution === "4K" ? "4K" : "1K"
        }
      }
    });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned in response");

  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

/**
 * Generates a video using Veo (Video Generation)
 * Supports Text-to-Video or Image-to-Video
 */
export const generateVideo = async (params: GenerateVideoParams): Promise<string> => {
  const ai = getClient();
  // Using Veo fast for quicker results in a UI demo context
  const model = 'veo-3.1-fast-generate-preview'; 

  try {
    // Map resolution: Veo supports '720p' or '1080p'.
    // UI has '512p' -> map to '720p'. 'Auto' -> '720p'.
    let apiResolution = '720p';
    if (params.resolution === '1080p') apiResolution = '1080p';
    
    // Video aspect ratio defaults to 16:9 if not specified, but logic remains similar
    const apiAspectRatio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    const videoConfig: any = {
      numberOfVideos: 1,
      resolution: apiResolution,
      aspectRatio: apiAspectRatio
    };
    
    // Construct payload
    const args: any = {
      model: model,
      prompt: params.prompt || "A cinematic video",
      config: videoConfig
    };

    if (params.imageBase64) {
      // Image to Video
      // Strip prefix if present for raw bytes
      const base64Clean = params.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      
      args.image = {
        imageBytes: base64Clean,
        mimeType: 'image/png' // Assuming PNG from previous step
      };
    }

    let operation = await ai.models.generateVideos(args);

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!downloadLink) {
        throw new Error("No video URI returned.");
    }
    
    // In a real browser app, we can't easily fetch the binary via fetch() with the key appended 
    // without potentially exposing it or running into CORS if not configured.
    // However, the instructions say: "The response.body contains the MP4 bytes. You must append an API key..."
    // For a React UI, we often want a displayable URL.
    // We will fetch it and convert to Blob URL for display.
    
    const apiKey = process.env.API_KEY;
    const videoRes = await fetch(`${downloadLink}&key=${apiKey}`);
    const videoBlob = await videoRes.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error) {
    console.error("Gemini Video Gen Error:", error);
    throw error;
  }
};