import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { moduleFederationShared } from '@iobroker/types-vis-2/modulefederation.vis.config';
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
// @iobroker/types-vis-2 keeps the shared list in sync with what the vis-2 host provides: react, react-dom, the
// JSX runtime, @emotion/react, @mui/private-theming, @mui/system and @mui/material as singletons. Icons are not
// shared anymore and stay tree-shakeable inside the widget bundle.
const shared = moduleFederationShared(packageJson);
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
        // Same set as the shared modules above: the fallback copies inside the widget bundle must be unique too.
        dedupe: ['react', 'react-dom', '@emotion/react', '@mui/material', '@mui/system', '@mui/icons-material'],
    },
    build: {
        target: 'chrome89',
        outDir: fileURLToPath(new URL('./build', import.meta.url)),
        emptyOutDir: true,
        sourcemap: false,
    },
});
