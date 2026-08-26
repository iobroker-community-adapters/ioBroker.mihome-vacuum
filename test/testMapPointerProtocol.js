const assert = require('node:assert/strict');
const mapPointerProtocol = require('../build/lib/mapPointerProtocol');

describe('Generic map-pointer protocol runtime', () => {
    it('accepts ready pointers with exactly three percent-separated parts', () => {
        const pointers = ['synthetic-host%synthetic-token%synthetic-file', 'a%%c'];

        for (const pointer of pointers) {
            const response = { result: [pointer] };
            assert.deepEqual(mapPointerProtocol.parseMapPointerResponse(response), { action: 'ready', pointer });
        }
    });

    it('handles map-slot stop and all retry decisions', () => {
        const responses = [
            { result: ['map_slot_2'] },
            {},
            { result: null },
            { result: false },
            { result: ['retry'] },
            { result: ['a%b'] },
            { result: ['a%b%c%d'] },
            { result: 'unknown_method' },
        ];

        assert.deepEqual(
            responses.map(response => mapPointerProtocol.parseMapPointerResponse(response)),
            [
                { action: 'stop' },
                { action: 'retry' },
                { action: 'retry' },
                { action: 'retry' },
                { action: 'retry' },
                { action: 'retry' },
                { action: 'retry' },
                { action: 'retry' },
            ],
        );
    });

    it('rejects malformed truthy result containers', () => {
        const responses = [{ result: [] }, { result: [42] }, { result: {} }];

        for (const response of responses) {
            assert.throws(() => mapPointerProtocol.parseMapPointerResponse(response), TypeError);
        }
    });
});
