import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { moduleFederationShared } from '@iobroker/types-vis-2/modulefederation.vis.config';
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { defineConfig, type Plugin } from 'vite';
import { spawnSync } from 'node:child_process';

const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
// @iobroker/types-vis-2 keeps the shared list in sync with what the vis-2 host provides: react, react-dom, the
// JSX runtime, @emotion/react, @mui/private-theming, @mui/system and @mui/material as singletons. Icons are not
// shared anymore and stay tree-shakeable inside the widget bundle.
const shared = moduleFederationShared(packageJson);
delete shared['@mui/icons-material'];

/**
 * Copies the generated bundle into `widgets/` after every build. In watch mode (`npm run dev:widgets`)
 * this keeps the adapter's widget folder current, so a running `dev-server watch` picks up each change.
 */
function copyWidgetsAfterBuild(): Plugin {
    let watching = false;
    return {
        name: 'mihome-vacuum-copy-widgets',
        apply: 'build',
        configResolved(config) {
            watching = Boolean(config.build.watch);
        },
        closeBundle() {
            if (!watching) {
                return;
            }
            const result = spawnSync(
                process.execPath,
                [fileURLToPath(new URL('../scripts/copy-widgets.cjs', import.meta.url))],
                {
                    stdio: 'inherit',
                },
            );
            if (result.status !== 0) {
                this.warn('copy-widgets failed; see the output above');
            }
        },
    };
}

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    plugins: [
        copyWidgetsAfterBuild(),
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
