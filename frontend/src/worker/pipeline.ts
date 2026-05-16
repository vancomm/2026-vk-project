import type { EnhancementSettings, TaskStatus } from '../types/index.ts';
import { decodeToImageData } from './decoder.ts';
import { runInference } from '../ml/inference.ts';
import { applyWebGLFilters } from '../graphics/WebGLRenderer.ts';

export async function processImagePipeline(
    id: string,
    file: File | Blob,
    signal: AbortSignal,
    onProgress: (status: TaskStatus, progress: number, blob?: Blob) => void
): Promise<void> {

    const throwIfAborted = () => {
        if (signal.aborted) {
            const abortError = new Error(`Задача ${id} была прервана пользователем.`);
            abortError.name = 'AbortError';
            throw abortError;
        }
    };

    onProgress('decoding', 10);
    const imageData = await decodeToImageData(file, signal, (innerProgress) => {
        onProgress('decoding', Math.floor(10 + (innerProgress * 0.2)));
    });
    throwIfAborted();
    onProgress('decoding', 30);

    onProgress('analyzing', 35);
    const zeroDCEParams = await runInference(imageData, signal);
    throwIfAborted();
    onProgress('analyzing', 60);

    onProgress('processing', 65);
    const avgBrightness = analyzeImageBrightness(imageData);
    const adaptiveDceStrength = Math.max(0.0, Math.min(1.0, 1.0 - (avgBrightness * 1.5)));
    const settings: EnhancementSettings = {
        dceStrength: adaptiveDceStrength,
        brightness: 0.0,
        contrast: 1.05,
        saturation: 1.1
    };
    const enhancedBlob = await applyWebGLFilters(imageData, zeroDCEParams, settings, signal);
    throwIfAborted();
    onProgress('processing', 90);

    onProgress('completed', 100, enhancedBlob);
}


function analyzeImageBrightness(imageData: ImageData): number {
    const data = imageData.data;
    let totalLuminance = 0;
    const step = 4 * 20;
    let sampleCount = 0;

    for (let i = 0; i < data.length; i += step) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sampleCount++;
    }

    return totalLuminance / sampleCount;
}