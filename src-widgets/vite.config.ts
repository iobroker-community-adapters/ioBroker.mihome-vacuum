import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { moduleFederationShared } from '@iobroker/types-vis-2/modulefederation.vis.config';
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
const shared = moduleFederationShared(packageJson);
// Icons are imported by their individual entry points and should stay tree-shakeable.
delete shared['@mui/icons-material'];

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    plugins: [
        federation({
            manifest: true,
            name: 'mihomeVacuumWidgets',
            filename: 'customWidgets.js',
            exposes: {
                './VacuumControlWidget': './src/VacuumControlWidget.tsx',
                './translations': './src/translations.ts',
            },
            remotes: {},
            shared,
            dts: false,
        }),
        react(),
        commonjs(),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    build: {
        target: 'chrome89',
        outDir: fileURLToPath(new URL('./build', import.meta.url)),
        emptyOutDir: true,
        sourcemap: false,
    },
});
