import type { EnhancementSettings, ZeroDCEParameters } from '../types/index.ts';
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from './shaders.ts';

export async function applyWebGLFilters(
    imageData: ImageData,
    params: ZeroDCEParameters,
    settings: EnhancementSettings,
    signal: AbortSignal
): Promise<Blob> {

    const throwIfAborted = () => {
        if (signal.aborted) {
            const err = new Error('Графический рендеринг прерван пользователем.');
            err.name = 'AbortError';
            throw err;
        }
    };

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
    });

    if (!gl) {
        throw new Error('WebGL не поддерживается в данном окружении (Worker/Браузер).');
    }

    const floatTexExt = gl.getExtension('OES_texture_float');
    const useFloatTexture = floatTexExt !== null;

    throwIfAborted();

    const vs = compileShader(gl, VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
    const fs = compileShader(gl, FRAGMENT_SHADER_SOURCE, gl.FRAGMENT_SHADER);

    const program = gl.createProgram()!
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Ошибка линковки шейдеров: ${gl.getProgramInfoLog(program)}`);
    }

    gl.useProgram(program);
    throwIfAborted();

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1.0, -1.0, 1.0, -1.0, -1.0, 1.0,
        -1.0, 1.0, 1.0, -1.0, 1.0, 1.0,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0.0, 1.0, 1.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 1.0, 1.0, 0.0,
    ]), gl.STATIC_DRAW);

    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    const baseTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, baseTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

    const CURVE_SIZE = 256;
    const pixelsPerTexture = CURVE_SIZE * CURVE_SIZE;
    const curveTextures: WebGLTexture[] = [];

    const curvesUniformLocation = gl.getUniformLocation(program, 'u_curves');
    const samplerIndices = [1, 2, 3, 4, 5, 6];
    gl.uniform1iv(curvesUniformLocation, new Int32Array(samplerIndices));

    for (let t = 0; t < 6; t++) {
        gl.activeTexture(gl.TEXTURE1 + t);
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const rgbaBuffer = new Float32Array(pixelsPerTexture * 4);
        const startChannel = t * 4;

        for (let p = 0; p < pixelsPerTexture; p++) {
            rgbaBuffer[p * 4 + 0] = params.curvesData[(startChannel + 0) * pixelsPerTexture + p]; // R
            rgbaBuffer[p * 4 + 1] = params.curvesData[(startChannel + 1) * pixelsPerTexture + p]; // G
            rgbaBuffer[p * 4 + 2] = params.curvesData[(startChannel + 2) * pixelsPerTexture + p]; // B
            rgbaBuffer[p * 4 + 3] = params.curvesData[(startChannel + 3) * pixelsPerTexture + p]; // A
        }

        if (useFloatTexture) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CURVE_SIZE, CURVE_SIZE, 0, gl.RGBA, gl.FLOAT, rgbaBuffer);
        } else {
            const byteBuffer = new Uint8Array(rgbaBuffer.length);
            for (let i = 0; i < rgbaBuffer.length; i++) {
                const normalized = (rgbaBuffer[i] + 1.0) / 2.0; // Сдвиг из [-1, 1] в [0, 1]
                byteBuffer[i] = Math.max(0, Math.min(255, Math.floor(normalized * 255)));
            }
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CURVE_SIZE, CURVE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, byteBuffer);
        }

        curveTextures.push(tex);
    }

    const dceStrengthLoc = gl.getUniformLocation(program, "u_dce_strength");
    const brightnessLoc = gl.getUniformLocation(program, "u_brightness");
    const contrastLoc = gl.getUniformLocation(program, "u_contrast");
    const saturationLoc = gl.getUniformLocation(program, "u_saturation");

    gl.uniform1f(dceStrengthLoc, settings.dceStrength);
    gl.uniform1f(brightnessLoc, settings.brightness);
    gl.uniform1f(contrastLoc, settings.contrast);
    gl.uniform1f(saturationLoc, settings.saturation);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    throwIfAborted();

    const resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });

    gl.deleteTexture(baseTexture);
    for (const tex of curveTextures) {
        gl.deleteTexture(tex);
    }
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    canvas.width = 0;
    canvas.height = 0;

    return resultBlob;
}

function compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Не удалось создать объект шейдера.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Ошибка компиляции шейдера: ${info}`);
    }
    return shader;
}