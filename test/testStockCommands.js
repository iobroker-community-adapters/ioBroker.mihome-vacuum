const assert = require('node:assert/strict');

const commands = require('../build/lib/stockCommands');

const expectedKeys = [
    'find',
    'start',
    'pause',
    'home',
    'get_status',
    'get_consumable',
    'get_carpet_mode',
    'get_sound_volume',
    'sound_volume',
    'sound_volume_test',
    'fan_power',
    'mop_mode',
    'water_box_mode',
    'clean_summary',
    'miIO_info',
    'clean_record',
    'filter_reset',
    'sensors_reset',
    'main_brush_reset',
    'mop_pad_reset',
    'side_brush_reset',
    'water_filter_reset',
    'strainer_reset',
    'cleaner_filter_reset',
    'dust_collection_reset',
    'spotclean',
    'resumeZoneClean',
    'resumeRoomClean',
    'loadRooms',
    'loadMap',
    'startDustCollect',
    'stopDustCollect',
    'startWashMop',
    'stopWashMop',
];

describe('Stock command runtime catalog', () => {
    it('contains every supported command key in stable order', () => {
        assert.deepEqual(Object.keys(commands), expectedKeys);
    });

    it('keeps the confirmed S5 control methods unchanged', () => {
        assert.deepEqual(commands.find, { method: 'find_me' });
        assert.deepEqual(commands.start, { method: 'app_start' });
        assert.deepEqual(commands.pause, { method: 'app_pause' });
        assert.deepEqual(commands.home, { method: 'app_charge' });
    });

    it('keeps status, mode, room, map, and dock methods unchanged', () => {
        assert.deepEqual(
            Object.fromEntries(
                [
                    'get_status',
                    'get_consumable',
                    'get_carpet_mode',
                    'get_sound_volume',
                    'sound_volume',
                    'sound_volume_test',
                    'fan_power',
                    'mop_mode',
                    'water_box_mode',
                    'clean_summary',
                    'miIO_info',
                    'clean_record',
                    'spotclean',
                    'resumeZoneClean',
                    'resumeRoomClean',
                    'loadRooms',
                    'loadMap',
                    'startDustCollect',
                    'stopDustCollect',
                    'startWashMop',
                    'stopWashMop',
                ].map(key => [key, commands[key].method]),
            ),
            {
                get_status: 'get_status',
                get_consumable: 'get_consumable',
                get_carpet_mode: 'get_carpet_mode',
                get_sound_volume: 'get_sound_volume',
                sound_volume: 'change_sound_volume',
                sound_volume_test: 'test_sound_volume',
                fan_power: 'set_custom_mode',
                mop_mode: 'set_mop_mode',
                water_box_mode: 'set_water_box_custom_mode',
                clean_summary: 'get_clean_summary',
                miIO_info: 'miIO.info',
                clean_record: 'get_clean_record',
                spotclean: 'app_spot',
                resumeZoneClean: 'resume_zoned_clean',
                resumeRoomClean: 'resume_segment_clean',
                loadRooms: 'get_room_mapping',
                loadMap: 'get_map_v1',
                startDustCollect: 'app_start_collect_dust',
                stopDustCollect: 'app_stop_collect_dust',
                startWashMop: 'app_start_wash',
                stopWashMop: 'app_stop_wash',
            },
        );
    });

    it('keeps every consumable reset parameter paired with reset_consumable', () => {
        const resetParameters = {};
        for (const [key, command] of Object.entries(commands)) {
            if (key.endsWith('_reset')) {
                assert.equal(command.method, 'reset_consumable');
                assert.equal(typeof command.params, 'string');
                assert.notEqual(command.params.length, 0);
                resetParameters[key] = command.params;
            }
        }
        assert.deepEqual(resetParameters, {
            filter_reset: 'filter_work_time',
            sensors_reset: 'sensor_dirty_time',
            main_brush_reset: 'main_brush_work_time',
            mop_pad_reset: 'mop_pad_work_time',
            side_brush_reset: 'side_brush_work_time',
            water_filter_reset: 'filter_element_work_time',
            strainer_reset: 'strainer_work_times',
            cleaner_filter_reset: 'cleaning_brush_work_times',
            dust_collection_reset: 'dust_collection_work_times',
        });
    });
});
