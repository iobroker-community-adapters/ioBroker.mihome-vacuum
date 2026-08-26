const assert = require('node:assert/strict');
const networkInfoProtocol = require('../build/lib/networkInfoProtocol');

describe('Generic network-info protocol runtime', () => {
    it('returns numeric and string RSSI values without conversion', () => {
        const responses = [
            { result: { rssi: -39, ssid: 'not-returned-by-parser' } },
            { result: { rssi: '-52' } },
        ];

        assert.equal(networkInfoProtocol.parseWifiSignal(responses[0]), -39);
        assert.equal(networkInfoProtocol.parseWifiSignal(responses[1]), '-52');
    });

    it('preserves unsupported, missing, null, zero, and empty RSSI handling', () => {
        /** @type {import('../src/types/networkInfoProtocol').NetworkInfoResponse[]} */
        const responses = [
            { result: 'unknown_method' },
            {},
            { result: null },
            { result: {} },
            { result: { rssi: 0 } },
            { result: { rssi: '' } },
        ];

        for (const response of responses) {
            assert.equal(networkInfoProtocol.parseWifiSignal(response), null);
        }
    });

    it('preserves unknown truthy RSSI value types', () => {
        const marker = { synthetic: true };
        const response = { result: { rssi: marker } };

        assert.equal(networkInfoProtocol.parseWifiSignal(response), marker);
    });
});
