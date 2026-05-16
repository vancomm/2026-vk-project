// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',

    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },

    worker: {
        format: 'es',
        plugins: () => []
    },

    build: {
        outDir: 'dist',

        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
        },

        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false,
            },
        },
    },

    server: {
        port: 3000,
        open: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },

    preview: {
        port: 4173,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
});