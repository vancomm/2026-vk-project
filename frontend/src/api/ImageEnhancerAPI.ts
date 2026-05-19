import type { TaskProgress, WorkerMessage, ClientMessage } from '../types/index.ts';
import EnhancerWorker from '../worker/enhancer.worker.ts?worker'

export class ImageEnhancerAPI {
    private worker: Worker;

    private tasksState: Map<string, TaskProgress> = new Map();

    private statusListeners: Map<string, Set<(progress: TaskProgress) => void>> = new Map();

    private resultResolvers: Map<string, { resolve: (blob: Blob) => void; reject: (err: Error) => void }> = new Map();

    private conversionResolvers: Map<string, { resolve: (blob: Blob) => void; reject: (err: Error) => void }> = new Map();

    constructor() {
        this.worker = new EnhancerWorker();
        this.worker.onmessage = this.handleWorkerMessage.bind(this);
    }

    public convertHeicToPngBlob(file: File | Blob): Promise<Blob> {
        const id = `heic_conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return new Promise<Blob>((resolve, reject) => {
            this.conversionResolvers.set(id, { resolve, reject });

            const message: ClientMessage = { type: 'CONVERT_HEIC', id, file };
            this.worker.postMessage(message);
        });
    }

    public startEnhancementTask(taskId: string, file: File | Blob): void {
        const initialProgress: TaskProgress = {
            id: taskId,
            status: 'pending',
            progress: 0
        };
        this.tasksState.set(taskId, initialProgress);

        const message: ClientMessage = { type: 'START_TASK', id: taskId, file };
        this.worker.postMessage(message);
    }

    public getResultImage(taskId: string): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            const currentState = this.tasksState.get(taskId);
            if (currentState && currentState.status === 'failed') {
                reject(new Error(currentState.error || 'Ошибка на этапе инициализации задачи.'));
                return;
            }

            this.resultResolvers.set(taskId, { resolve, reject });
        });
    }

    public getStatus(taskId: string): TaskProgress | null {
        return this.tasksState.get(taskId) || null;
    }

    public onStatusChange(taskId: string, callback: (progress: TaskProgress) => void): () => void {
        if (!this.statusListeners.has(taskId)) {
            this.statusListeners.set(taskId, new Set());
        }

        this.statusListeners.get(taskId)!.add(callback);

        return () => {
            const listeners = this.statusListeners.get(taskId);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    this.statusListeners.delete(taskId);
                }
            }
        };
    }


    public cancelTask(taskId: string): void {
        const message: ClientMessage = { type: 'CANCEL_TASK', id: taskId };
        this.worker.postMessage(message);

        const resolver = this.resultResolvers.get(taskId);
        if (resolver) {
            const abortError = new Error('Операция улучшения изображения отменена пользователем.');
            abortError.name = 'AbortError';
            resolver.reject(abortError);
        }

        this.cleanTaskResources(taskId);
    }

    private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
        const { type, id, status, progress, error, blob } = event.data;

        if (type === 'HEIC_CONVERTED' && blob) {
            const resolver = this.conversionResolvers.get(id);
            if (resolver) {
                resolver.resolve(blob);
                this.conversionResolvers.delete(id);
            }
            return;
        }

        if (type === 'HEIC_CONVERSION_FAILED') {
            const resolver = this.conversionResolvers.get(id);
            if (resolver) {
                resolver.reject(new Error(error || 'Не удалось декодировать HEIC файл.'));
                this.conversionResolvers.delete(id);
            }
            return;
        }

        const currentProgress: TaskProgress = { id, status, progress, error };
        this.tasksState.set(id, currentProgress);

        this.notifyListeners(id, currentProgress);

        if (type === 'TASK_COMPLETED' && blob) {
            const resolver = this.resultResolvers.get(id);
            if (resolver) {
                resolver.resolve(blob);
            }
            this.cleanTaskResources(id);
        }
        else if (type === 'TASK_FAILED') {
            const resolver = this.resultResolvers.get(id);
            if (resolver) {
                resolver.reject(new Error(error || 'Неизвестная ошибка выполнения внутри конвейера Web Worker.'));
            }
            this.cleanTaskResources(id);
        }
    }

    private notifyListeners(taskId: string, progress: TaskProgress): void {
        const listeners = this.statusListeners.get(taskId);
        if (listeners) {
            listeners.forEach(callback => callback(progress));
        }
    }

    private cleanTaskResources(taskId: string): void {
        this.tasksState.delete(taskId);
        this.statusListeners.delete(taskId);
        this.resultResolvers.delete(taskId);
    }
}