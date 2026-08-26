const assert = require('node:assert/strict');
const { logAdvancedDiagnostic, redactDiagnosticValue } = require('../build/lib/diagnostics');

describe('Advanced diagnostic redaction', () => {
    it('redacts credentials and identifying endpoint data recursively', () => {
        const diagnostic = redactDiagnosticValue({
            token: 'device-token-value',
            password: 'account-password',
            cloudSession: 'encrypted-session',
            nested: {
                id: 123456789,
                pid: 987654321,
                serviceToken: 'service-token-value',
                ssecurity: 'security-material',
                localip: '192.0.2.10',
                mac: '00:11:22:33:44:55',
                loginUrl: 'https://login.example/private',
                cookies: ['cookie-value'],
            },
            model: 'roborock.vacuum.synthetic',
            status: 200,
        });
        const serialized = JSON.stringify(diagnostic);

        for (const secret of [
            'device-token-value',
            'account-password',
            'encrypted-session',
            'service-token-value',
            'security-material',
            '192.0.2.10',
            '00:11:22:33:44:55',
            'https://login.example/private',
            'cookie-value',
            '123456789',
            '987654321',
        ]) {
            assert.equal(serialized.includes(secret), false);
        }
        assert.match(serialized, /<redacted:set>/);
        assert.match(serialized, /roborock\.vacuum\.synthetic/);
    });

    it('writes diagnostics only when explicitly enabled', () => {
        const messages = /** @type {string[]} */ ([]);
        const logger = { debug: message => messages.push(message) };

        logAdvancedDiagnostic(logger, false, 'disabled request', { token: 'hidden' });
        assert.deepEqual(messages, []);

        logAdvancedDiagnostic(logger, true, 'enabled request', { token: 'hidden', status: 200 });
        assert.equal(messages.length, 1);
        const message = messages.join('\n');
        assert.match(message, /^Advanced diagnostics: enabled request /);
        assert.equal(message.includes('hidden'), false);
    });
});
