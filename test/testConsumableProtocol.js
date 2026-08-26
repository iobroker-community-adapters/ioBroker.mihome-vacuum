const assert = require('node:assert/strict');
const objects = require('../build/lib/objects');
const commands = require('../build/lib/stockCommands');
const consumableProtocol = require('../build/lib/consumableProtocol');

function createConsumableValues() {
    return {
        filter_work_time: 2700,
        sensor_dirty_time: 1080,
        main_brush_work_time: 5400,
        mop_pad_work_time: 1440,
        side_brush_work_time: 3600,
        filter_element_work_time: 1800,
        strainer_work_times: 12,
        cleaning_brush_work_times: 5,
        dust_collection_work_times: 7,
    };
}

describe('Generic consumable protocol runtime', () => {
    it('detects consumables against the complete runtime object and command catalogs', () => {
        const values = createConsumableValues();
        const detected = consumableProtocol.detectConsumables(values, objects.stockConsumable.list, commands);

        assert.deepEqual(
            detected.map(feature => feature.id),
            ['filter', 'main_brush', 'mop_pad', 'sensors', 'side_brush', 'water_filter', 'strainer', 'dust_collection'],
        );
        assert.deepEqual(
            detected.map(feature => feature.name),
            [
                'filter_work_time',
                'main_brush_work_time',
                'mop_pad_work_time',
                'sensor_dirty_time',
                'side_brush_work_time',
                'filter_element_work_time',
                'strainer_work_times',
                'dust_collection_work_times',
            ],
        );
        assert.equal(detected.some(feature => feature.id === 'cleaning_brush'), false);
    });

    it('preserves zero values while excluding missing, null, and undefined values', () => {
        const scenarios = [
            { filter_work_time: 0 },
            { filter_work_time: null },
            { filter_work_time: undefined },
            {},
        ];

        assert.deepEqual(
            scenarios.map(
                values => consumableProtocol.detectConsumables(values, objects.stockConsumable.list, commands).length,
            ),
            [1, 0, 0, 0],
        );
    });

    it('preserves percentage calculation, negative lifetime, and raw counters', () => {
        const values = createConsumableValues();
        const features = consumableProtocol.detectConsumables(values, objects.stockConsumable.list, commands);

        assert.deepEqual(
            features.map(feature => consumableProtocol.calculateConsumableValue(values, feature)),
            [99, 99, 99, 99, 99, 99, 12, 7],
        );
        assert.equal(
            consumableProtocol.calculateConsumableValue({ filter_work_time: 600000 }, features[0]),
            -11,
        );
        const strainer = features.find(feature => feature.id === 'strainer');
        assert.ok(strainer);
        assert.equal(consumableProtocol.calculateConsumableValue(values, strainer), 12);
    });
});
