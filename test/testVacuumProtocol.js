const assert = require('node:assert/strict');
const vacuumProtocol = require('../build/lib/vacuumProtocol');

describe('Generic vacuum protocol runtime catalog', () => {
    it('contains every translation and error text', () => {
        assert.deepEqual(vacuumProtocol.i18n, {
            weekDaysFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            notAvailable: 'not available',
            nextTimer: 'next timer',
            loadRooms: 'load rooms from robot',
            cleanRoom: 'clean Room',
            cleanMultiRooms: 'clean assigned rooms',
            addRoom: 'insert map Index or zone coordinates',
            waterBox_installed: 'water box installed',
            waterBox_filter: 'clean water Filter',
            waterBox_filter_reset: 'water filter reset',
            waitingPos: 'waiting position',
        });
        assert.deepEqual(vacuumProtocol.errorTexts, {
            0: 'No error',
            1: 'Laser distance sensor error',
            2: 'Collision sensor error',
            3: 'Wheels on top of void, move robot',
            4: 'Clean hovering sensors, move robot',
            5: 'Clean main brush',
            6: 'Clean side brush',
            7: 'Main wheel stuck?',
            8: 'Device stuck, clean area',
            9: 'Dust collector missing',
            10: 'Clean filter',
            11: 'Stuck in magnetic barrier',
            12: 'Low battery',
            13: 'Charging fault',
            14: 'Battery fault',
            15: 'Wall sensors dirty, wipe them',
            16: 'Place me on flat surface',
            17: 'Side brushes problem, reboot me',
            18: 'Suction fan problem',
            19: 'Unpowered charging station',
        });
    });

    it('contains every cleaning state, resume command, and carpet default', () => {
        assert.deepEqual(vacuumProtocol.cleanStates, {
            Unknown: 0,
            Initiating: 1,
            Sleeping: 2,
            Waiting: 3,
            Remote: 4,
            Cleaning: 5,
            Back_toHome: 6,
            ManuellMode: 7,
            Charging: 8,
            Charging_Error: 9,
            Pause: 10,
            SpotCleaning: 11,
            InError: 12,
            ShuttingDown: 13,
            Updating: 14,
            Docking: 15,
            GoingToSpot: 16,
            ZoneCleaning: 17,
            RoomCleaning: 18,
            DustCollecting: 22,
            CleaningMop: 23,
            GoingMopClean: 26,
        });
        assert.deepEqual(vacuumProtocol.activeCleanStates, {
            5: { name: 'all ', resume: 'app_start' },
            11: { name: 'spot ', resume: 'app_spot' },
            17: { name: 'zone ', resume: 'resume_zoned_clean' },
            18: { name: 'segment ', resume: 'resume_segment_clean' },
            22: { name: 'dust collecting ' },
            23: { name: 'clean mop ' },
            26: { name: 'going to mop clean ' },
        });
        assert.deepEqual(vacuumProtocol.defaultCarpetModeSettings, {
            enabled: 1,
            stall_time: 10,
            low: 400,
            high: 500,
            integral: 450,
        });
    });

    it('keeps all model-independent active states paired with valid cleaning states', () => {
        /** @type {Set<number>} */
        const knownStates = new Set(Object.values(vacuumProtocol.cleanStates));

        for (const [state, definition] of Object.entries(vacuumProtocol.activeCleanStates)) {
            assert.equal(knownStates.has(Number(state)), true);
            assert.equal(typeof definition.name, 'string');
            if (definition.resume !== undefined) {
                assert.equal(typeof definition.resume, 'string');
            }
        }
        assert.equal(vacuumProtocol.cleanStates.Cleaning, 5);
        assert.equal(vacuumProtocol.cleanStates.RoomCleaning, 18);
        assert.equal(vacuumProtocol.activeCleanStates[17].resume, 'resume_zoned_clean');
        assert.equal(vacuumProtocol.activeCleanStates[18].resume, 'resume_segment_clean');
    });

    it('keeps fresh carpet settings isolated per manager-style copy', () => {
        const first = { ...vacuumProtocol.defaultCarpetModeSettings };
        const second = { ...vacuumProtocol.defaultCarpetModeSettings };

        first.enabled = 0;

        assert.equal(second.enabled, 1);
        assert.deepEqual(second, {
            enabled: 1,
            stall_time: 10,
            low: 400,
            high: 500,
            integral: 450,
        });
    });
});
