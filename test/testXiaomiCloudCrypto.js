const assert = require('node:assert/strict');
const cloudCrypto = require('../build/lib/XiaomiCloudCrypto');
const XiaomiCloudConnector = require('../build/lib/XiaomiCloudConnector');

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

describe('Xiaomi Cloud cryptography runtime', () => {
    const millis = 1_700_000_000_000;
    const nonce = 'AAECAwQFBgcBsFUV';
    const ssecurity = Buffer.alloc(16, 1).toString('base64');
    const expectedSignedNonce = 'cpjbFUb//hR2sAgYryNz/jjsqNrczR7MZlCwjyhHe8o=';
    const url = 'https://de.api.io.mi.com/app/home/getmapfileurl';
    const params = { data: '{"obj_name":"synthetic-map"}' };

    it('matches nonce, signed nonce, and request signature fixtures', () => {
        const randomBytes = () => Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
        assert.equal(cloudCrypto.generateNonce(millis, randomBytes), nonce);

        assert.equal(cloudCrypto.signedNonce(nonce, ssecurity), expectedSignedNonce);
        assert.equal(
            cloudCrypto.generateEncSignature(url, 'POST', expectedSignedNonce, params),
            'A8gwUO8rQZNJw949YdZdceeIpwQ=',
        );
    });

    it('preserves RC4-drop-1024 encryption and decryption bytes', () => {
        const plainText = 'synthetic-cloud-payload';
        const expectedCipherText = 'JlWLhwAPv/HfHfm7u4efpcm6/Lkk4aI=';
        const cipherText = new cloudCrypto.XiaomiRC4Cipher(expectedSignedNonce).encrypt(plainText);

        assert.equal(cipherText, expectedCipherText);
        assert.equal(new cloudCrypto.XiaomiRC4Cipher(expectedSignedNonce).decrypt(expectedCipherText), plainText);
    });

    it('preserves encrypted parameter order and signatures', () => {
        const encrypted = cloudCrypto.generateEncryptedParams(
            new cloudCrypto.XiaomiRC4Cipher(expectedSignedNonce),
            url,
            'POST',
            nonce,
            structuredClone(params),
            ssecurity,
        );
        const expected = {
            data: 'Lg6KkQI1pfnRVbjt9oGC5s2z4KEi4+sgr02kiQ==',
            rc4_hash__: 'EUFfTiLB6W7+INfBkjkWVmKb0OMko35bL+ze0A==',
            signature: 'vvvCRTG/gZS2M3r0KCdNRySTyU8=',
            ssecurity,
            _nonce: nonce,
        };

        assert.deepEqual(encrypted, expected);
        assert.deepEqual(Object.keys(encrypted), ['data', 'rc4_hash__', 'signature', 'ssecurity', '_nonce']);
    });

    it('keeps the connector compatibility methods delegated to the extracted module', () => {
        const connector = new XiaomiCloudConnector(
            { debug() {}, info() {}, warn() {}, error() {} },
            {},
            createAdapter(),
        );

        assert.equal(connector.signedNonce(nonce, ssecurity), expectedSignedNonce);
        assert.equal(
            connector.generateEncSignature(url, 'POST', expectedSignedNonce, params),
            'A8gwUO8rQZNJw949YdZdceeIpwQ=',
        );
    });
});
