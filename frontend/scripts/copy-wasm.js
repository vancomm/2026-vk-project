import fs from 'fs';
import path from 'path';

const sourceDir = path.resolve('node_modules/onnxruntime-web/dist');
const targetDir = path.resolve('public/models');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

try {
    const allFiles = fs.readdirSync(sourceDir);

    const matchedFiles = allFiles.filter(file => file.startsWith('ort-wasm-simd-threaded'));

    if (matchedFiles.length === 0) {
        console.warn('no WASM files found in node_modules.');
    } else {
        console.log(`found WASM files: ${matchedFiles.length}`);
    }

    matchedFiles.forEach(file => {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        fs.copyFileSync(sourcePath, targetPath);
        console.log(`copied ${file} -> public/models/`);
    });

} catch (error) {
    console.error('failed to copy WASM files:', error.message);
    process.exit(1);
}