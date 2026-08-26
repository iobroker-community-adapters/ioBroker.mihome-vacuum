const path = require('path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { tests } = require('@iobroker/testing');

// Validate the package files
tests.packageFiles(path.join(__dirname, '..'));

describe('Runtime dependencies', () => {
    it('keeps every compiled relative require inside the runtime package', () => {
        const buildDirectory = path.join(__dirname, '..', 'build');
        const pendingDirectories = [buildDirectory];
        const missingModules = [];

        while (pendingDirectories.length) {
            const directory = pendingDirectories.pop();
            if (!directory) {
                continue;
            }
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const entryPath = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    pendingDirectories.push(entryPath);
                    continue;
                }
                if (!entry.name.endsWith('.js')) {
                    continue;
                }
                const source = fs.readFileSync(entryPath, 'utf8');
                for (const match of source.matchAll(/require\(["'](\.{1,2}\/[^"']+)["']\)/g)) {
                    const requiredPath = path.resolve(path.dirname(entryPath), match[1]);
                    if (!fs.existsSync(requiredPath) && !fs.existsSync(`${requiredPath}.js`)) {
                        missingModules.push(`${path.relative(buildDirectory, entryPath)} -> ${match[1]}`);
                    }
                }
            }
        }

        assert.deepEqual(missingModules, []);
    });

    it('declares axios as a production dependency', () => {
        const packageJson = require('../package.json');

        assert.equal(packageJson.dependencies.axios, '^1.20.0');
        assert.equal(Object.prototype.hasOwnProperty.call(packageJson.devDependencies, 'axios'), false);
        assert.equal(packageJson.dependencies.qs, '6.15.3');
    });

    it('keeps the approved ioBroker and release toolchain on the current baseline', () => {
        const packageJson = require('../package.json');

        assert.equal(packageJson.dependencies['@iobroker/adapter-core'], '^3.4.3');
        assert.equal(packageJson.devDependencies['@iobroker/testing'], '^5.3.0');
        assert.equal(packageJson.devDependencies['@iobroker/eslint-config'], '^2.3.4');
        assert.equal(packageJson.devDependencies['@alcalzone/release-script'], '^5.2.1');
        assert.equal(packageJson.devDependencies['@alcalzone/release-script-plugin-iobroker'], '^5.2.0');
        assert.equal(packageJson.devDependencies['@alcalzone/release-script-plugin-license'], '^5.2.2');
        assert.equal(packageJson.devDependencies['@alcalzone/release-script-plugin-manual-review'], '^5.2.0');
    });

    it('declares the documented Node.js, js-controller, and Admin minimum versions', () => {
        const packageJson = require('../package.json');
        const ioPackage = require('../io-package.json');

        assert.equal(packageJson.engines.node, '>=22.13.0');
        assert.equal(ioPackage.common.dependencies[0]['js-controller'], '>=7.2.2');
        assert.equal(ioPackage.common.globalDependencies[0].admin, '>=7.9.13');
        assert.equal(packageJson.devDependencies['@types/node'], '^22.20.0');
    });

    it('shows a localized warning before upgrades across the version 6 boundary', () => {
        const ioPackage = require('../io-package.json');
        const languages = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];

        assert.equal(Object.prototype.hasOwnProperty.call(ioPackage, 'messages'), false);
        assert.equal(ioPackage.common.messages.length, 1);
        const message = ioPackage.common.messages[0];
        assert.deepEqual(message.condition, {
            operand: 'and',
            rules: ['oldVersion<6.0.0', 'newVersion>=6.0.0'],
        });
        assert.deepEqual(Object.keys(message.title), languages);
        assert.deepEqual(Object.keys(message.text), languages);
        assert.deepEqual(Object.keys(message.linkText), languages);
        assert.equal(message.level, 'warn');
        assert.deepEqual(message.buttons, ['agree', 'cancel']);
        assert.match(message.link, /ioBroker\.mihome-vacuum#changelog$/);
        assert.match(message.text.en, /Local IP and token control remains available without Xiaomi Cloud/);
        assert.match(message.text.de, /lokale Steuerung über IP und Token funktioniert weiterhin ohne Xiaomi Cloud/);
    });

    it('uses defaults matching every declared object value type', () => {
        const objectDefinitions = require('../build/lib/objects');
        const mismatches = [];
        const visit = (value, path = 'objects') => {
            if (!value || typeof value !== 'object') {
                return;
            }
            if (value.common && value.common.type && Object.prototype.hasOwnProperty.call(value.common, 'def')) {
                if (typeof value.common.def !== value.common.type) {
                    mismatches.push(`${path}: ${value.common.type} != ${typeof value.common.def}`);
                }
            }
            for (const [key, child] of Object.entries(value)) {
                visit(child, `${path}.${key}`);
            }
        };

        visit(objectDefinitions);

        assert.deepEqual(mismatches, []);
    });

    it('excludes source-level tests from the runtime package', () => {
        const packageJson = require('../package.json');

        assert.equal(packageJson.files.includes('build/**/*.js'), true);
        assert.equal(packageJson.files.includes('!build/types/**'), true);
        assert.equal(packageJson.files.includes('lib/'), false);
        assert.equal(packageJson.files.includes('main.js'), false);
    });

    it('builds and uses the TypeScript backend as the runtime entry', () => {
        const packageJson = require('../package.json');
        const buildConfig = require('../tsconfig.build.json');
        const checkConfigSource = fs.readFileSync(path.join(__dirname, '..', 'tsconfig.check.json'), 'utf8');

        assert.equal(packageJson.main, 'build/main.js');
        assert.equal(packageJson.scripts['build:backend'], 'tsc -p tsconfig.build.json');
        assert.match(packageJson.scripts['test:js'], /^npm run build:backend && mocha /);
        assert.equal(buildConfig.compilerOptions.rootDir, 'src');
        assert.equal(buildConfig.compilerOptions.outDir, 'build');
        assert.equal(buildConfig.compilerOptions.noEmit, false);
        assert.equal(packageJson.scripts['build:admin'], 'vite build --config src-admin/vite.config.ts');
        assert.equal(
            packageJson.scripts['build:widgets'],
            'vite build --config src-widgets/vite.config.ts && node scripts/copy-widgets.cjs',
        );
        assert.equal(packageJson.scripts['check:admin'], 'tsc --noEmit -p src-admin/tsconfig.json');
        assert.equal(packageJson.scripts['check:widgets'], 'tsc --noEmit -p src-widgets/tsconfig.json');
        assert.equal(packageJson.scripts.translate, 'npm run build:backend && gulp translateAndUpdateWordsJS');
        assert.equal(
            packageJson.scripts.build,
            'npm run build:backend && npm run build:admin && npm run build:widgets',
        );
        assert.equal(
            packageJson.scripts.check,
            'tsc --noEmit -p tsconfig.check.json && npm run check:admin && npm run check:widgets',
        );
        assert.match(checkConfigSource, /"admin\/"/);
        assert.match(checkConfigSource, /"src-admin\/"/);
        assert.equal(packageJson.scripts.prepublishOnly, 'npm run build');
        assert.equal(packageJson.scripts.prepare, 'npm run build');
        assert.equal(fs.readFileSync(path.join(__dirname, '..', '.npmrc'), 'utf8').trim(), 'foreground-scripts=false');
        assert.equal(packageJson.scripts['test:package'], 'npm run build && mocha test/package --exit');
        assert.equal(packageJson.scripts['test:package-smoke'], 'npm run build && node scripts/package-smoke.cjs');
        assert.equal(packageJson.scripts['test:unit'], undefined);
        assert.equal(packageJson.scripts['test:integration'], 'mocha test/integration --exit');
        assert.equal('prepack' in packageJson.scripts, false);
        assert.equal(packageJson.files.includes('src/'), false);
        assert.equal(packageJson.files.includes('widgets/'), true);
        assert.deepEqual(packageJson.allowScripts, {
            'canvas@3.2.3': true,
            'diskusage@1.2.0': true,
            'esbuild@0.11.23': true,
            'unix-dgram@2.0.6': true,
        });
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'package-smoke.cjs')), true);
        const packageSmokeSource = fs.readFileSync(
            path.join(__dirname, '..', 'scripts', 'package-smoke.cjs'),
            'utf8',
        );
        assert.match(packageSmokeSource, /timeout: 600_000/);
        assert.doesNotMatch(packageSmokeSource, /admin\/index_m\.html/);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'copy-widgets.cjs')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'tools.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'stockCommands.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'rrMapHeader.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'RRMapParser.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'timerManager.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'roomManager.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'miio.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'maphelper.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'XiaomiCloudCrypto.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'XiaomiCloudSession.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'XiaomiCloudProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'XiaomiCloudConnector.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'viomi.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'dreame.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'vacuumProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'featureManager.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'cleaningHistory.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'vacuumStatus.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'vacuumCommandPayloads.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'multiMapProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'consumableProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'mapStateProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'networkInfoProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'mapPointerProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'carpetModeProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'roomMappingProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'mapCreator.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'objects.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'lib', 'vacuum.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'main.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'miio.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'rrMap.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'timer.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'room.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'mapHelper.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'xiaomiCloud.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'xiaomiCloudConnector.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'viomi.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'dreame.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'featureManager.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'cleaningHistory.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'vacuumStatus.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'vacuumCommandPayloads.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'multiMapProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'consumableProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'mapStateProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'networkInfoProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'mapPointerProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'carpetModeProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'roomMappingProtocol.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'mapCreator.ts')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src', 'types', 'main.ts')), true);
        const removedLegacyRuntime = [
            'main.js',
            'lib/RRMapParser.js',
            'lib/XiaomiCloudConnector.js',
            'lib/XiaomiCloudCrypto.js',
            'lib/XiaomiCloudProtocol.js',
            'lib/XiaomiCloudSession.js',
            'lib/carpetModeProtocol.js',
            'lib/cleaningHistory.js',
            'lib/consumableProtocol.js',
            'lib/dreame.js',
            'lib/featureManager.js',
            'lib/mapCreator.js',
            'lib/mapPointerProtocol.js',
            'lib/mapStateProtocol.js',
            'lib/maphelper.js',
            'lib/miio.js',
            'lib/multiMapProtocol.js',
            'lib/networkInfoProtocol.js',
            'lib/objects.js',
            'lib/roomManager.js',
            'lib/roomMappingProtocol.js',
            'lib/stockCommands.js',
            'lib/timerManager.js',
            'lib/tools.js',
            'lib/vacuum.js',
            'lib/vacuumCommandPayloads.js',
            'lib/vacuumProtocol.js',
            'lib/vacuumStatus.js',
            'lib/viomi.js',
        ];
        for (const removedPath of removedLegacyRuntime) {
            assert.equal(fs.existsSync(path.join(__dirname, '..', removedPath)), false, removedPath);
        }
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'lib', 'XiaomiCloudConnector.test.js')), true);
    });

    it('runs JavaScript regression tests in CI independently from linting', () => {
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '.github', 'workflows', 'test-and-release.yml'),
            'utf8',
        );

        assert.match(workflow, /^    regression-tests:/m);
        assert.match(workflow, /^              run: npm run test:js$/m);
        const regressionJob = workflow.slice(
            workflow.indexOf('    regression-tests:'),
            workflow.indexOf('    check-and-lint:'),
        );
        assert.doesNotMatch(regressionJob, /^        needs:/m);
    });

    it('runs every CI job on the supported Node.js versions', () => {
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '.github', 'workflows', 'test-and-release.yml'),
            'utf8',
        );

        assert.match(workflow, /node-version: "22\.x"/);
        assert.match(workflow, /node-version: \[22\.x, 24\.x\]/);
        assert.doesNotMatch(workflow, /node-version: (?:18|20)\.x/);
        assert.doesNotMatch(workflow, /node-version: \[[^\]]*(?:18|20)\.x/);
        assert.equal([...workflow.matchAll(/actions\/checkout@v7/g)].length, 1);
        assert.equal([...workflow.matchAll(/actions\/setup-node@v7/g)].length, 1);
        assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v[1-6]/);
        assert.match(workflow, /uses: ioBroker\/testing-action-check@v1/);
        assert.match(workflow, /uses: ioBroker\/testing-action-adapter@v1/);
        assert.match(workflow, /group: \$\{\{ github\.ref \}\}/);
        assert.match(workflow, /cancel-in-progress: true/);
        assert.match(workflow, /- name: Type-check source code\s+run: npm run check/);
        assert.match(workflow, /- name: Test packed runtime installation\s+run: npm run test:package-smoke/);
    });

    it('uses the official tokenless ioBroker release workflow', () => {
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '.github', 'workflows', 'test-and-release.yml'),
            'utf8',
        );
        const deployJob = workflow.slice(workflow.indexOf('    deploy:'));

        assert.match(deployJob, /needs: \[regression-tests, check-and-lint, adapter-tests\]/);
        assert.match(deployJob, /contents: write/);
        assert.match(deployJob, /id-token: write/);
        assert.match(deployJob, /uses: ioBroker\/testing-action-deploy@v1/);
        assert.match(deployJob, /node-version: "22\.x"/);
        assert.match(deployJob, /package-cache: "false"/);
        assert.match(deployJob, /github\.repository == 'iobroker-community-adapters\/ioBroker\.mihome-vacuum'/);
        assert.doesNotMatch(deployJob, /NPM_TOKEN|npm-token|::set-output|npm install|actions\/create-release/);
    });

    it('uses tokenless Dependabot auto-merge for bounded update classes', () => {
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '.github', 'workflows', 'automerge-dependabot.yml'),
            'utf8',
        );
        const policy = fs.readFileSync(path.join(__dirname, '..', '.github', 'auto-merge.yml'), 'utf8');

        assert.match(workflow, /github\.actor == 'dependabot\[bot\]'/);
        assert.match(workflow, /uses: iobroker-bot-orga\/action-automerge-dependabot@v1/);
        assert.match(workflow, /github-token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
        assert.doesNotMatch(workflow, /AUTO_MERGE_TOKEN|ahmadnassri|actions\/checkout/);
        assert.match(policy, /dependency_type: production/);
        assert.match(policy, /dependency_type: development/);
        assert.match(policy, /update_type: "semver:patch"/);
        assert.match(policy, /update_type: "semver:minor"/);
        assert.doesNotMatch(policy, /semver:major/);
    });

    it('ships only the confirmed React HTML configuration', () => {
        const ioPackage = require('../io-package.json');
        const adminDirectory = path.join(__dirname, '..', 'admin');

        assert.equal(ioPackage.common.adminUI.config, 'html');
        assert.equal(fs.existsSync(path.join(adminDirectory, 'index_m.html')), false);
        assert.equal(fs.existsSync(path.join(adminDirectory, 'index.html')), true);
        assert.equal(fs.existsSync(path.join(adminDirectory, 'assets', 'index.js')), true);
        assert.equal(fs.existsSync(path.join(adminDirectory, 'assets', 'index.css')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src-admin', 'src', 'App.tsx')), true);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'src-admin', 'src', 'TimerTab.tsx')), true);
    });

    it('ships complete VIS 1 and VIS 2 dashboards with map, maintenance, history, and controls', () => {
        const ioPackage = require('../io-package.json');
        const root = path.join(__dirname, '..');
        const legacyWidget = fs.readFileSync(path.join(root, 'widgets', 'mihome-vacuum.html'), 'utf8');
        const legacyWidgetCss = fs.readFileSync(
            path.join(root, 'widgets', 'mihome-vacuum', 'css', 'mihome-vacuum.css'),
            'utf8',
        );
        const reactWidget = fs.readFileSync(path.join(root, 'src-widgets', 'src', 'VacuumControlWidget.tsx'), 'utf8');
        const reactTranslations = fs.readFileSync(path.join(root, 'src-widgets', 'src', 'translations.ts'), 'utf8');

        assert.deepEqual(ioPackage.common.visWidgets.mihomeVacuumWidgets, {
            i18n: 'component',
            name: 'mihomeVacuumWidgets',
            url: 'mihome-vacuum/customWidgets.js',
            bundlerType: 'module',
            components: ['VacuumControlWidget'],
        });
        for (const source of [legacyWidget, reactWidget]) {
            assert.match(source, /cleanmap\.map64/);
            assert.match(source, /WASHBOARD_LEVEL/);
            assert.match(source, /control\.start/);
            assert.match(source, /control\.pause/);
            assert.match(source, /control\.home/);
            assert.match(source, /control\.find/);
            assert.match(source, /control\.fan_power/);
            assert.match(source, /info\.battery/);
            assert.match(source, /info\.connection/);
            assert.match(source, /consumable\.filter/);
            assert.match(source, /consumable\.main_brush/);
            assert.match(source, /consumable\.side_brush/);
            assert.match(source, /consumable\.sensors/);
            assert.match(source, /consumable\.water_filter/);
            assert.match(source, /consumable\.mop_pad/);
            assert.match(source, /consumable\.strainer/);
            assert.match(source, /consumable\.cleaning_brush/);
            assert.match(source, /consumable\.dust_collection/);
            assert.match(source, /consumable\.strainer/);
            assert.match(source, /consumable\.cleaning_brush/);
            assert.match(source, /consumable\.dust_collection/);
            assert.match(source, /consumable\.sensors_reset/);
            assert.match(source, /history\.allTableJSON/);
            assert.match(source, /history\.total_area/);
            assert.match(source, /history\.total_time/);
            assert.match(source, /history\.total_cleanups/);
            assert.match(source, /room/i);
        }
        assert.match(legacyWidget, /resetConsumable/);
        assert.match(legacyWidget, /showPanel/);
        assert.match(legacyWidget, /room-1-start/);
        assert.match(legacyWidgetCss, /aspect-ratio:\s*16\s*\/\s*10/);
        assert.match(legacyWidget, /class="mihome-vacuum-map-image"/);
        assert.match(legacyWidgetCss, /\.mihome-vacuum-map-image\s*{[^}]*position:\s*absolute/s);
        assert.match(legacyWidgetCss, /\.mihome-vacuum-map-image\s*{[^}]*background-size:\s*contain/s);
        assert.match(legacyWidgetCss, /\.mihome-vacuum-panels\s*{[^}]*display:\s*flex/s);
        assert.match(reactWidget, /window\.confirm/);
        assert.match(reactWidget, /SectionButton/);
        assert.match(reactWidget, /formatVacuumState/);
        assert.match(reactWidget, /room1StartOid/);
        assert.match(reactWidget, /aspectRatio:\s*{[^}]*'16 \/ 10'/s);
        assert.match(reactWidget, /objectFit:\s*'contain'/);
        assert.match(reactWidget, /maxHeight:\s*'100%'/);
        assert.match(reactWidget, /position:\s*'absolute'/);
        assert.match(reactWidget, /flexDirection:\s*'column'/);
        assert.match(legacyWidget, /widgets\/mihome-vacuum\/js\/translations\.js/);
        assert.doesNotMatch(legacyWidget, /widgetTexts/);
        for (const language of ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn']) {
            assert.match(reactTranslations, new RegExp(`admin/i18n/${language}/translations\\.json`));
        }
        const languageRoot = path.join(root, 'admin', 'i18n');
        const english = require(path.join(languageRoot, 'en', 'translations.json'));
        const expectedKeys = Object.keys(english).sort();
        for (const language of ['de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn']) {
            const dictionary = require(path.join(languageRoot, language, 'translations.json'));
            assert.deepEqual(Object.keys(dictionary).sort(), expectedKeys, `${language} translations are incomplete`);
        }
        for (const key of ['dashboard', 'quickControls', 'startRoom', 'noCleaningHistory', 'mihome_vacuum_title']) {
            assert.equal(typeof english[key], 'string', `Missing shared widget translation ${key}`);
        }
    });

    it('keeps the developer handover guide separate from the user documentation', () => {
        const root = path.join(__dirname, '..');
        const developmentGuide = fs.readFileSync(path.join(root, 'DEVELOPMENT.md'), 'utf8');
        const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        const germanReadme = fs.readFileSync(path.join(root, 'README_de.md'), 'utf8');

        assert.doesNotMatch(readme, /development guide|DEVELOPMENT\.md/i);
        assert.doesNotMatch(germanReadme, /Entwicklerhandbuch|DEVELOPMENT\.md/i);
        for (const heading of [
            '# Development guide',
            '## 4. Runtime architecture',
            '## 6. Xiaomi Cloud authentication',
            '## 7. Protected configuration and security',
            '## 11. VIS 1 and VIS 2 widgets',
            '## 14. Test strategy',
            '## 15. Debugging guide',
            '## 18. Pull-request checklist',
        ]) {
            assert.ok(developmentGuide.includes(heading), `DEVELOPMENT.md is missing ${heading}`);
        }
        assert.doesNotMatch(developmentGuide, /fix\/xiaomi-cloud|documented commit|real device token/i);
    });

    it('keeps the release history in the English README', () => {
        const root = path.join(__dirname, '..');
        const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        const germanReadme = fs.readFileSync(path.join(root, 'README_de.md'), 'utf8');

        assert.match(readme, /^## Changelog$/m);
        assert.match(readme, /^### \*\*WORK IN PROGRESS\*\*$/m);
        assert.match(readme, /Placeholder for the next version/);
        assert.match(readme, /^### 5\.3\.0 \(2025-07-24\)$/m);
        assert.match(readme, /^### 5\.2\.0 \(2025-01-22\)$/m);
        assert.match(readme, /\[Older changelog entries\]\(CHANGELOG_OLD\.md\)/);
        assert.doesNotMatch(readme, /^### Unreleased$/m);
        assert.doesNotMatch(readme, /\[CHANGELOG\.md\]\(CHANGELOG\.md\)/);
        assert.doesNotMatch(germanReadme, /^## Changelog$/m);
        assert.equal(fs.existsSync(path.join(root, 'CHANGELOG.md')), false);
    });

    it('documents the supported device matrix in both user guides', () => {
        const root = path.join(__dirname, '..');
        const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        const germanReadme = fs.readFileSync(path.join(root, 'README_de.md'), 'utf8');

        assert.match(readme, /^## Supported devices and features$/m);
        assert.match(germanReadme, /^## Unterstützte Geräte und Funktionen$/m);
        for (const model of [
            'viomi.vacuum.v6',
            'viomi.vacuum.v19',
            'rockrobo.vacuum.v1',
            'roborock.vacuum.s5',
            'dreame.vacuum.r2205',
            'dreame.vacuum.p2156o',
        ]) {
            assert.ok(readme.includes(`\`${model}\``), `README.md is missing ${model}`);
            assert.ok(germanReadme.includes(`\`${model}\``), `README_de.md is missing ${model}`);
        }
    });

    it('documents the manual token fallback without exposing credentials', () => {
        const root = path.join(__dirname, '..');
        const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        const germanReadme = fs.readFileSync(path.join(root, 'README_de.md'), 'utf8');
        const tokenGuide =
            'https://www.smarthomeassistent.de/token-auslesen-roborock-s6-roborock-s5-xiaomi-mi-robot-xiaowa/';

        assert.match(readme, /^### Obtaining the token manually$/m);
        assert.match(germanReadme, /^### Token manuell ermitteln$/m);
        assert.ok(readme.includes(tokenGuide));
        assert.ok(germanReadme.includes(tokenGuide));
    });
});
