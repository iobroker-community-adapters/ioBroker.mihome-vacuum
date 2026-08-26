import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    plugins: [
        react(),
        {
            name: 'strip-generated-trailing-whitespace',
            generateBundle(_options, bundle) {
                for (const output of Object.values(bundle)) {
                    if (output.type === 'chunk') {
                        output.code = output.code.replace(/[ \t]+$/gm, '');
                    }
                }
            },
        },
    ],
    build: {
        outDir: fileURLToPath(new URL('../admin', import.meta.url)),
        emptyOutDir: false,
        sourcemap: false,
        chunkSizeWarningLimit: 900,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/index.js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name][extname]',
            },
        },
    },
});
