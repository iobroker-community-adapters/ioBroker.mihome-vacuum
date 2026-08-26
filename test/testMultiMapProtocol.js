const assert = require('node:assert/strict');
const multiMapProtocol = require('../build/lib/multiMapProtocol');

describe('Generic multi-map protocol runtime', () => {
    it('preserves map metadata and creates state labels for named and unnamed maps', () => {
        /** @type {import('../src/types/multiMapProtocol').MultiMapResponse} */
        const response = {
            result: [
                {
                    map_info: [
                        { mapFlag: 0, name: 'Ground floor', extra: 'preserved' },
                        { mapFlag: 7, name: '' },
                        { mapFlag: 'backup', name: 'Backup map' },
                    ],
                },
            ],
        };

        const typed = multiMapProtocol.parseMultiMapList(response);

        assert.ok(typed);
        assert.equal(typed.maps[0].extra, 'preserved');
        assert.deepEqual(typed.states, {
            0: 'Ground floor',
            7: '7',
            backup: 'Backup map',
        });
    });

    it('preserves empty lists and unsupported or missing results', () => {
        /** @type {import('../src/types/multiMapProtocol').MultiMapResponse[]} */
        const responses = [{ result: [{ map_info: [] }] }, { result: 'unknown_method' }, {}, { result: null }];

        assert.deepEqual(multiMapProtocol.parseMultiMapList(responses[0]), { maps: [], states: {} });
        for (const response of responses.slice(1)) {
            assert.equal(multiMapProtocol.parseMultiMapList(response), null);
        }
    });

    it('preserves rejection of malformed supported responses', () => {
        /** @type {any} */
        const malformed = { result: [{}] };

        assert.throws(() => multiMapProtocol.parseMultiMapList(malformed), TypeError);
    });
});
