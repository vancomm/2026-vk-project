import * as ort from 'onnxruntime-web';
import type { ZeroDCEParameters } from '../types/index.ts';

const model = 'zero_dce.onnx';
const baseUrl = typeof self !== 'undefined' && self.location ? self.location.origin : '';

const globalOrt = ort as any;
if (!globalOrt.env) {
    globalOrt.env = {};
}
if (!globalOrt.env.wasm) {
    globalOrt.env.wasm = {};
}

globalOrt.env.wasm.wasmPaths = baseUrl + '/models/';

globalOrt.env.wasm.numThreads = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));

let inferenceSessionCache: ort.InferenceSession | null = null;

async function getSession(signal: AbortSignal): Promise<ort.InferenceSession> {
    if (inferenceSessionCache) {
        return inferenceSessionCache;
    }

    if (signal.aborted) {
        throw new DOMException('Инициализация ИИ прервана.', 'AbortError');
    }

    try {
        const sessionOptions: ort.InferenceSession.SessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        };

        inferenceSessionCache = await ort.InferenceSession.create(`/models/${model}`, sessionOptions);
        return inferenceSessionCache;
    } catch (error: any) {
        throw new Error(`Не удалось загрузить нейросеть ONNX: ${error?.message || error}`);
    }
}

export async function runInference(
    imageData: ImageData,
    signal: AbortSignal
): Promise<ZeroDCEParameters> {

    if (signal.aborted) {
        throw new DOMException('Анализ ИИ прерван.', 'AbortError');
    }

    const session = await getSession(signal);

    const TARGET_SIZE = 256;
    const resizedBuffer = resizeImageData(imageData, TARGET_SIZE, TARGET_SIZE);

    if (signal.aborted) {
        throw new DOMException('Анализ ИИ прерван на этапе масштабирования.', 'AbortError');
    }

    const totalPixels = TARGET_SIZE * TARGET_SIZE;

    const tensorData = new Float32Array(1 * 3 * totalPixels);

    for (let i = 0; i < totalPixels; i++) {
        const r = resizedBuffer[i * 4 + 0] / 255.0;
        const g = resizedBuffer[i * 4 + 1] / 255.0;
        const b = resizedBuffer[i * 4 + 2] / 255.0;

        tensorData[i] = r;
        tensorData[totalPixels + i] = g;
        tensorData[totalPixels * 2 + i] = b;
    }

    const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, TARGET_SIZE, TARGET_SIZE]);

    const feeds: Record<string, ort.Tensor> = { ['input_image']: inputTensor };

    const outputs = await session.run(feeds);

    const curvesTensor = outputs['curves'];
    if (!curvesTensor) {
        throw new Error("Выходной тензор 'curves' не обнаружен в ONNX-модели.");
    }

    const curvesData = curvesTensor.data as Float32Array;

    return {
        curvesData: curvesData
    };
}

function resizeImageData(source: ImageData, targetWidth: number, targetHeight: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    const xRatio = source.width / targetWidth;
    const yRatio = source.height / targetHeight;

    for (let cy = 0; cy < targetHeight; cy++) {
        for (let cx = 0; cx < targetWidth; cx++) {
            const px = Math.floor(cx * xRatio);
            const py = Math.floor(cy * yRatio);

            const sourceIndex = (py * source.width + px) * 4;
            const targetIndex = (cy * targetWidth + cx) * 4;

            result[targetIndex + 0] = source.data[sourceIndex + 0]; // R
            result[targetIndex + 1] = source.data[sourceIndex + 1]; // G
            result[targetIndex + 2] = source.data[sourceIndex + 2]; // B
            result[targetIndex + 3] = source.data[sourceIndex + 3]; // A
        }
    }

    return result;
}