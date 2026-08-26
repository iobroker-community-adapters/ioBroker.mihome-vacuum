const assert = require('node:assert/strict');
const roomMappingProtocol = require('../build/lib/roomMappingProtocol');

describe('Generic room-mapping protocol runtime', () => {
    it('returns non-empty room arrays with their original reference', () => {
        const rooms = [[16, 'Living room'], [17, 'Kitchen']];
        const response = { result: rooms };
        const typed = roomMappingProtocol.parseRoomMapping(response);

        assert.equal(typed, rooms);
    });

    it('preserves unsupported empty, missing, null, and unknown-method responses', () => {
        const responses = [{ result: [] }, {}, { result: null }, { result: false }, { result: 'unknown_method' }];

        for (const response of responses) {
            assert.equal(roomMappingProtocol.parseRoomMapping(response), null);
        }
    });

    it('preserves historical acceptance of other truthy values with a length', () => {
        const responses = [
            { result: 'synthetic-room-map' },
            { result: { 0: [16, 'Living room'], length: 1 } },
        ];

        for (const response of responses) {
            assert.equal(roomMappingProtocol.parseRoomMapping(response), response.result);
        }
        assert.equal(roomMappingProtocol.parseRoomMapping({ result: 42 }), null);
    });
});
