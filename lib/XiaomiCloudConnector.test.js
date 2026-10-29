/* global describe, it, beforeEach, afterEach */
/* eslint-disable jsdoc/check-tag-names */
const assert = require('node:assert/strict');
const axios = /** @type {{create: (...args: never[]) => unknown}} Axios factory replaced with test doubles. */ (
    /** @type {unknown} */ (require('axios'))
);
const XiaomiCloudConnector = require('../build/lib/XiaomiCloudConnector');
const { XiaomiRC4Cipher } = require('../build/lib/XiaomiCloudCrypto');

function createAdapter() {
    const states = new Map();
    const config = { native: {} };
    return {
        config: {},
        namespace: 'mihome-vacuum.0',
        states,
        encrypt(value) {
            return value;
        },
        decrypt(value) {
            return value;
        },
        async setStateAsync(id, value) {
            states.set(id, value);
        },
        async getForeignObjectAsync() {
            return JSON.parse(JSON.stringify(config));
        },
        async setForeignObjectAsync(_id, value) {
            config.native = value.native;
        },
        storedNative: config.native,
        getStoredSession() {
            return config.native.cloudSession;
        },
    };
}

function createStoredSession(overrides = {}) {
    return {
        ssecurity: Buffer.alloc(16, 1).toString('base64'),
        userId: 'test-user',
        serviceToken: `test-${'session-material'}`,
        location: 'https://login.example/session',
        sessionCookies: `testSession=${Buffer.alloc(8, 2).toString('hex')}`,
        ...overrides,
    };
}

/**
 * @param {import('../src/types/xiaomiCloud').XiaomiQrLoginResult} result Result returned by a login method.
 */
function getErrorResult(result) {
    if (!('err' in result)) {
        throw new Error('Expected an error result');
    }
    return result.err;
}

describe('XiaomiCloudConnector QR login runtime', () => {
    let originalCreate;

    beforeEach(() => {
        originalCreate = axios.create;
    });

    afterEach(() => {
        axios.create = originalCreate;
    });

    it('publishes a QR login URL and persists a completed session', async () => {
        const adapter = createAdapter();
        const get = async url => {
            if (url.includes('loginUrl')) {
                return {
                    status: 200,
                    data: '&&&START&&&{"loginUrl":"https://login.example/qr","lp":"https://login.example/poll","timeout":"60"}',
                    headers: {},
                };
            }
            if (url.includes('/poll')) {
                return {
                    status: 200,
                    data: {
                        userId: '42',
                        ssecurity: 'YWJjZGVmZ2hpamtsbW5vcA==',
                        location: 'https://login.example/token',
                    },
                    headers: {},
                };
            }
            return { status: 200, data: '', headers: { 'set-cookie': ['serviceToken=token-value-123; Path=/'] } };
        };
        axios.create = () => ({ get, post: async () => ({ status: 200 }) });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        const result = await connector.startQrLogin();
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(result.pending, true);
        assert.equal(result.loginUrl, 'https://login.example/qr');
        assert.equal(adapter.states.get('auth.status'), 'authenticated');
        assert.equal(adapter.states.get('auth.loginUrl'), '');
        assert.equal(adapter.states.get('auth.expiresAt'), 0);
        assert.equal(connector.loggedIn(), true);
    });

    it('rejects damaged persisted sessions without making requests', () => {
        const adapter = createAdapter();
        axios.create = () => ({
            get: async () => {
                throw new Error('unexpected request');
            },
            post: async () => ({}),
        });
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            { cloudSession: '{"ssecurity":"short"}' },
            adapter,
        );

        assert.equal(connector.loggedIn(), false);
    });

    it('rejects stored sessions without cookies', () => {
        const adapter = createAdapter();
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            { cloudSession: JSON.stringify(createStoredSession({ sessionCookies: '' })) },
            adapter,
        );

        assert.equal(connector.loggedIn(), false);
    });

    it('clears stale login-link states when restoring an authenticated session', async () => {
        const adapter = createAdapter();
        adapter.states.set('auth.loginUrl', 'https://login.example/expired');
        adapter.states.set('auth.lastError', 'Previous login error');
        adapter.states.set('auth.expiresAt', Date.now() - 1_000);
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });

        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            { cloudSession: JSON.stringify(createStoredSession()) },
            adapter,
        );
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(connector.loggedIn(), true);
        assert.equal(adapter.states.get('auth.status'), 'authenticated');
        assert.equal(adapter.states.get('auth.loginUrl'), '');
        assert.equal(adapter.states.get('auth.lastError'), '');
        assert.equal(adapter.states.get('auth.expiresAt'), 0);
    });

    it('does not start QR authentication through the compatibility login method', async () => {
        const adapter = createAdapter();
        let requests = 0;
        axios.create = () => ({
            get: async () => {
                requests++;
                return {};
            },
            post: async () => ({}),
        });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        const result = await connector.login();

        assert.equal(requests, 0);
        assert.ok(getErrorResult(result).includes('start the QR login'));
    });

    it('does not start QR authentication while invalidating a session', async () => {
        const adapter = createAdapter();
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);
        let qrStarts = 0;
        connector.startQrLogin = async () => {
            qrStarts++;
            return { pending: true };
        };

        const result = await connector.refreshToken();

        assert.equal(qrStarts, 0);
        assert.ok(getErrorResult(result).includes('start the QR login'));
    });

    it('encrypts persisted session data before writing native configuration', async () => {
        const adapter = createAdapter();
        adapter.encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            { cloudSession: JSON.stringify(createStoredSession()) },
            adapter,
        );

        await connector.persistSession();

        assert.match(adapter.getStoredSession(), /^encrypted:/);
        assert.ok(!adapter.getStoredSession().includes('serviceToken'));
    });

    it('encrypts the cleared persisted session value', async () => {
        const adapter = createAdapter();
        adapter.encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        await connector.clearPersistedSession();

        assert.match(adapter.getStoredSession(), /^encrypted:/);
    });

    it('reports malformed QR responses without exposing their contents', async () => {
        const adapter = createAdapter();
        axios.create = () => ({
            get: async () => ({ status: 200, data: { unexpected: 'response' }, headers: {} }),
            post: async () => ({}),
        });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        const result = await connector.startQrLogin();

        assert.equal(getErrorResult(result), 'Invalid Xiaomi QR login response');
        assert.equal(adapter.states.get('auth.status'), 'error');
    });

    it('reports QR network failures and redacts URLs from errors', async () => {
        const adapter = createAdapter();
        axios.create = () => ({
            get: async () => {
                throw new Error('request failed https://secret.example/token');
            },
            post: async () => ({}),
        });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        const result = await connector.startQrLogin();

        assert.equal(getErrorResult(result), 'request failed [redacted URL]');
        assert.equal(adapter.states.get('auth.lastError'), 'request failed [redacted URL]');
    });

    it('marks an expired QR login without creating another login attempt', async () => {
        const adapter = createAdapter();
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        await connector.finishQrLoginError(new Error('QR login expired'));

        assert.equal(adapter.states.get('auth.status'), 'expired');
        assert.equal(connector.loginInProgress, false);
    });

    it('marks unauthorized cloud requests as unauthenticated', async () => {
        for (const status of [401, 403]) {
            const adapter = createAdapter();
            axios.create = () => ({ get: async () => ({ status: 200 }), post: async () => ({ status, data: '' }) });
            const connector = new XiaomiCloudConnector(
                { debug() {}, info() {}, warn() {}, error() {} },
                { cloudSession: JSON.stringify(createStoredSession()) },
                adapter,
            );

            let error;
            try {
                await connector.executeEncryptedApiCall('https://api.io.mi.com/app/test', { data: '{}' });
            } catch (caughtError) {
                error = caughtError;
            }
            if (!(error instanceof Error)) {
                throw new Error('Expected an authorization error');
            }
            assert.ok(error.message.includes('no longer authorized'));
            assert.equal(adapter.states.get('auth.status'), 'not_authenticated');
            assert.equal(adapter.states.get('auth.lastError'), 'Xiaomi Cloud session is no longer authorized');
        }
    });

    it('follows Xiaomi redirects before reading the service token cookie', async () => {
        const adapter = createAdapter();
        let requests = 0;
        axios.create = () => ({
            get: async () => {
                requests++;
                return requests === 1
                    ? {
                          status: 302,
                          headers: {
                              location: 'https://login.example/final',
                              'set-cookie': ['passToken=temporary; Path=/'],
                          },
                      }
                    : { status: 200, headers: { 'set-cookie': ['serviceToken=token-value-123; Path=/'] } };
            },
            post: async () => ({}),
        });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);
        connector.location = 'https://login.example/redirect';

        await connector.fetchServiceToken();

        assert.equal(requests, 2);
        assert.equal(connector.serviceToken, 'token-value-123');
    });

    it('discovers homes and devices through the encrypted API boundary', async () => {
        const adapter = createAdapter();
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);
        const calls = [];
        connector.executeEncryptedApiCall = async (url, params) => {
            calls.push({ url, params });
            return url.endsWith('/gethome')
                ? { result: { homelist: [{ id: 17 }, { id: 'synthetic-home' }] } }
                : { result: { synthetic: true } };
        };

        await connector.getHomes('de');
        const devices = await connector.getDevices('de');

        assert.deepEqual(connector.homeIds, [17, 'synthetic-home']);
        assert.deepEqual(Object.keys(devices), ['17', 'synthetic-home']);
        assert.equal(calls.length, 3);
        assert.equal(calls[0].url, 'https://de.api.io.mi.com/app/v2/homeroom/gethome');
        assert.equal(calls[1].url, 'https://de.api.io.mi.com/app/v2/home/home_device_list');
        assert.equal(JSON.parse(calls[1].params.data).home_id, 17);
    });

    it('decrypts a successful encrypted API response and preserves region URLs', async () => {
        const adapter = createAdapter();
        const nonceSignature = Buffer.alloc(32, 3).toString('base64');
        const responsePayload = new XiaomiRC4Cipher(nonceSignature).encrypt('&&&START&&&{"result":{"ok":true}}');
        axios.create = () => ({
            get: async () => ({}),
            post: async () => ({ status: 200, data: responsePayload }),
        });
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            { cloudSession: JSON.stringify(createStoredSession()) },
            adapter,
        );
        connector.generateNonce = () => 'synthetic-nonce';
        connector.signedNonce = () => nonceSignature;
        connector.generateEncryptedParams = () => ({ synthetic: 'field' });

        const result = await connector.executeEncryptedApiCall('https://api.io.mi.com/app/synthetic', {
            data: '{}',
        });

        assert.deepEqual(result, { result: { ok: true } });
        assert.equal(connector.getApiUrl('cn'), 'https://api.io.mi.com/app');
        assert.equal(connector.getApiUrl('-'), 'https://api.io.mi.com/app');
        assert.equal(connector.getApiUrl('de'), 'https://de.api.io.mi.com/app');
    });

    it('stops long polling during adapter shutdown', async () => {
        const adapter = createAdapter();
        axios.create = () => ({ get: () => new Promise(() => {}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);
        connector.loginInProgress = true;
        connector.longPollingUrl = 'https://login.example/poll';
        connector.qrExpiresAt = Date.now() + 60_000;
        connector.abortController = new AbortController();
        connector.shutdown();
        await connector.waitForQrLogin();

        assert.equal(adapter.states.size, 0);
    });
});
