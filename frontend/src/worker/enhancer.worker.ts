import type { ClientMessage, WorkerMessage } from '../types/index.ts';
import { decodeToImageData } from './decoder.ts';
import { processImagePipeline } from './pipeline.ts';

const activeTasks = new Map<string, AbortController>();

self.onmessage = async (event: MessageEvent<ClientMessage>) => {
    const { type, id, file } = event.data;

    switch (type) {
        case 'CONVERT_HEIC': {
            try {
                const imageData = await decodeToImageData(file, new AbortController().signal, () => { });

                const canvas = new OffscreenCanvas(imageData.width, imageData.height);
                const ctx = canvas.getContext('2d')!;
                ctx.putImageData(imageData, 0, 0);

                const pngBlob = await canvas.convertToBlob({ type: 'image/png' });

                self.postMessage({ type: 'HEIC_CONVERTED', id, blob: pngBlob });

                canvas.width = 0;
                canvas.height = 0;
            } catch (err: any) {
                self.postMessage({ type: 'HEIC_CONVERSION_FAILED', id, error: err.message });
            }
            break;
        }

        case 'START_TASK': {
            if (!file) {
                sendErrorMessage(id, 'Файл изображения не передан или поврежден.');
                return;
            }

            if (activeTasks.has(id)) {
                activeTasks.get(id)?.abort();
                activeTasks.delete(id);
            }

            const controller = new AbortController();
            activeTasks.set(id, controller);

            try {
                await processImagePipeline(id, file, controller.signal, (status, progress, blob) => {

                    if (status === 'completed' && blob) {
                        const successMessage: WorkerMessage = {
                            type: 'TASK_COMPLETED',
                            id,
                            status,
                            progress: 100,
                            blob
                        };
                        self.postMessage(successMessage);
                    } else {
                        const progressMessage: WorkerMessage = {
                            type: 'STATUS_CHANGED',
                            id,
                            status,
                            progress
                        };
                        self.postMessage(progressMessage);
                    }
                });
            } catch (error: any) {
                if (error.name === 'AbortError' || controller.signal.aborted) {
                    return;
                }

                sendErrorMessage(id, error.message || 'Внутренняя ошибка конвейера Zero-DCE.');
            } finally {
                activeTasks.delete(id);
            }
            break;
        }

        case 'CANCEL_TASK': {
            const controller = activeTasks.get(id);
            if (controller) {
                controller.abort();
                activeTasks.delete(id);
            }
            break;
        }
    }
};

function sendErrorMessage(id: string, message: string): void {
    const errorMessage: WorkerMessage = {
        type: 'TASK_FAILED',
        id,
        status: 'failed',
        progress: 0,
        error: message
    };
    self.postMessage(errorMessage);
}