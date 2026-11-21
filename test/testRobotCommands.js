const assert = require('node:assert/strict');

const { robotCommand, robotState } = require('../build/lib/robotCommands');

const NS = 'mihome-vacuum.0';

/** A fake instance with room channels: two assigned to ioBroker rooms, one zone added by hand, one unknown */
function createAdapter() {
    return {
        namespace: NS,
        getForeignObjectsAsync: async (pattern, type) => {
            if (pattern === 'enum.rooms.*') {
                return {
                    'enum.rooms.kitchen': {
                        _id: 'enum.rooms.kitchen',
                        common: { name: { en: 'Kitchen', de: 'Küche' }, members: [`${NS}.rooms.16`] },
                    },
                    'enum.rooms.hall': {
                        _id: 'enum.rooms.hall',
                        common: { name: 'Hall', members: [`${NS}.rooms.17.mapIndex`, `${NS}.rooms.manual_1`] },
                    },
                };
            }
            assert.equal(type, 'channel');
            return {
                [`${NS}.rooms.16`]: { _id: `${NS}.rooms.16`, common: { name: '16' } },
                [`${NS}.rooms.17`]: { _id: `${NS}.rooms.17`, common: { name: '17' } },
                [`${NS}.rooms.manual_1`]: { _id: `${NS}.rooms.manual_1`, common: { name: 'manual_1' } },
                [`${NS}.rooms.20`]: { _id: `${NS}.rooms.20`, common: { name: 'Bath' } },
                [`${NS}.rooms.99`]: { _id: `${NS}.rooms.99`, common: { name: 'Gone' } },
            };
        },
        getForeignStatesAsync: async () => ({
            [`${NS}.rooms.16.mapIndex`]: { val: 16 },
            [`${NS}.rooms.17.mapIndex`]: { val: 17 },
            [`${NS}.rooms.manual_1.mapIndex`]: { val: '[25000,25000,26000,26000,1]' },
            [`${NS}.rooms.20.mapIndex`]: { val: 20 },
            [`${NS}.rooms.99.mapIndex`]: { val: 'not available' },
        }),
        getForeignObjectAsync: async () => ({ common: { language: 'de' } }),
    };
}

/** A fake Roborock manager (lib/vacuum.ts onMessage) that records the messages it gets */
function createVacuum(answers = {}) {
    const calls = [];
    return {
        calls,
        activeChannels: null,
        async onMessage(obj) {
            calls.push(obj);
            if (obj.command in answers) {
                const answer = answers[obj.command];
                if (answer instanceof Error) {
                    throw answer;
                }
                return answer;
            }
            return { id: 1, result: ['ok'] };
        },
    };
}

describe('robot commands of the shared catalog', () => {
    it('getRooms lists the room channels by the name of their ioBroker room', async () => {
        const answer = await robotCommand(createAdapter(), null, { command: 'getRooms' });
        assert.deepEqual(answer, {
            rooms: [
                { id: `${NS}.rooms.16`, name: 'Küche', room: 'enum.rooms.kitchen', segment: 16 },
                { id: `${NS}.rooms.17`, name: 'Hall', room: 'enum.rooms.hall', segment: 17 },
                {
                    id: `${NS}.rooms.manual_1`,
                    name: 'Hall',
                    room: 'enum.rooms.hall',
                    zone: '[25000,25000,26000,26000,1]',
                },
                { id: `${NS}.rooms.20`, name: 'Bath', segment: 20 },
            ],
        });
    });

    it('clean maps names, ioBroker rooms and segments onto cleanSegments and cleanZone', async () => {
        const vacuum = createVacuum();
        const answer = await robotCommand(createAdapter(), vacuum, {
            command: 'clean',
            message: { rooms: ['küche', 'enum.rooms.hall', 20], fanSpeed: 102, mode: 'ignored' },
        });
        assert.deepEqual(answer, { ok: true, rooms: ['Küche', 'Hall', 'Bath'] });
        assert.deepEqual(vacuum.calls, [
            {
                command: 'cleanSegments',
                message: { segments: [16, 17, 20], channels: [`${NS}.rooms.16`, `${NS}.rooms.17`, `${NS}.rooms.20`] },
                fanSpeed: 102,
            },
            {
                command: 'cleanZone',
                message: { zones: ['[25000,25000,26000,26000,1]'], channels: [`${NS}.rooms.manual_1`] },
                fanSpeed: 102,
            },
        ]);
    });

    it('clean takes a text list and partial names, and reports a queued job as pending', async () => {
        // startCleaning put the job into the queue: cleanSegments answers nothing
        const vacuum = createVacuum({ cleanSegments: undefined });
        const answer = await robotCommand(createAdapter(), vacuum, { command: 'clean', message: { rooms: 'Bat, 16' } });
        assert.deepEqual(answer, { ok: true, pending: true, rooms: ['Bath', 'Küche'] });
        assert.deepEqual(vacuum.calls[0].message.segments, [20, 16]);
    });

    it('clean without rooms cleans everything', async () => {
        const vacuum = createVacuum();
        assert.deepEqual(await robotCommand(createAdapter(), vacuum, { command: 'clean', message: {} }), {
            ok: true,
            all: true,
            rooms: [],
        });
        assert.deepEqual(
            vacuum.calls.map(c => c.command),
            ['startVacuuming'],
        );
    });

    it('clean refuses unknown and ambiguous rooms without moving the robot', async () => {
        const vacuum = createVacuum();
        const unknown = await robotCommand(createAdapter(), vacuum, {
            command: 'clean',
            message: { rooms: ['Garage'] },
        });
        assert.equal(unknown.reason, 'NOT_FOUND');
        assert.deepEqual(unknown.candidates, ['Küche', 'Hall', 'Bath']);
        assert.equal(typeof unknown.error, 'string');
        const ambiguous = await robotCommand(createAdapter(), vacuum, { command: 'clean', message: { rooms: 'a' } });
        assert.equal(ambiguous.reason, 'AMBIGUOUS');
        assert.deepEqual(ambiguous.candidates, ['Hall', 'Bath']);
        assert.deepEqual(vacuum.calls, []);
    });

    it('pause, stop and home call pause, stopVacuuming and charge', async () => {
        const vacuum = createVacuum();
        for (const command of ['pause', 'stop', 'home']) {
            assert.deepEqual(await robotCommand(createAdapter(), vacuum, { command }), {
                id: 1,
                result: ['ok'],
                ok: true,
            });
        }
        assert.deepEqual(
            vacuum.calls.map(c => c.command),
            ['pause', 'stopVacuuming', 'charge'],
        );
    });

    it('answers failures as {error, reason}', async () => {
        const timeout = Object.assign(new Error('MIIO request timed out'), { code: 'MIIO_TIMEOUT' });
        const vacuum = createVacuum({ pause: timeout, charge: { error: { code: -1, message: 'busy' } } });
        assert.deepEqual(await robotCommand(createAdapter(), vacuum, { command: 'pause' }), {
            error: 'MIIO request timed out',
            reason: 'TIMEOUT',
        });
        assert.deepEqual(await robotCommand(createAdapter(), vacuum, { command: 'home' }), {
            error: 'The robot refused the command: busy',
            reason: 'ROBOT_ERROR',
            code: -1,
        });
        assert.equal((await robotCommand(createAdapter(), null, { command: 'stop' })).reason, 'NOT_CONNECTED');
        // Viomi and Dreame managers have no onMessage
        assert.equal((await robotCommand(createAdapter(), {}, { command: 'stop' })).reason, 'NOT_SUPPORTED');
    });

    it('getStatus adds the state of the catalog to the raw values', async () => {
        const raw = { state: 18, battery: 76, error_code: 0, clean_time: 120 };
        const vacuum = createVacuum({ getStatus: { id: 3, result: [raw] } });
        vacuum.activeChannels = [`${NS}.rooms.16`];
        assert.deepEqual(await robotCommand(createAdapter(), vacuum, { command: 'getStatus' }), {
            id: 3,
            result: [raw],
            state: 'cleaning',
            stateCode: 18,
            battery: 76,
            room: 'Küche',
        });
        const stuck = createVacuum({ getStatus: { id: 4, result: [{ state: 12, battery: 50, error_code: 5 }] } });
        const answer = await robotCommand(createAdapter(), stuck, { command: 'getStatus' });
        assert.equal(answer.state, 'error');
        assert.equal(answer.error, 'Clean main brush');
    });

    it('maps the states of the robot', () => {
        assert.equal(robotState(8, 60), 'charging');
        assert.equal(robotState(8, 100), 'docked');
        assert.equal(robotState(6), 'returning');
        assert.equal(robotState(10), 'paused');
        assert.equal(robotState(3), 'idle');
    });
});
