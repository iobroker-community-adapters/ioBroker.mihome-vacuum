/* global describe, it, beforeEach, afterEach */
/* eslint-disable jsdoc/check-tag-names */
const { expect } = require('chai');
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

        expect(result).to.include({ pending: true, loginUrl: 'https://login.example/qr' });
        expect(adapter.states.get('auth.status')).to.equal('authenticated');
        expect(adapter.states.get('auth.loginUrl')).to.equal('');
        expect(adapter.states.get('auth.expiresAt')).to.equal(0);
        expect(connector.loggedIn()).to.equal(true);
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

        expect(connector.loggedIn()).to.equal(false);
    });

    it('rejects stored sessions without cookies', () => {
        const adapter = createAdapter();
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            { cloudSession: JSON.stringify(createStoredSession({ sessionCookies: '' })) },
            adapter,
        );

        expect(connector.loggedIn()).to.equal(false);
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

        expect(connector.loggedIn()).to.equal(true);
        expect(adapter.states.get('auth.status')).to.equal('authenticated');
        expect(adapter.states.get('auth.loginUrl')).to.equal('');
        expect(adapter.states.get('auth.lastError')).to.equal('');
        expect(adapter.states.get('auth.expiresAt')).to.equal(0);
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

        expect(requests).to.equal(0);
        expect(getErrorResult(result)).to.include('start the QR login');
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

        expect(qrStarts).to.equal(0);
        expect(getErrorResult(result)).to.include('start the QR login');
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

        expect(adapter.getStoredSession()).to.match(/^encrypted:/);
        expect(adapter.getStoredSession()).not.to.include('serviceToken');
    });

    it('encrypts the cleared persisted session value', async () => {
        const adapter = createAdapter();
        adapter.encrypt = value => `encrypted:${Buffer.from(value).toString('base64')}`;
        axios.create = () => ({ get: async () => ({}), post: async () => ({}) });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        await connector.clearPersistedSession();

        expect(adapter.getStoredSession()).to.match(/^encrypted:/);
    });

    it('reports malformed QR responses without exposing their contents', async () => {
        const adapter = createAdapter();
        axios.create = () => ({
            get: async () => ({ status: 200, data: { unexpected: 'response' }, headers: {} }),
            post: async () => ({}),
        });
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        const result = await connector.startQrLogin();

        expect(getErrorResult(result)).to.equal('Invalid Xiaomi QR login response');
        expect(adapter.states.get('auth.status')).to.equal('error');
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

        expect(getErrorResult(result)).to.equal('request failed [redacted URL]');
        expect(adapter.states.get('auth.lastError')).to.equal('request failed [redacted URL]');
    });

    it('marks an expired QR login without creating another login attempt', async () => {
        const adapter = createAdapter();
        const connector = new XiaomiCloudConnector({ debug() {}, info() {}, warn() {}, error() {} }, {}, adapter);

        await connector.finishQrLoginError(new Error('QR login expired'));

        expect(adapter.states.get('auth.status')).to.equal('expired');
        expect(connector.loginInProgress).to.equal(false);
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
            expect(error.message).to.include('no longer authorized');
            expect(adapter.states.get('auth.status')).to.equal('not_authenticated');
            expect(adapter.states.get('auth.lastError')).to.equal('Xiaomi Cloud session is no longer authorized');
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

        expect(requests).to.equal(2);
        expect(connector.serviceToken).to.equal('token-value-123');
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

        expect(connector.homeIds).to.deep.equal([17, 'synthetic-home']);
        expect(Object.keys(devices)).to.deep.equal(['17', 'synthetic-home']);
        expect(calls).to.have.length(3);
        expect(calls[0].url).to.equal('https://de.api.io.mi.com/app/v2/homeroom/gethome');
        expect(calls[1].url).to.equal('https://de.api.io.mi.com/app/v2/home/home_device_list');
        expect(JSON.parse(calls[1].params.data).home_id).to.equal(17);
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

        expect(result).to.deep.equal({ result: { ok: true } });
        expect(connector.getApiUrl('cn')).to.equal('https://api.io.mi.com/app');
        expect(connector.getApiUrl('-')).to.equal('https://api.io.mi.com/app');
        expect(connector.getApiUrl('de')).to.equal('https://de.api.io.mi.com/app');
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

        expect(adapter.states.size).to.equal(0);
    });
});
