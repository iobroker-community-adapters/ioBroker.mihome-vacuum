const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('React admin security', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'src-admin', 'src', 'App.tsx'), 'utf8');
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src-admin', 'src', 'main.tsx'), 'utf8');
    const timerSource = fs.readFileSync(path.join(__dirname, '..', 'src-admin', 'src', 'TimerTab.tsx'), 'utf8');
    const ioPackage = require('../io-package.json');

    it('keeps discovered tokens out of select values and labels', () => {
        assert.match(appSource, /value=\{index\}/);
        assert.match(appSource, /device\.model \|\| I18n\.t\('Unknown device'\)/);
        assert.match(appSource, /device\.localip \? ` – \$\{device\.localip\}` : ''/);
        assert.doesNotMatch(appSource, /value=\{JSON\.stringify\(device\)\}/);
        assert.doesNotMatch(appSource, /device\.token\}\s*<\/MenuItem>/);
    });

    it('autofills only missing settings from discovered vacuum devices', () => {
        assert.match(appSource, /specType\.toLowerCase\(\)\.includes\(':device:vacuum:'\)/);
        assert.match(appSource, /devices\.length === 1 \? 0 : ''/);
        assert.match(appSource, /!native\[key\]\.trim\(\) && value\.trim\(\)/);
        assert.match(appSource, /discoveredToken !== native\.token\.replace\(\/\\s\/g, ''\)/);
        assert.match(appSource, /native\.token = discoveredToken/);
        assert.doesNotMatch(appSource, /this\.updateNative\('token', device\.token\)/);
    });

    it('polls QR authentication safely and cleans up its timer', () => {
        assert.match(appSource, /setInterval\(\(\) => void this\.updateCloudAuth\(\), 3_000\)/);
        assert.match(appSource, /clearInterval\(this\.authPollTimer\)/);
        assert.match(appSource, /this\.state\.auth\.status !== 'authenticated'/);
        assert.match(appSource, /waiting && this\.state\.auth\.loginUrl/);
    });

    it('uses the authenticated discovery message without legacy credentials', () => {
        assert.match(appSource, /'discovery',\s*\{ authObj: \{\}, server: this\.state\.native\.server \}/);
        assert.doesNotMatch(appSource, /authObj:\s*\{[^}]*password/);
    });

    it('loads and saves timer definitions only through the validated backend', () => {
        assert.match(appSource, /'getTimers'/);
        assert.match(appSource, /'saveTimers'/);
        assert.match(appSource, /ids\.has\(id\)/);
        assert.match(appSource, /override onSave\(isClose\?: boolean\)/);
        assert.match(timerSource, /rooms: \[\], channels: \[\]/);
        assert.doesNotMatch(timerSource, /getForeignStates|setObject|delObject/);
    });

    it('validates and sanitizes configuration before saving', () => {
        assert.match(appSource, /tokenPattern\.test\(token\)/);
        assert.match(appSource, /delete native\.devices/);
        assert.match(appSource, /delete native\.MiDevice/);
        assert.match(appSource, /deviceInfo\.unsupported/);
        assert.doesNotMatch(appSource, /return super\.onPrepareSave\(settings\)/);
    });

    it('offers opt-in diagnostics while keeping the redaction warning visible', () => {
        assert.match(appSource, /checked=\{this\.state\.native\.enableAdvancedDebug\}/);
        assert.match(appSource, /Diagnostic logs stay redacted and never include credentials/);
    });

    it('loads a validated token from the local adapter and delegates protected saving to the backend', () => {
        assert.deepEqual(ioPackage.encryptedNative, ['password', 'token', 'cloudSession']);
        assert.deepEqual(ioPackage.protectedNative, ['password', 'token', 'cloudSession']);
        assert.equal(ioPackage.native.cloudSession, '');
        assert.match(appSource, /'getProtectedConfigStatus'/);
        assert.match(appSource, /'saveConfig'/);
        assert.match(appSource, /typeof result\.token === 'string' && tokenPattern\.test\(result\.token\)/);
        assert.match(appSource, /this\.loadedToken = token/);
        assert.match(appSource, /delete native\.token/);
        assert.match(appSource, /delete native\.password/);
        assert.match(appSource, /delete native\.cloudSession/);
        assert.match(appSource, /\{ action: 'keep' \}/);
        assert.match(appSource, /\{ action: 'replace', value: token \}/);
        assert.match(appSource, /\{ action: 'delete' \}/);
        assert.doesNotMatch(appSource, /crypto\.subtle|systemSecret|socket\.encrypt|socket\.decrypt/);
        assert.doesNotMatch(appSource, /encryptedFields:\s*\['password', 'token'\]/);
        assert.doesNotMatch(mainSource, /encryptedFields=/);
    });

    it('never attempts to decrypt a stored token in React itself', () => {
        assert.match(appSource, /override onPrepareLoad\(settings:/);
        assert.match(appSource, /settings\.token = ''/);
        assert.match(appSource, /settings\.password = ''/);
        assert.match(appSource, /delete settings\.cloudSession/);
        assert.doesNotMatch(appSource, /this\.decrypt|decryptProtected|recoveredLegacySecret/);
    });

    it('keeps the token masked by default and exposes an accessible visibility toggle', () => {
        assert.match(appSource, /tokenVisible: false/);
        assert.match(appSource, /type=\{this\.state\.tokenVisible \? 'text' : 'password'\}/);
        assert.match(appSource, /this\.state\.tokenVisible \? 'Hide token' : 'Show token'/);
        assert.match(appSource, /<VisibilityOffRounded \/>/);
        assert.match(appSource, /<VisibilityRounded \/>/);
        assert.match(appSource, /Delete stored token/);
        assert.match(appSource, /confirmTokenDelete/);
        assert.match(appSource, /value=\{this\.state\.native\.token\}/);
        assert.match(appSource, /const native = \{ \.\.\.this\.state\.native, token \}/);
    });

    it('describes the browser flow as a login link instead of a QR code', () => {
        assert.match(appSource, /Create Xiaomi login link/);
        assert.match(appSource, /Open Xiaomi login link/);
        assert.match(appSource, /Xiaomi login link help/);
        assert.match(appSource, /waiting_for_scan: 'Waiting for login'/);
        assert.match(appSource, /I18n\.t\(authStatusLabels\[this\.state\.auth\.status\]\)/);
        assert.doesNotMatch(appSource, /Start Xiaomi QR login|QR login help/);
    });

    it('provides every new React and timer label in all supported languages', () => {
        const dictionary = require('../admin/words.js');
        const languages = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
        for (const key of [
            'Save timers',
            'No timers configured',
            'Timers saved',
            'Unknown device',
            'Invalid timer definition',
            'Xiaomi cloud authentication',
            'Create Xiaomi login link',
            'Open Xiaomi login link',
            'Could not create Xiaomi login link',
            'Xiaomi login link help',
            'Not authenticated',
            'Waiting for login',
            'Waiting for confirmation',
            'Authenticated',
            'Login link expired',
            'Authentication error',
            'Could not load protected configuration status',
            'Could not save protected configuration',
            'Hide token',
            'Show token',
            'Token is stored',
            'Leave the token field empty to keep the stored token.',
            'No token is stored',
            'New token',
            'Delete stored token',
            'Keep stored token',
            'Delete stored token?',
            'The stored token will only be deleted after you save the configuration.',
            'Token will be deleted when the configuration is saved.',
            'Delete token',
            'Cancel',
            'Enable advanced diagnostic logging',
            'Diagnostic logs stay redacted and never include credentials',
        ]) {
            assert.deepEqual(Object.keys(dictionary[key]), languages);
        }
    });
});
