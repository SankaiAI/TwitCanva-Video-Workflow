/**
 * localModelService.ts
 * 
 * Frontend service for discovering and managing locally installed AI models.
 * Communicates with backend API to scan model directories and get GPU info.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Represents a locally installed AI model
 */
export interface LocalModel {
    id: string;              // Unique identifier (based on file path hash)
    name: string;            // Display name (derived from filename)
    path: string;            // Absolute path to model file
    type: 'image' | 'video' | 'lora' | 'controlnet';
    size: number;            // File size in bytes
    sizeFormatted: string;   // Human-readable size (e.g., "2.5 GB")
    architecture?: string;   // Model architecture (e.g., 'sd15', 'sdxl', 'qwen')
    lastModified: string;    // ISO date string
}

/**
 * GPU information for hardware warnings
 */
export interface GpuInfo {
    available: boolean;
    name?: string;
    vramTotal?: number;      // VRAM in bytes
    vramFree?: number;       // Free VRAM in bytes
    cudaVersion?: string;
    sufficient: boolean;     // Whether GPU meets minimum requirements
    warning?: string;        // Warning message if GPU is insufficient
}

/**
 * Model directory configuration
 */
export interface ModelDirectories {
    checkpoints: string;
    loras: string;
    controlnet: string;
    video: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetches all locally installed models
 * @returns Promise<LocalModel[]> Array of discovered models
 */
export const getLocalModels = async (): Promise<LocalModel[]> => {
    try {
        const response = await fetch('/api/local-models');
        if (!response.ok) {
            throw new Error(`Failed to fetch local models: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching local models:', error);
        return [];
    }
};

/**
 * Fetches models filtered by type
 * @param type - The type of models to fetch
 * @returns Promise<LocalModel[]> Filtered array of models
 */
export const getLocalModelsByType = async (
    type: LocalModel['type']
): Promise<LocalModel[]> => {
    try {
        const response = await fetch(`/api/local-models?type=${type}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch local models: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching local models by type:', error);
        return [];
    }
};

/**
 * Fetches detailed info about a specific model
 * @param modelId - The model ID to get info for
 * @returns Promise<LocalModel | null> Model info or null if not found
 */
export const getModelInfo = async (modelId: string): Promise<LocalModel | null> => {
    try {
        const response = await fetch(`/api/local-models/${modelId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Failed to fetch model info: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching model info:', error);
        return null;
    }
};

/**
 * Fetches GPU information for hardware detection
 * @returns Promise<GpuInfo> GPU availability and capabilities
 */
export const getGpuInfo = async (): Promise<GpuInfo> => {
    try {
        const response = await fetch('/api/local-models/gpu');
        if (!response.ok) {
            throw new Error(`Failed to fetch GPU info: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching GPU info:', error);
        return {
            available: false,
            sufficient: false,
            warning: 'Unable to detect GPU. Local model inference may not work.'
        };
    }
};

/**
 * Refreshes the model cache (rescans directories)
 * @returns Promise<LocalModel[]> Updated array of models
 */
export const refreshLocalModels = async (): Promise<LocalModel[]> => {
    try {
        const response = await fetch('/api/local-models/refresh', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`Failed to refresh models: ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error('Error refreshing local models:', error);
        return [];
    }
};

/**
 * Model registry configuration
 */
export interface ModelRegistry {
    version: string;
    architectures: Record<string, ArchitectureConfig>;
    defaultArchitecture: string;
    detectionOrder: string[];
}

export interface ArchitectureConfig {
    name: string;
    pipeline: string;
    type: 'image' | 'video';
    supported: boolean;
    defaults: {
        steps?: number;
        guidance?: number;
        width?: number;
        height?: number;
        scheduler?: string;
    };
    resolutions?: Record<string, [number, number]>;
    note?: string;
}

/**
 * Fetches the full model registry
 * @returns Promise<ModelRegistry | null> Registry config or null if not available
 */
export const getModelRegistry = async (): Promise<ModelRegistry | null> => {
    try {
        const response = await fetch('/api/local-models/registry');
        if (!response.ok) {
            return null;
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching model registry:', error);
        return null;
    }
};

/**
 * Fetches configuration for a specific architecture
 * @param key - Architecture key (e.g., 'sd15', 'sdxl')
 * @returns Promise<ArchitectureConfig | null> Architecture config or null
 */
export const getArchitectureConfig = async (key: string): Promise<ArchitectureConfig | null> => {
    try {
        const response = await fetch(`/api/local-models/architecture/${key}`);
        if (!response.ok) {
            return null;
        }
        return response.json();
    } catch (error) {
        console.error(`Error fetching architecture ${key}:`, error);
        return null;
    }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats file size to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 GB")
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Gets a user-friendly model type label
 * @param type - The model type
 * @returns Display label
 */
export const getModelTypeLabel = (type: LocalModel['type']): string => {
    const labels: Record<LocalModel['type'], string> = {
        'image': 'Image Generation',
        'video': 'Video Generation',
        'lora': 'LoRA Adapter',
        'controlnet': 'ControlNet'
    };
    return labels[type] || type;
};

/**
 * Checks if a model meets minimum VRAM requirements
 * @param model - The model to check
 * @param availableVram - Available VRAM in bytes
 * @returns Whether the model can run
 */
export const canRunModel = (model: LocalModel, availableVram: number): boolean => {
    // Rough VRAM requirements by architecture
    const vramRequirements: Record<string, number> = {
        'sd15': 4 * 1024 * 1024 * 1024,      // 4 GB
        'sdxl': 8 * 1024 * 1024 * 1024,      // 8 GB
        'qwen': 12 * 1024 * 1024 * 1024,     // 12 GB
        'default': 6 * 1024 * 1024 * 1024    // 6 GB default
    };

    const required = vramRequirements[model.architecture || 'default'] || vramRequirements['default'];
    return availableVram >= required;
};

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate image params for local model
 */
export interface GenerateLocalImageParams {
    modelId?: string;
    modelPath?: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: string;
    resolution?: string;
    steps?: number;
    guidanceScale?: number;
    seed?: number;
}

/**
 * Generate an image using a local model
 * @param params - Generation parameters
 * @returns Promise<{success: boolean, resultUrl?: string, error?: string}>
 */
export const generateLocalImage = async (params: GenerateLocalImageParams): Promise<{
    success: boolean;
    resultUrl?: string;
    error?: string;
    modelType?: string;
    device?: string;
}> => {
    try {
        const response = await fetch('/api/local-models/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error generating with local model:', error);
        return {
            success: false,
            error: (error as Error).message || 'Failed to generate image'
        };
    }
};
