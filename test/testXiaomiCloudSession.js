const assert = require('node:assert/strict');
const cloudSession = require('../build/lib/XiaomiCloudSession');
const XiaomiCloudConnector = require('../build/lib/XiaomiCloudConnector');

describe('Xiaomi Cloud session runtime', () => {
    function createAdapter() {
        return {
            config: {},
            namespace: 'mihome-vacuum.0',
            async setStateAsync() {},
            async getForeignObjectAsync() {
                return null;
            },
            async setForeignObjectAsync() {},
        };
    }

    function createValidSession() {
        return {
            deviceId: 'synthetic-device',
            ssecurity: Buffer.alloc(16, 1).toString('base64'),
            userId: 'synthetic-user',
            serviceToken: 'synthetic-service-token',
            location: 'https://login.example/synthetic-session',
            sessionCookies: 'syntheticCookie=synthetic-value',
        };
    }

    it('accepts the complete synthetic session contract', () => {
        const session = createValidSession();

        assert.equal(cloudSession.isValidCloudSession(session), true);
    });

    it('rejects every missing or malformed required field in parity', () => {
        const invalidSessions = [
            null,
            '',
            {},
            { ...createValidSession(), ssecurity: 'short' },
            { ...createValidSession(), ssecurity: 'not base64!' },
            { ...createValidSession(), userId: '' },
            { ...createValidSession(), serviceToken: 'short' },
            { ...createValidSession(), sessionCookies: '' },
            { ...createValidSession(), location: 'http://insecure.example/session' },
        ];

        for (const session of invalidSessions) {
            assert.equal(cloudSession.isValidCloudSession(session), false);
        }
    });

    it('decodes plain and encrypted stored sessions with explicit failure reasons', () => {
        const session = createValidSession();
        const serialized = JSON.stringify(session);
        const encrypted = `encrypted:${Buffer.from(serialized).toString('base64')}`;
        const decrypt = value => Buffer.from(value.slice('encrypted:'.length), 'base64').toString();
        /** @type {Array<[unknown, ((value: string) => string) | undefined, unknown]>} */
        const cases = [
            [session, undefined, { status: 'valid', session }],
            [serialized, undefined, { status: 'valid', session }],
            [encrypted, decrypt, { status: 'valid', session }],
            ['{"ssecurity":"short"}', undefined, { status: 'invalid_session' }],
            ['not-json', undefined, { status: 'invalid_json' }],
        ];

        for (const [raw, decoder, expected] of cases) {
            assert.deepEqual(cloudSession.decodeStoredCloudSession(raw, decoder), expected);
        }
    });

    it('keeps the connector compatibility method delegated to the extracted validator', () => {
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            {},
            createAdapter(),
        );
        const session = createValidSession();

        assert.equal(connector.isValidSession(session), true);
        assert.equal(connector.isValidSession({ ...session, sessionCookies: '' }), false);
    });
});
