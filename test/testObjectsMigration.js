const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const objects = structuredClone(require('../build/lib/objects'));

describe('ioBroker object TypeScript runtime catalog', () => {
    it('matches the reviewed complete recursive catalog fixture', () => {
        const digest = crypto.createHash('sha256').update(JSON.stringify(objects)).digest('hex');

        assert.equal(digest, '50d814aecdd313ea2fce1068139311fc1ac5d96d8a28da7f2f12fe2a74137fec');
    });

    it('preserves every top-level catalog consumed by runtime managers', () => {
        assert.deepEqual(Object.keys(objects), [
            'deviceInfo',
            'iotState',
            'customCommands',
            'viomiObjects',
            'stockConsumable',
            'stockControl',
            'enableResumeZone',
            'roomStates',
            'stockInfo',
            'stockHistory',
            'newfan_power',
            'water_box',
            'mop',
            'mop_mode',
            'water_box_mode',
            'water_box_level',
            'dock_status',
            'carpet_mode',
            'dustCollect',
            'washMop',
            'mapObjects',
            'settings',
            'wash_base',
            'wash_base_info',
        ]);
    });

    it('keeps critical state contracts explicit', () => {
        assert.deepEqual(objects.newfan_power.common, {
            name: 'Suction power',
            type: 'number',
            role: 'level.suction',
            read: true,
            write: true,
            min: 101,
            max: 106,
            states: {
                101: 'QUIET',
                102: 'BALANCED',
                103: 'TURBO',
                104: 'MAXIMUM',
                106: 'CUSTOM',
            },
        });
        const wifiSignal = objects.deviceInfo.find(definition => definition._id === 'wifi_signal');
        assert.ok(wifiSignal);
        assert.deepEqual(wifiSignal.common, {
            name: 'Wifi RSSI',
            type: 'number',
            role: 'value.signal.wifi',
            def: 0,
            read: true,
            write: false,
            unit: 'dBm',
            desc: 'Wifi signal of the vacuum roboter',
        });
    });
});
