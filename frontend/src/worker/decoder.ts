import decode from 'heic-decode';

function isHeic(file: File | Blob): boolean {
    if (file instanceof File && file.name.toLowerCase().endsWith('.heic')) {
        return true;
    }
    return file.type === 'image/heic' || file.type === 'image/heif';
}

export async function decodeToImageData(
    file: File | Blob,
    signal: AbortSignal,
    onProgress: (progress: number) => void
): Promise<ImageData> {

    const throwIfAborted = () => {
        if (signal.aborted) {
            const err = new Error('Декодирование файла прервано пользователем.');
            err.name = 'AbortError';
            throw err;
        }
    };

    let imageBitmap: ImageBitmap;

    if (isHeic(file)) {
        onProgress(5);
        const arrayBuffer = await file.arrayBuffer();
        throwIfAborted();
        onProgress(15);

        const decoderReadyBuffer = new Uint8Array(arrayBuffer);
        const result = await decode({ buffer: decoderReadyBuffer });
        throwIfAborted();
        onProgress(22);

        const pixelArray = new Uint8ClampedArray(result.data);
        for (let i = 3; i < pixelArray.length; i += 4) {
            pixelArray[i] = 255;
        }

        const tempImageData = new ImageData(pixelArray, result.width, result.height);

        imageBitmap = await createImageBitmap(tempImageData);
    } else {
        onProgress(15);
        imageBitmap = await createImageBitmap(file);
    }

    throwIfAborted();
    onProgress(25);

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
        alpha: false
    });

    if (!ctx) {
        imageBitmap.close();
        throw new Error('Не удалось инициализировать контекст OffscreenCanvas 2D для декодирования.');
    }

    ctx.drawImage(imageBitmap, 0, 0);

    const finalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    imageBitmap.close();
    canvas.width = 0;
    canvas.height = 0;

    return finalImageData;
}