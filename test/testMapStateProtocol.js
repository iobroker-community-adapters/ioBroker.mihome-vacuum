const assert = require('node:assert/strict');
const mapStateProtocol = require('../build/lib/mapStateProtocol');

describe('Generic map-state protocol runtime', () => {
    it('creates S5/S5e fallback rooms for numeric and string IDs', () => {
        const roomIds = [16, 21, 'custom'];

        assert.deepEqual(mapStateProtocol.createFallbackRooms(roomIds), [
            [16, 'room16'],
            [21, 'room21'],
            ['custom', 'roomcustom'],
        ]);
    });

    it('preserves zone-change detection, serialization, and in-place repeat mutation', () => {
        const scenarios = [
            { zones: [[1, 2, 3, 4]], last: [[0, 0, 0, 0]], expected: true },
            { zones: [[1, 9, 8, 7]], last: [[1, 0, 0, 0]], expected: false },
            { zones: [], last: [[0]], expected: false },
            { zones: undefined, last: [[0]], expected: false },
        ];

        for (const scenario of scenarios) {
            assert.equal(mapStateProtocol.shouldUpdateZones(scenario.zones, scenario.last), scenario.expected);
        }

        const zones = [[1, 2, 3, 4], [5, 6, 7, 8]];
        assert.equal(mapStateProtocol.createZoneStateValue(zones), '[1,2,3,4,1],[5,6,7,8,1]');
        assert.equal(mapStateProtocol.createZoneStateValue([[1, 2, 3, 4]]), '[1,2,3,4,1]');
        assert.deepEqual(zones, [[1, 2, 3, 4, 1], [5, 6, 7, 8, 1]]);
    });

    it('preserves go-to change detection and comma-separated state values', () => {
        const scenarios = [
            { goTo: [1234, 5678], last: [], expected: true },
            { goTo: [1234, 9999], last: [1234, 5678], expected: false },
            { goTo: [], last: [], expected: false },
            { goTo: undefined, last: [], expected: false },
        ];

        for (const scenario of scenarios) {
            assert.equal(mapStateProtocol.shouldUpdateGoTo(scenario.goTo, scenario.last), scenario.expected);
        }
        assert.equal(mapStateProtocol.createGoToStateValue([1234, 5678]), '1234,5678');
    });
});
