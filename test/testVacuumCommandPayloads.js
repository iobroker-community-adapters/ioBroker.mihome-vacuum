const assert = require('node:assert/strict');
const commandPayloads = require('../build/lib/vacuumCommandPayloads');

describe('Generic vacuum command-payload runtime', () => {
    it('parses valid integer, decimal, whitespace, and hexadecimal go-to values', () => {
        const values = ['1234,5678', ' 1234 , 5678 ', '1234.9,5678.2', '0x10,020'];

        assert.deepEqual(
            values.map(value => commandPayloads.parseGoToCoordinates(value)),
            [
                { coordinates: [1234, 5678], error: null },
                { coordinates: [1234, 5678], error: null },
                { coordinates: [1234, 5678], error: null },
                { coordinates: [16, 20], error: null },
            ],
        );
    });

    it('preserves argument-count and numeric validation errors', () => {
        const values = ['', '1234', '1,2,3', 'x,2', '1,NaN'];

        assert.deepEqual(
            values.map(value => commandPayloads.parseGoToCoordinates(value)),
            [
                { coordinates: null, error: 'argument_count' },
                { coordinates: null, error: 'argument_count' },
                { coordinates: null, error: 'argument_count' },
                { coordinates: null, error: 'invalid_coordinate' },
                { coordinates: null, error: 'invalid_coordinate' },
            ],
        );
    });

    it('preserves the nested app_rc_move payload and unknown value types', () => {
        const scenarios = [
            { velocity: 0.3, angularVelocity: -0.4, duration: 1500, sequenceNumber: 17 },
            { velocity: '0.3', angularVelocity: null, duration: undefined, sequenceNumber: '17' },
        ];

        assert.deepEqual(commandPayloads.createRemoteMovePayload(scenarios[0]), [
            [{ omega: -0.4, velocity: 0.3, seqnum: 17, duration: 1500 }],
        ]);
        assert.deepEqual(commandPayloads.createRemoteMovePayload(scenarios[1]), [
            [{ omega: null, velocity: '0.3', seqnum: '17', duration: undefined }],
        ]);
    });
});
