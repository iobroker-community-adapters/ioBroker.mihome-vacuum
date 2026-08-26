const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

class ProtectedConfigFakeAdapter extends EventEmitter {
    constructor(options = {}) {
        super();
        this.config = options.config || {};
        this.namespace = 'mihome-vacuum.protected-test';
        this.instanceObject = {
            _id: `system.adapter.${this.namespace}`,
            type: 'instance',
            common: {},
            native: {
                token: '$/aes-192-cbc:existing-token-ciphertext',
                password: '$/aes-192-cbc:existing-password-ciphertext',
                cloudSession: '$/aes-192-cbc:existing-session-ciphertext',
                ip: '192.0.2.10',
            },
        };
        this.messageResponses = [];
        this.log = { debug() {}, info() {}, warn() {}, error() {} };
    }

    encrypt(value) {
        return `encrypted(${value})`;
    }

    async getForeignObjectAsync() {
        return structuredClone(this.instanceObject);
    }

    async setForeignObjectAsync(_id, object) {
        this.instanceObject = structuredClone(object);
    }

    sendTo(from, command, response, callback) {
        this.messageResponses.push({ from, command, response, callback });
    }
}

function createAdapter(config = {}) {
    const startAdapter = proxyquire('./build/main', {
        '@iobroker/adapter-core': { Adapter: ProtectedConfigFakeAdapter },
        './lib/miio': class {},
        './lib/viomi': class {},
        './lib/vacuum': class {},
        './lib/dreame': class {},
        './lib/XiaomiCloudConnector': class {},
    });
    return startAdapter({ config });
}

describe('Adapter protected configuration messages', () => {
    it('returns the validated decrypted token only through the protected admin result', () => {
        const token = '0123456789abcdef0123456789abcdef';
        const adapter = createAdapter({ token, password: '', cloudSession: 'decrypted-session' });
        const status = adapter.getProtectedConfigStatus();

        assert.deepEqual(status, {
            ok: true,
            tokenStored: true,
            token,
            tokenReadable: true,
            passwordStored: false,
            cloudSessionStored: true,
        });
        assert.doesNotMatch(JSON.stringify(status), /decrypted-session/);
    });

    it('does not return damaged token values and rejects non-admin message senders', async () => {
        const damagedValue = '$/aes-192-cbc:damaged-value-that-must-not-be-returned';
        const adapter = createAdapter({ token: damagedValue });
        const callback = { message: 'admin-callback' };

        assert.deepEqual(adapter.getProtectedConfigStatus(), {
            ok: true,
            tokenStored: true,
            token: '',
            tokenReadable: false,
            passwordStored: false,
            cloudSessionStored: false,
        });
        await adapter.onMessage({
            command: 'getProtectedConfigStatus',
            message: {},
            from: 'system.adapter.javascript.0',
            callback,
        });

        assert.deepEqual(adapter.messageResponses[0].response, {
            ok: false,
            error: { code: 'ADMIN_ONLY', message: 'Admin access required' },
        });
        assert.doesNotMatch(JSON.stringify(adapter.messageResponses), /damaged-value-that-must-not-be-returned/);
    });

    it('preserves protected ciphertext while saving ordinary settings', async () => {
        const adapter = createAdapter();
        const before = structuredClone(adapter.instanceObject.native);

        const result = await adapter.saveConfigFromAdmin({
            native: { ip: '192.0.2.20', token: 'must-be-ignored', cloudSession: 'must-be-ignored' },
            tokenUpdate: { action: 'keep' },
        });

        assert.deepEqual(result, { ok: true, tokenStored: true });
        assert.equal(adapter.instanceObject.native.ip, '192.0.2.20');
        assert.equal(adapter.instanceObject.native.token, before.token);
        assert.equal(adapter.instanceObject.native.password, before.password);
        assert.equal(adapter.instanceObject.native.cloudSession, before.cloudSession);
    });

    it('routes replacement and controlled validation errors through sendTo', async () => {
        const adapter = createAdapter();
        const callback = { message: 'admin-callback' };
        const token = '0123456789abcdef0123456789abcdef';

        await adapter.onMessage({
            command: 'saveConfig',
            message: { native: {}, tokenUpdate: { action: 'replace', value: token } },
            from: 'system.adapter.admin.0',
            callback,
        });
        await adapter.onMessage({
            command: 'saveConfig',
            message: { native: {}, tokenUpdate: { action: 'replace', value: 'private-invalid-value' } },
            from: 'system.adapter.admin.0',
            callback,
        });

        assert.equal(adapter.instanceObject.native.token, `encrypted(${token})`);
        assert.deepEqual(adapter.messageResponses[0].response, { ok: true, tokenStored: true });
        assert.equal(adapter.messageResponses[1].response.ok, false);
        assert.equal(adapter.messageResponses[1].response.error.code, 'INVALID_TOKEN');
        assert.doesNotMatch(JSON.stringify(adapter.messageResponses[1].response), /private-invalid-value/);
    });
});
