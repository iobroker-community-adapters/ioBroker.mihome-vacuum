const assert = require('node:assert/strict');
const cloudProtocol = require('../build/lib/XiaomiCloudProtocol');
const XiaomiCloudConnector = require('../build/lib/XiaomiCloudConnector');

describe('Xiaomi Cloud protocol utility runtime', () => {
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

    function createConnector() {
        return new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            {},
            createAdapter(),
        );
    }

    it('merges synthetic Set-Cookie headers without truncating values', () => {
        const current = 'keep=first; replace=old';
        const headers = ['replace=new=value; Path=/; Secure', 'added=third; HttpOnly'];
        const expected = 'keep=first; replace=new=value; added=third';

        assert.equal(cloudProtocol.mergeSessionCookies(current, headers), expected);
        assert.equal(cloudProtocol.mergeSessionCookies(current, undefined), current);
    });

    it('builds and reads cookie headers in exact-name parity', () => {
        const sessionCookies = 'serviceTokenExtra=wrong; serviceToken=synthetic=value';
        const expectedHeader = 'base=synthetic; pass_ua=web; uLocale=en_GB; serviceToken=synthetic';

        assert.equal(cloudProtocol.buildCookieHeader('base=synthetic', 'serviceToken=synthetic'), expectedHeader);
        assert.equal(cloudProtocol.getSessionCookie(sessionCookies, 'serviceToken'), 'synthetic=value');
        assert.equal(cloudProtocol.getSessionCookie(sessionCookies, 'missing'), undefined);
    });

    it('parses prefixed Xiaomi JSON and preserves non-string input', () => {
        const object = { synthetic: true };
        const raw = '&&&START&&&{"synthetic":true}';

        assert.deepEqual(cloudProtocol.parseXiaomiJSON(raw), object);
        assert.equal(cloudProtocol.parseXiaomiJSON(object), object);
        assert.equal(cloudProtocol.parseXiaomiJSON('{invalid'), null);
    });

    it('normalizes request failures without exposing response data or URLs', () => {
        const responseError = {
            response: { status: 403, data: 'synthetic-sensitive-response' },
        };
        const urlError = new Error('request failed at https://example.invalid/private?marker=synthetic-secret');
        /** @type {Array<[unknown, string]>} */
        const cases = [
            [responseError, 'Xiaomi request failed (HTTP 403)'],
            [{ code: 'ECONNABORTED' }, 'Xiaomi request timed out'],
            [urlError, 'request failed at [redacted URL]'],
            ['synthetic-sensitive-response', 'Xiaomi request failed'],
        ];

        for (const [error, expected] of cases) {
            assert.equal(cloudProtocol.safeXiaomiError(error), expected);
            assert.doesNotMatch(expected, /synthetic-secret|synthetic-sensitive-response/);
        }
    });

    it('keeps the connector compatibility methods delegated to the extracted utilities', () => {
        const connector = createConnector();
        connector.commonCookies = 'base=synthetic';
        connector.sessionCookies = 'keep=first; replace=old';

        connector.mergeSetCookie(['replace=new=value; Secure', 'serviceToken=synthetic-token; HttpOnly']);

        assert.equal(connector.sessionCookies, 'keep=first; replace=new=value; serviceToken=synthetic-token');
        assert.equal(connector.getCookie('serviceToken'), 'synthetic-token');
        assert.equal(
            connector.buildCookieHeader(),
            'base=synthetic; pass_ua=web; uLocale=en_GB; keep=first; replace=new=value; serviceToken=synthetic-token',
        );
        assert.deepEqual(connector.parseJSON('&&&START&&&{"ok":true}'), { ok: true });
        assert.equal(connector.safeError({ response: { status: 401, data: 'synthetic-secret' } }), 'Xiaomi request failed (HTTP 401)');
    });
});
