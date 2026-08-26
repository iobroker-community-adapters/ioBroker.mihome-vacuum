const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

function loadToolsWithAxios(modulePath, fakeAxios) {
    return proxyquire(modulePath, {
        axios: { __esModule: true, default: fakeAxios },
    });
}

describe('Shared tools TypeScript runtime', () => {
    it('preserves the dedicated Google Translate rate-limit error', async () => {
        const rateLimitError = { response: { status: 429 } };
        const fakeAxios = async () => {
            throw rateLimitError;
        };
        fakeAxios.isAxiosError = error => error === rateLimitError;
        const tools = loadToolsWithAxios('../build/lib/tools', fakeAxios);

        await assert.rejects(tools.translateText('test', 'de'), /Rate-limited by Google Translate/);
    });

    it('does not classify arbitrary failures as Axios rate limits', async () => {
        const fakeAxios = async () => {
            throw new Error('synthetic translation failure');
        };
        fakeAxios.isAxiosError = () => false;
        const tools = loadToolsWithAxios('../build/lib/tools', fakeAxios);

        await assert.rejects(tools.translateText('test', 'de'), /synthetic translation failure/);
    });

    it('distinguishes plain objects from arrays and null', () => {
        const fakeAxios = Object.assign(async () => ({}), { isAxiosError: () => false });
        const tools = loadToolsWithAxios('../build/lib/tools', fakeAxios);

        assert.equal(tools.isObject({}), true);
        assert.equal(tools.isObject([]), false);
        assert.equal(tools.isObject(null), false);
        assert.equal(tools.isArray([]), true);
        assert.equal(tools.isArray({}), false);
    });
});
