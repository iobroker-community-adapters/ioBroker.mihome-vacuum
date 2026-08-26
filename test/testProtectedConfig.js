const assert = require('node:assert/strict');

const {
    ProtectedConfigError,
    mergeProtectedConfig,
    normalizeDeviceToken,
    parseProtectedConfigSaveRequest,
} = require('../build/lib/protectedConfig');

describe('Protected admin configuration', () => {
    const encryptedToken = '$/aes-192-cbc:stored-token-ciphertext';
    const encryptedPassword = '$/aes-192-cbc:stored-password-ciphertext';
    const encryptedSession = '$/aes-192-cbc:stored-session-ciphertext';
    const existingNative = {
        token: encryptedToken,
        password: encryptedPassword,
        cloudSession: encryptedSession,
        ip: '192.0.2.10',
        model: 'roborock.vacuum.test',
    };
    const encrypt = value => `encrypted(${value})`;

    it('keeps all protected values byte-for-byte when the token update is keep', () => {
        const result = mergeProtectedConfig(
            existingNative,
            parseProtectedConfigSaveRequest({
                native: { ip: '192.0.2.11', token: 'ignored', password: 'ignored', cloudSession: 'ignored' },
                tokenUpdate: { action: 'keep' },
            }),
            encrypt,
        );

        assert.equal(result.native.token, encryptedToken);
        assert.equal(result.native.password, encryptedPassword);
        assert.equal(result.native.cloudSession, encryptedSession);
        assert.equal(result.native.ip, '192.0.2.11');
        assert.equal(result.tokenStored, true);
    });

    it('does not migrate plain or damaged historical values during an unrelated save', () => {
        for (const historicalToken of [
            '0123456789abcdef0123456789abcdef',
            '$/aes-192-cbc:damaged-historical-value',
            '',
            null,
            undefined,
        ]) {
            const result = mergeProtectedConfig(
                { ...existingNative, token: historicalToken },
                parseProtectedConfigSaveRequest({ native: { wifiInterval: 45_000 }, tokenUpdate: { action: 'keep' } }),
                encrypt,
            );
            assert.equal(result.native.token, historicalToken);
            assert.equal(result.native.wifiInterval, 45_000);
        }
    });

    it('encrypts an explicitly replaced token in the backend', () => {
        const token = '0123456789abcdef0123456789abcdef';
        const result = mergeProtectedConfig(
            existingNative,
            parseProtectedConfigSaveRequest({ native: {}, tokenUpdate: { action: 'replace', value: token } }),
            encrypt,
        );

        assert.equal(result.native.token, `encrypted(${token})`);
        assert.equal(result.native.password, encryptedPassword);
        assert.equal(result.native.cloudSession, encryptedSession);
        assert.equal(result.tokenStored, true);
    });

    it('only deletes a token after an explicit delete action', () => {
        const result = mergeProtectedConfig(
            existingNative,
            parseProtectedConfigSaveRequest({ native: {}, tokenUpdate: { action: 'delete' } }),
            encrypt,
        );

        assert.equal(result.native.token, 'encrypted()');
        assert.equal(result.native.password, encryptedPassword);
        assert.equal(result.native.cloudSession, encryptedSession);
        assert.equal(result.tokenStored, false);
    });

    it('rejects malformed requests and tokens without including their value in errors', () => {
        const invalidSecret = 'this-value-must-never-appear-in-an-error';
        for (const request of [
            null,
            {},
            { native: [], tokenUpdate: { action: 'keep' } },
            { native: {}, tokenUpdate: { action: 'replace', value: invalidSecret } },
            { native: {}, tokenUpdate: { action: 'unknown' } },
        ]) {
            assert.throws(
                () => parseProtectedConfigSaveRequest(request),
                error => error instanceof ProtectedConfigError && !error.message.includes(invalidSecret),
            );
        }
        assert.throws(() => normalizeDeviceToken('********************************'), /hexadecimal characters/i);
    });

    it('does not allow helper or prototype fields to enter native configuration', () => {
        const requestNative = JSON.parse(
            '{"devices":"ignored","MiDevice":"ignored","prototype":"ignored","constructor":"ignored","safe":true}',
        );
        const result = mergeProtectedConfig(
            existingNative,
            parseProtectedConfigSaveRequest({ native: requestNative, tokenUpdate: { action: 'keep' } }),
            encrypt,
        );

        assert.equal(result.native.safe, true);
        assert.equal(Object.prototype.hasOwnProperty.call(result.native, 'devices'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(result.native, 'MiDevice'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(result.native, 'prototype'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(result.native, 'constructor'), false);
    });
});
