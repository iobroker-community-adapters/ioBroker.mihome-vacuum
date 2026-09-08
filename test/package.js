const path = require('path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { tests } = require('@iobroker/testing');

// Validate the package files
tests.packageFiles(path.join(__dirname, '..'));

describe('Runtime dependencies', () => {
    it('keeps Canvas optional so local control does not require native graphics libraries', () => {
        const packageJson = require('../package.json');

        assert.match(packageJson.optionalDependencies.canvas, /^\^[3-9]\.\d+\.\d+$/);
        assert.equal(Object.hasOwn(packageJson.dependencies, 'canvas'), false);
        const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'mapCreator.ts'), 'utf8');
        assert.match(renderer, /^\/\/ @repochecker: optional dependency 'canvas'$/m);
    });

    it('declares directly used test tools without unused Chai plugins', () => {
        const packageJson = require('../package.json');
        const setup = fs.readFileSync(path.join(__dirname, 'mocha.setup.js'), 'utf8');

        for (const dependency of ['mocha', 'chai', 'sinon', '@types/mocha', '@types/chai', '@types/sinon']) {
            assert.equal(typeof packageJson.devDependencies[dependency], 'string', dependency);
        }
        for (const plugin of ['chai-as-promised', 'sinon-chai']) {
            assert.equal(Object.hasOwn(packageJson.devDependencies, plugin), false, plugin);
            assert.equal(Object.hasOwn(packageJson.devDependencies, `@types/${plugin}`), false, plugin);
            assert.equal(setup.includes(plugin), false, plugin);
        }
        assert.match(setup, /process\.on\('unhandledRejection'/);
    });

    it('associates adapter metadata with the official VS Code JSON schema', () => {
        const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.vscode', 'settings.json'), 'utf8'));

        assert.ok(
            settings['json.schemas'].some(
                schema =>
                    schema.fileMatch.includes('io-package.json') &&
                    schema.url ===
                        'https://raw.githubusercontent.com/ioBroker/ioBroker.js-controller/master/schemas/io-package.json',
            ),
        );
    });

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

        assert.match(packageJson.dependencies.axios, /^\^[1-9]\d*\.\d+\.\d+$/);
        assert.equal(Object.prototype.hasOwnProperty.call(packageJson.devDependencies, 'axios'), false);
        assert.match(packageJson.dependencies.qs, /^\^[6-9]\.\d+\.\d+$/);
    });

    it('keeps the approved ioBroker and release toolchain declared with caret ranges', () => {
        const packageJson = require('../package.json');
        const caretRange = /^\^\d+\.\d+\.\d+$/;

        assert.match(packageJson.dependencies['@iobroker/adapter-core'], /^\^[3-9]\.\d+\.\d+$/);
        for (const dependency of [
            '@iobroker/testing',
            '@iobroker/adapter-dev',
            '@iobroker/eslint-config',
            '@tsconfig/node22',
            '@alcalzone/release-script',
            '@alcalzone/release-script-plugin-iobroker',
            '@alcalzone/release-script-plugin-license',
            '@alcalzone/release-script-plugin-manual-review',
        ]) {
            assert.match(packageJson.devDependencies[dependency] ?? '', caretRange, dependency);
        }
    });

    it('declares the documented Node.js, js-controller, and Admin minimum versions', () => {
        const packageJson = require('../package.json');
        const ioPackage = require('../io-package.json');

        assert.equal(packageJson.engines.node, '>=22.13.0');
        assert.equal(ioPackage.common.dependencies[0]['js-controller'], '>=7.2.2');
        assert.equal(ioPackage.common.globalDependencies[0].admin, '>=7.8.23');
        assert.match(packageJson.devDependencies['@types/node'], /^\^(?:2[2-9]|[3-9]\d)\.\d+\.\d+$/);
    });

    it('declares only instance objects with non-empty IDs', () => {
        const ioPackage = require('../io-package.json');

        for (const object of ioPackage.instanceObjects) {
            assert.equal(typeof object._id, 'string');
            assert.notEqual(object._id.length, 0);
        }
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
        const rootConfigSource = fs.readFileSync(path.join(__dirname, '..', 'tsconfig.json'), 'utf8');
        const checkConfigSource = fs.readFileSync(path.join(__dirname, '..', 'tsconfig.check.json'), 'utf8');

        assert.equal(packageJson.main, 'build/main.js');
        assert.equal(require('../io-package.json').common.nogit, true);
        assert.equal(packageJson.scripts['build:backend'], 'tsc -p tsconfig.build.json');
        assert.match(packageJson.scripts['test:js'], /^npm run build:backend && mocha /);
        assert.equal(buildConfig.compilerOptions.rootDir, 'src');
        assert.match(rootConfigSource, /"extends": "@tsconfig\/node22\/tsconfig\.json"/);
        assert.equal(buildConfig.compilerOptions.outDir, 'build');
        assert.equal(buildConfig.compilerOptions.noEmit, false);
        assert.equal(packageJson.scripts['build:admin'], 'vite build --config src-admin/vite.config.ts');
        assert.equal(
            packageJson.scripts['build:widgets'],
            'vite build --config src-widgets/vite.config.ts && node scripts/copy-widgets.cjs',
        );
        assert.equal(packageJson.scripts['check:admin'], 'tsc --noEmit -p src-admin/tsconfig.json');
        assert.equal(packageJson.scripts['check:widgets'], 'tsc --noEmit -p src-widgets/tsconfig.json');
        assert.equal(packageJson.scripts.translate, 'npm run build:backend && translate-adapter');
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
        for (const hook of [
            'preinstall',
            'install',
            'postinstall',
            'preprepare',
            'prepare',
            'postprepare',
            'prepublish',
            'prepublishOnly',
            'prepack',
            'postpack',
        ]) {
            assert.equal(Object.prototype.hasOwnProperty.call(packageJson.scripts, hook), false, hook);
        }
        assert.equal(fs.readFileSync(path.join(__dirname, '..', '.npmrc'), 'utf8').trim(), 'foreground-scripts=false');
        assert.equal(packageJson.scripts['test:package'], 'npm run build && mocha test/package --exit');
        assert.equal(packageJson.scripts['test:package-smoke'], 'npm run build && node scripts/package-smoke.cjs');
        assert.equal(packageJson.scripts['test:unit'], undefined);
        assert.equal(packageJson.scripts['test:integration'], 'mocha test/integration --exit');
        assert.equal('prepack' in packageJson.scripts, false);
        assert.equal(packageJson.files.includes('src/'), false);
        assert.equal(packageJson.files.includes('widgets/'), true);
        assert.equal(Object.prototype.hasOwnProperty.call(packageJson, 'allowScripts'), false);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'package-smoke.cjs')), true);
        const packageSmokeSource = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'package-smoke.cjs'), 'utf8');
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
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'main.js')), false);
        const removedLegacyRuntime = [
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

    it('uses unload-aware adapter timers and supported object APIs in the runtime', () => {
        const sourceRoot = path.join(__dirname, '..', 'src', 'lib');
        const pendingDirectories = [sourceRoot];
        const unmanagedTimers = [];
        const deprecatedObjectWrites = [];

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
                if (!entry.name.endsWith('.ts')) {
                    continue;
                }
                const source = fs.readFileSync(entryPath, 'utf8');
                const sourceFile = ts.createSourceFile(entryPath, source, ts.ScriptTarget.Latest, true);
                const visit = node => {
                    if (ts.isCallExpression(node)) {
                        if (ts.isIdentifier(node.expression) && node.expression.text === 'setTimeout') {
                            unmanagedTimers.push(path.relative(sourceRoot, entryPath));
                        }
                        if (
                            ts.isPropertyAccessExpression(node.expression) &&
                            ['setObject', 'setObjectAsync'].includes(node.expression.name.text)
                        ) {
                            deprecatedObjectWrites.push(path.relative(sourceRoot, entryPath));
                        }
                    }
                    ts.forEachChild(node, visit);
                };
                visit(sourceFile);
            }
        }

        assert.deepEqual(unmanagedTimers, []);
        assert.deepEqual(deprecatedObjectWrites, []);
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
        assert.ok(
            regressionJob.indexOf('run: npm run test:js') < regressionJob.indexOf('run: npm run check'),
            'Build the backend through test:js before type-checking tests that import generated modules',
        );
    });

    it('runs every CI job on the supported Node.js versions', () => {
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '.github', 'workflows', 'test-and-release.yml'),
            'utf8',
        );

        // Node.js 22 is the primary baseline; the matrix may add newer versions.
        assert.match(workflow, /node-version: "22\.x"/);
        assert.match(workflow, /node-version: \[22\.x(?:, (?:2[4-9]|[3-9]\d)\.x)*\]/);
        assert.doesNotMatch(workflow, /node-version: (?:18|20)\.x/);
        assert.doesNotMatch(workflow, /node-version: \[[^\]]*(?:18|20)\.x/);
        // Official actions are used exactly once each; Dependabot may raise their major versions.
        assert.equal([...workflow.matchAll(/actions\/checkout@v\d+/g)].length, 1);
        assert.equal([...workflow.matchAll(/actions\/setup-node@v\d+/g)].length, 1);
        assert.doesNotMatch(workflow, /actions\/(?:checkout|setup-node)@v[1-6]/);
        assert.match(workflow, /uses: ioBroker\/testing-action-check@v\d+/);
        assert.match(workflow, /uses: ioBroker\/testing-action-adapter@v\d+/);
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
        assert.match(deployJob, /uses: ioBroker\/testing-action-deploy@v\d+/);
        assert.match(deployJob, /node-version: "(?:2[4-9]|[3-9]\d)\.x"/);
        assert.match(deployJob, /package-cache: "false"/);
        assert.match(deployJob, /^                  build: true$/m);
        assert.match(deployJob, /^                  build-command: "npm run build"$/m);
        assert.match(deployJob, /github\.repository == 'iobroker-community-adapters\/ioBroker\.mihome-vacuum'/);
        assert.doesNotMatch(deployJob, /NPM_TOKEN|npm-token|::set-output|npm install|actions\/create-release/);
    });

    it('builds explicitly before integration tests without relying on install hooks', () => {
        const workflow = fs.readFileSync(
            path.join(__dirname, '..', '.github', 'workflows', 'test-and-release.yml'),
            'utf8',
        );
        const adapterJob = workflow.slice(workflow.indexOf('    adapter-tests:'), workflow.indexOf('    deploy:'));

        assert.match(adapterJob, /^                  build: true$/m);
        assert.match(adapterJob, /^                  build-command: "npm run build"$/m);
    });

    it('ignores reproducible UI output while preserving its build inputs', () => {
        const root = path.join(__dirname, '..');
        const ignoredPaths = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/);
        for (const generatedPath of [
            '/admin/index.html',
            '/admin/assets/',
            '/widgets/mihome-vacuum/assets/',
            '/widgets/mihome-vacuum/customWidgets.js',
            '/widgets/mihome-vacuum/js/translations.js',
        ]) {
            assert.ok(ignoredPaths.includes(generatedPath), `Missing ignore rule: ${generatedPath}`);
        }
        for (const sourcePath of [
            'src-admin/index.html',
            'src-widgets/src/VacuumControlWidget.tsx',
            'admin/i18n/en.json',
            'widgets/mihome-vacuum.html',
        ]) {
            assert.ok(fs.existsSync(path.join(root, sourcePath)), `Missing source: ${sourcePath}`);
        }
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
        const widgetSourceRoot = path.join(root, 'src-widgets', 'src');
        const widgetSourceFiles = [];
        const pendingWidgetDirectories = [widgetSourceRoot];
        while (pendingWidgetDirectories.length) {
            const directory = pendingWidgetDirectories.pop();
            if (!directory) {
                continue;
            }
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const entryPath = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    pendingWidgetDirectories.push(entryPath);
                } else if (/\.tsx?$/.test(entry.name)) {
                    widgetSourceFiles.push(entryPath);
                }
            }
        }
        // The React widget is split into a class, components, hooks and pure helper modules; the
        // contract checks below look at the union of all its sources.
        const reactWidget = widgetSourceFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
        const reactWidgetClass = fs.readFileSync(path.join(widgetSourceRoot, 'VacuumControlWidget.tsx'), 'utf8');
        const reactTranslations = fs.readFileSync(path.join(widgetSourceRoot, 'translations.ts'), 'utf8');

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
        assert.doesNotMatch(legacyWidget, /width: 1280px; height: 800px/);
        assert.match(legacyWidgetCss, /\.mihome-vacuum-map-image\s*{[^}]*position:\s*absolute/s);
        assert.match(legacyWidgetCss, /\.mihome-vacuum-map-image\s*{[^}]*background-size:\s*contain/s);
        assert.match(legacyWidgetCss, /\.mihome-vacuum-panels\s*{[^}]*display:\s*flex/s);
        // Resets are confirmed with the themed dialog, never with the blocking browser prompt.
        assert.doesNotMatch(reactWidget, /window\.confirm/);
        assert.match(reactWidget, /ConfirmDialog/);
        assert.match(reactWidget, /formatState\(/);
        assert.match(reactWidget, /formatError\(/);
        assert.match(reactWidgetClass, /roomStartOid/);
        assert.match(reactWidgetClass, /manualRoom\(6\)/);
        assert.match(reactWidgetClass, /onChange: fillFromInstance/);
        assert.match(reactWidgetClass, /roomsAuto/);
        // Extended controls (map selection, water/mop/carpet, dock, schedule) appear only when the
        // adapter created the matching state; the defaults point at the generic manager IDs.
        for (const suffix of [
            'cleanmap\\.actualMap',
            'cleanmap\\.loadMap',
            'control\\.water_box_mode',
            'control\\.mop_mode',
            'control\\.carpet_mode',
            'info\\.dock_status',
            'control\\.dustCollect',
            'control\\.washMop',
            'control\\.pauseWashMop',
            'control\\.startDrying',
            'control\\.stopDrying',
            'info\\.dnd',
            'info\\.nextTimer',
        ]) {
            assert.match(reactWidgetClass, new RegExp(suffix));
        }
        assert.match(reactWidget, /CleaningSettings/);
        assert.match(reactWidget, /DockPanel/);
        assert.match(reactWidget, /SchedulePanel/);
        assert.match(reactWidget, /timersFromObjects\(/);
        assert.match(reactWidget, /TIMER_START/);
        assert.match(reactWidget, /startTimerNowConfirm/);
        assert.match(reactWidget, /'setting\.water_grade'/);
        assert.match(reactWidget, /'info\.dock_state'/);
        // The widget must not bundle MUI icons: they deep-import the MUI styled engine, which breaks on a
        // VIS 2 host with another MUI major. Icons come from the shared SvgIcon of the host instead.
        assert.doesNotMatch(reactWidget, /from '@mui\/icons-material/);
        assert.doesNotMatch(reactWidget, /from '@mui\/material\//);
        assert.doesNotMatch(reactWidget, /from '@mui\/system/);
        assert.match(reactWidget, /'16 \/ 10'/);
        assert.match(reactWidget, /objectFit:\s*'contain'/);
        assert.match(reactWidget, /maxHeight:\s*'100%'/);
        assert.match(reactWidget, /position:\s*'absolute'/);
        assert.match(reactWidget, /flexDirection:\s*'column'/);
        // Layout follows the widget's own width, not the browser viewport.
        assert.match(reactWidget, /ResizeObserver/);
        assert.doesNotMatch(reactWidget, /\{\s*xs:\s*['{]/);
        assert.match(legacyWidget, /widgets\/mihome-vacuum\/js\/translations\.js/);
        assert.doesNotMatch(legacyWidget, /widgetTexts/);
        for (const language of ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn']) {
            assert.match(reactTranslations, new RegExp(`admin/i18n/${language}\\.json`));
        }
        const languageRoot = path.join(root, 'admin', 'i18n');
        const english = require(path.join(languageRoot, 'en.json'));
        const expectedKeys = Object.keys(english).sort();
        for (const language of ['de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'uk', 'zh-cn']) {
            const dictionary = require(path.join(languageRoot, `${language}.json`));
            assert.deepEqual(Object.keys(dictionary).sort(), expectedKeys, `${language} translations are incomplete`);
        }
        for (const key of [
            'dashboard',
            'quickControls',
            'startRoom',
            'noCleaningHistory',
            'mihome_vacuum_title',
            'mihome_vacuum_roomsAuto',
            'mihome_vacuum_accentColor',
            'confirm',
            'cancel',
            'state_5',
            'error_5',
            'cleaningSettings',
            'dockStation',
            'schedule',
            'waterOid',
            'mapSelectOid',
            'startTimerNowConfirm',
            'wasteWaterTankFull',
        ]) {
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
