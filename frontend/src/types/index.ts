export type TaskStatus =
    | 'pending'
    | 'decoding'
    | 'analyzing'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface TaskProgress {
    id: string;
    status: TaskStatus;
    progress: number;
    error?: string;
}


export interface ZeroDCEParameters {
    curvesData: Float32Array;
}

export type ClientMessage =
    | { type: 'CONVERT_HEIC'; id: string; file: File | Blob }
    | { type: 'START_TASK'; id: string; file: File | Blob }
    | { type: 'CANCEL_TASK'; id: string; file?: never };

export type WorkerMessageType =
    | 'HEIC_CONVERTED'
    | 'HEIC_CONVERSION_FAILED'
    | 'STATUS_CHANGED'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED';

export interface WorkerMessage {
    type: WorkerMessageType;
    id: string;
    status: TaskStatus;
    progress: number;
    error?: string;
    blob?: Blob;
}

export interface EnhancementSettings {
    dceStrength: number;
    brightness: number;
    contrast: number;
    saturation: number;
}