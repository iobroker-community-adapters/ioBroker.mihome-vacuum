'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mihome-vacuum-package-'));
const npmCacheDirectory = path.join(temporaryRoot, 'npm-cache');
const npmExecPath = process.env.npm_execpath;

function runNode(args, options = {}) {
    const result = spawnSync(process.execPath, args, {
        cwd: options.cwd || projectRoot,
        encoding: 'utf8',
        env: options.env || process.env,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 600_000,
    });
    if (result.status !== 0) {
        throw new Error(
            [
                `Command failed: ${process.execPath} ${args.join(' ')}`,
                result.error?.message,
                result.stdout,
                result.stderr,
            ]
                .filter(Boolean)
                .join('\n'),
        );
    }
    return result.stdout;
}

function runNpm(args, cwd) {
    assert.ok(npmExecPath, 'The smoke test must be started through an npm script');
    const npmEnvironment = {
        ...process.env,
        npm_config_cache: npmCacheDirectory,
        npm_config_loglevel: 'error',
    };
    return runNode([npmExecPath, ...args], {
        cwd,
        env: npmEnvironment,
    });
}

try {
    const packDirectory = path.join(temporaryRoot, 'pack');
    const installDirectory = path.join(temporaryRoot, 'install');
    fs.mkdirSync(packDirectory, { recursive: true });
    fs.mkdirSync(installDirectory, { recursive: true });
    fs.mkdirSync(npmCacheDirectory, { recursive: true });

    const packOutput = runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDirectory], projectRoot);
    const packResult = JSON.parse(packOutput);
    assert.equal(packResult.length, 1, 'npm pack must create exactly one archive');

    const archive = packResult[0];
    const archivePath = path.join(packDirectory, archive.filename);
    const packagedPaths = new Set(archive.files.map(file => file.path.replaceAll('\\', '/')));
    const requiredPaths = [
        'admin/assets/index.css',
        'admin/assets/index.js',
        'admin/index.html',
        'admin/words.js',
        'build/main.js',
        'build/lib/dreameProtocol.js',
        'build/lib/mapCreator.js',
        'io-package.json',
        'package.json',
        'widgets/mihome-vacuum.html',
        'widgets/mihome-vacuum/css/mihome-vacuum.css',
        'widgets/mihome-vacuum/customWidgets.js',
        'widgets/mihome-vacuum/js/translations.js',
    ];

    for (const requiredPath of requiredPaths) {
        assert.ok(packagedPaths.has(requiredPath), `Runtime package is missing ${requiredPath}`);
    }

    // Every generated UI chunk must survive npm's allowlist even though Git ignores it.
    for (const assetDirectory of ['admin/assets', 'widgets/mihome-vacuum/assets']) {
        const assets = fs.readdirSync(path.join(projectRoot, assetDirectory), { recursive: true });
        assert.ok(assets.length > 0, `No generated assets found in ${assetDirectory}`);
        for (const asset of assets) {
            const assetPath = `${assetDirectory}/${asset.replaceAll('\\', '/')}`;
            if (fs.statSync(path.join(projectRoot, assetPath)).isFile()) {
                assert.ok(packagedPaths.has(assetPath), `Runtime package is missing generated asset ${assetPath}`);
            }
        }
    }

    const forbiddenPaths = [...packagedPaths].filter(
        file =>
            file === 'main.js' ||
            file.startsWith('lib/') ||
            file.startsWith('src/') ||
            file.startsWith('src-admin/') ||
            file.startsWith('src-widgets/') ||
            file.startsWith('test/') ||
            file.startsWith('build/types/') ||
            file.endsWith('.d.ts') ||
            file.endsWith('.map'),
    );
    assert.deepEqual(forbiddenPaths, [], 'Runtime package contains source or legacy artifacts');
    assert.ok(fs.existsSync(archivePath), 'npm pack did not create the reported archive');

    fs.writeFileSync(
        path.join(installDirectory, 'package.json'),
        `${JSON.stringify({ name: 'mihome-vacuum-package-smoke', private: true }, null, 2)}\n`,
    );
    runNpm(
        [
            'install',
            archivePath,
            '--ignore-scripts',
            '--omit=dev',
            '--omit=optional',
            '--no-audit',
            '--no-fund',
            '--no-package-lock',
        ],
        installDirectory,
    );

    const installedRoot = path.join(installDirectory, 'node_modules', 'iobroker.mihome-vacuum');
    const probe = `
        const assert = require('node:assert/strict');
        const fs = require('node:fs');
        const Module = require('node:module');
        const { EventEmitter } = require('node:events');
        const vm = require('node:vm');
        const path = require('node:path');
        const root = ${JSON.stringify(installedRoot)};
        const instances = [];
        class FakeAdapter extends EventEmitter {
            constructor(options) {
                super();
                this.options = options;
                instances.push(this);
            }
        }
        const originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === '@iobroker/adapter-core') {
                return { Adapter: FakeAdapter };
            }
            return originalLoad.call(this, request, parent, isMain);
        };
        const packageJson = require(path.join(root, 'package.json'));
        assert.equal(packageJson.main, 'build/main.js');
        assert.equal(require(path.join(root, 'io-package.json')).common.nogit, true);
        for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'prepack']) {
            assert.equal(Object.hasOwn(packageJson.scripts, hook), false, hook);
        }
        const factory = require(root);
        assert.equal(typeof factory, 'function');
        assert.equal(instances.length, 0, 'Importing the compact-mode factory must not start an instance');
        const compactAdapter = factory({ synthetic: true });
        assert.deepEqual(compactAdapter.options, { synthetic: true, name: 'mihome-vacuum' });
        assert.deepEqual(compactAdapter.eventNames().sort(), ['message', 'ready', 'stateChange', 'unload']);
        const entryPath = path.join(root, packageJson.main);
        const directModule = { exports: {}, parent: null };
        vm.runInNewContext(fs.readFileSync(entryPath, 'utf8'), {
            require: Module.createRequire(entryPath),
            module: directModule,
            exports: directModule.exports,
        }, { filename: entryPath });
        assert.equal(instances.length, 2, 'Direct execution must construct an adapter without a bootstrap');
        assert.equal(instances[1].options.name, 'mihome-vacuum');
        assert.deepEqual(instances[1].eventNames().sort(), ['message', 'ready', 'stateChange', 'unload']);
        assert.equal(typeof require(path.join(root, 'build/lib/dreame')), 'function');
        assert.equal(typeof require(path.join(root, 'build/lib/maphelper')), 'function');
        assert.equal(fs.existsSync(path.join(root, 'main.js')), false);
        assert.equal(fs.existsSync(path.join(root, 'lib')), false);
        assert.equal(fs.existsSync(path.join(root, 'src')), false);
        for (const developmentPackage of ['typescript', 'vite']) {
            assert.equal(fs.existsSync(path.join(root, '..', developmentPackage)), false);
        }
    `;
    runNode(['-e', probe], { cwd: installDirectory });

    console.log(`Package smoke test passed: ${archive.entryCount} files, clean runtime install`);
} finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
