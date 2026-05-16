import { ImageEnhancerAPI } from '@/api/ImageEnhancerAPI';
import type { TaskProgress } from '@/types/index.ts';

const enhancer = new ImageEnhancerAPI();
let currentTaskId: string | null = null;
let objectUrlBefore: string | null = null;
let objectUrlAfter: string | null = null;

const dropZone = document.getElementById('dropZone')! as HTMLElement;
const fileInput = document.getElementById('fileInput')! as HTMLInputElement;
const progressCard = document.getElementById('progressCard')! as HTMLElement;
const statusLabel = document.getElementById('statusLabel')!;
const barFill = document.getElementById('barFill')! as HTMLElement;
const percentageLabel = document.getElementById('percentageLabel')!;
const cancelBtn = document.getElementById('cancelBtn')! as HTMLButtonElement;
const viewerZone = document.getElementById('viewerZone')! as HTMLElement;
const imgBefore = document.getElementById('imgBefore')! as HTMLImageElement;
const imgAfter = document.getElementById('imgAfter')! as HTMLImageElement;

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) handleFile(files[0]);
});

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) handleFile(files[0]);
});

cancelBtn.addEventListener('click', () => {
    if (currentTaskId) {
        enhancer.cancelTask(currentTaskId);
        resetUiToInit();
    }
});


async function handleFile(file: File) {
    cleanupObjectUrls();
    currentTaskId = `task_${Date.now()}`;

    dropZone.classList.add('hidden');
    progressCard.classList.remove('hidden');
    viewerZone.classList.add('hidden');
    cancelBtn.disabled = false;

    updateUiProgress('pending', 0);

    try {
        const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic';
        let originalVisualBlob: Blob = file;

        if (isHeic) {
            updateUiProgress('decoding', 5);
            originalVisualBlob = await enhancer.convertHeicToPngBlob(file);
        }

        objectUrlBefore = URL.createObjectURL(originalVisualBlob);
        imgBefore.src = objectUrlBefore;

        const unsubscribe = enhancer.onStatusChange(currentTaskId, (state: TaskProgress) => {
            updateUiProgress(state.status, state.progress, state.error);
        });

        enhancer.startEnhancementTask(currentTaskId, file);
        const enhancedBlob = await enhancer.getResultImage(currentTaskId);

        unsubscribe();

        objectUrlAfter = URL.createObjectURL(enhancedBlob);
        imgAfter.src = objectUrlAfter;

        progressCard.classList.add('hidden');
        viewerZone.classList.remove('hidden');
        dropZone.classList.remove('hidden');

    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('Задача была отменена.');
            return;
        }
        updateUiProgress('failed', 0, error.message || 'Критическая ошибка.');
    }
}

function updateUiProgress(status: string, progress: number, error?: string) {
    barFill.style.width = `${progress}%`;
    percentageLabel.textContent = `${progress}%`;

    switch (status) {
        case 'pending':
            statusLabel.textContent = 'Инициализация очереди...';
            break;
        case 'decoding':
            statusLabel.textContent = 'Декодирование и распаковка пикселей изображения...';
            break;
        case 'analyzing':
            statusLabel.textContent = 'Нейросеть Zero-DCE строит карты кривых освещения...';
            break;
        case 'processing':
            statusLabel.textContent = 'WebGL применяет каскад нелинейных кривых на GPU...';
            break;
        case 'failed':
            statusLabel.textContent = `Ошибка: ${error || 'Неизвестный сбой.'}`;
            barFill.classList.add('bg-red-500');
            cancelBtn.textContent = 'Сбросить';
            cancelBtn.onclick = () => window.location.reload();
            break;
    }
}

function resetUiToInit() {
    currentTaskId = null;
    dropZone.classList.remove('hidden');
    progressCard.classList.add('hidden');
    viewerZone.classList.add('hidden');
    fileInput.value = '';
}

const sliderContainer = document.getElementById('sliderContainer')!;
const resizeLayer = document.getElementById('resizeLayer')!;
const sliderHandle = document.getElementById('sliderHandle')!;

function initSlider() {
    let isDragging = false;

    const moveSlider = (clientX: number) => {
        const rect = sliderContainer.getBoundingClientRect();
        const position = ((clientX - rect.left) / rect.width) * 100;
        const clampedPosition = Math.max(0, Math.min(100, position));

        sliderHandle.style.left = `${clampedPosition}%`;
        resizeLayer.style.width = `${clampedPosition}%`;
    };

    sliderHandle.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => isDragging = false);
    window.addEventListener('mousemove', (e) => { if (isDragging) moveSlider(e.clientX); });

    sliderHandle.addEventListener('touchstart', () => isDragging = true);
    window.addEventListener('touchend', () => isDragging = false);
    window.addEventListener('touchmove', (e) => { if (isDragging && e.touches[0]) moveSlider(e.touches[0].clientX); });
}

initSlider();

function cleanupObjectUrls() {
    if (objectUrlBefore) { URL.revokeObjectURL(objectUrlBefore); objectUrlBefore = null; }
    if (objectUrlAfter) { URL.revokeObjectURL(objectUrlAfter); objectUrlAfter = null; }
}