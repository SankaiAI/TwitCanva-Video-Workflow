/**
 * local-inference.js
 * 
 * Service for running inference with locally installed models.
 * Spawns Python subprocess to execute inference scripts.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION
// ============================================================================

// Get venv Python path
const VENV_PYTHON = process.platform === 'win32'
    ? path.join(process.cwd(), 'venv', 'Scripts', 'python.exe')
    : path.join(process.cwd(), 'venv', 'bin', 'python');

// Inference script path
const INFERENCE_SCRIPT = path.join(process.cwd(), 'scripts', 'inference.py');

// Output directory for generated images
const OUTPUT_DIR = path.join(process.cwd(), 'library', 'images');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the Python executable to use
 */
function getPythonPath() {
    if (fs.existsSync(VENV_PYTHON)) {
        return VENV_PYTHON;
    }
    // Fallback to system Python
    return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Generate a unique output filename
 */
function generateOutputPath(prefix = 'local') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return path.join(OUTPUT_DIR, `${prefix}_${timestamp}_${random}.png`);
}

/**
 * Parse aspect ratio string to width/height
 */
function parseAspectRatio(aspectRatio, baseSize = 512) {
    const ratios = {
        '1:1': { width: baseSize, height: baseSize },
        '16:9': { width: Math.round(baseSize * 16 / 9), height: baseSize },
        '9:16': { width: baseSize, height: Math.round(baseSize * 16 / 9) },
        '4:3': { width: Math.round(baseSize * 4 / 3), height: baseSize },
        '3:4': { width: baseSize, height: Math.round(baseSize * 4 / 3) },
        '3:2': { width: Math.round(baseSize * 3 / 2), height: baseSize },
        '2:3': { width: baseSize, height: Math.round(baseSize * 3 / 2) }
    };

    return ratios[aspectRatio] || ratios['1:1'];
}

// ============================================================================
// INFERENCE FUNCTIONS
// ============================================================================

/**
 * Run local model inference
 * 
 * @param {Object} params - Generation parameters
 * @param {string} params.modelPath - Absolute path to the model file
 * @param {string} params.prompt - Generation prompt
 * @param {string} params.negativePrompt - Negative prompt (optional)
 * @param {string} params.aspectRatio - Aspect ratio (e.g., '1:1', '16:9')
 * @param {string} params.resolution - Resolution preset ('512', '768', '1024')
 * @param {number} params.steps - Number of inference steps
 * @param {number} params.guidanceScale - CFG scale
 * @param {number} params.seed - Random seed (-1 for random)
 * @returns {Promise<{success: boolean, resultUrl?: string, error?: string}>}
 */
export async function runLocalInference(params) {
    const {
        modelPath,
        prompt,
        negativePrompt = '',
        aspectRatio = '1:1',
        resolution = '512',
        steps = 30,
        guidanceScale = 7.5,
        seed = -1
    } = params;

    // Validate model path
    if (!modelPath || !fs.existsSync(modelPath)) {
        return {
            success: false,
            error: `Model file not found: ${modelPath}`
        };
    }

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Calculate dimensions
    const baseSize = parseInt(resolution) || 512;
    const { width, height } = parseAspectRatio(aspectRatio, baseSize);

    // Generate output path
    const outputPath = generateOutputPath('local');

    // Get Python executable
    const pythonPath = getPythonPath();

    console.log(`[Local Inference] Starting generation...`);
    console.log(`[Local Inference] Model: ${path.basename(modelPath)}`);
    console.log(`[Local Inference] Size: ${width}x${height}, Steps: ${steps}`);
    console.log(`[Local Inference] Python: ${pythonPath}`);

    return new Promise((resolve) => {
        const args = [
            INFERENCE_SCRIPT,
            '--model_path', modelPath,
            '--prompt', prompt,
            '--output', outputPath,
            '--negative_prompt', negativePrompt,
            '--width', String(width),
            '--height', String(height),
            '--steps', String(steps),
            '--guidance_scale', String(guidanceScale),
            '--seed', String(seed)
        ];

        const process = spawn(pythonPath, args, {
            cwd: path.dirname(INFERENCE_SCRIPT)
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
            // Log progress to console
            console.log(`[Local Inference] ${data.toString().trim()}`);
        });

        process.on('close', (code) => {
            if (code === 0) {
                try {
                    // Parse JSON output from script
                    const result = JSON.parse(stdout.trim());

                    if (result.success) {
                        // Convert file path to URL
                        const filename = path.basename(result.output_path);
                        const resultUrl = `/library/images/${filename}`;

                        console.log(`[Local Inference] Success! Output: ${resultUrl}`);

                        resolve({
                            success: true,
                            resultUrl,
                            modelType: result.model_type,
                            device: result.device
                        });
                    } else {
                        console.error(`[Local Inference] Script error: ${result.error}`);
                        resolve({
                            success: false,
                            error: result.error
                        });
                    }
                } catch (parseError) {
                    console.error(`[Local Inference] Failed to parse output: ${stdout}`);
                    resolve({
                        success: false,
                        error: `Failed to parse inference output: ${parseError.message}`
                    });
                }
            } else {
                console.error(`[Local Inference] Process exited with code ${code}`);
                console.error(`[Local Inference] stderr: ${stderr}`);

                // Try to extract error message from stderr or stdout
                let errorMessage = 'Inference process failed';
                try {
                    const result = JSON.parse(stdout.trim());
                    if (result.error) errorMessage = result.error;
                } catch {
                    if (stderr.includes('CUDA out of memory')) {
                        errorMessage = 'GPU out of memory. Try a smaller resolution or close other applications.';
                    } else if (stderr.includes('No module')) {
                        errorMessage = 'Missing Python dependency. Run: npm run setup:local-models';
                    } else if (stderr) {
                        errorMessage = stderr.split('\n').pop() || stderr;
                    }
                }

                resolve({
                    success: false,
                    error: errorMessage
                });
            }
        });

        process.on('error', (err) => {
            console.error(`[Local Inference] Failed to start process: ${err.message}`);
            resolve({
                success: false,
                error: `Failed to start Python process: ${err.message}`
            });
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            process.kill();
            resolve({
                success: false,
                error: 'Inference timed out after 5 minutes'
            });
        }, 5 * 60 * 1000);
    });
}

/**
 * Check if local inference is available
 */
export async function checkInferenceAvailable() {
    const pythonPath = getPythonPath();

    // Check if Python is available
    if (!fs.existsSync(pythonPath) && pythonPath.includes('venv')) {
        return {
            available: false,
            error: 'Python venv not set up. Run: npm run setup:local-models'
        };
    }

    // Check if inference script exists
    if (!fs.existsSync(INFERENCE_SCRIPT)) {
        return {
            available: false,
            error: 'Inference script not found'
        };
    }

    return {
        available: true,
        pythonPath
    };
}
