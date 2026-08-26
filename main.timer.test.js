const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

class TimerFakeAdapter extends EventEmitter {
    constructor(options = {}) {
        super();
        this.config = options.config || {};
        this.namespace = 'mihome-vacuum.timer-test';
        this.objects = {};
        this.states = {};
        this.roomObjects = {};
        this.deletedObjects = [];
        this.extendedObjects = [];
        this.stateWrites = [];
        this.foreignObjectWrites = [];
        this.messageResponses = [];
        this.log = {
            debug: () => undefined,
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        };
    }

    async getAdapterObjectsAsync() {
        return this.objects;
    }

    async getStatesAsync() {
        return this.states;
    }

    async getForeignObjectsAsync() {
        return this.roomObjects;
    }

    async delObjectAsync(id) {
        this.deletedObjects.push(id);
        delete this.objects[id];
        delete this.states[id];
    }

    async extendObjectAsync(id, object) {
        const fullId = id.startsWith(`${this.namespace}.`) ? id : `${this.namespace}.${id}`;
        this.extendedObjects.push({ id, object });
        this.objects[fullId] = { _id: fullId, ...object };
    }

    async setStateAsync(id, value, ack) {
        const fullId = id.startsWith(`${this.namespace}.`) ? id : `${this.namespace}.${id}`;
        const val = value && typeof value === 'object' && 'val' in value ? value.val : value;
        this.stateWrites.push({ id, val, ack });
        this.states[fullId] = { val };
    }

    async setForeignObjectAsync(id, object) {
        this.foreignObjectWrites.push({ id, object });
        this.roomObjects[id] = object;
    }

    sendTo(from, command, response, callback) {
        this.messageResponses.push({ from, command, response, callback });
    }
}

function createTimerAdapter() {
    const startAdapter = proxyquire('./build/main', {
        '@iobroker/adapter-core': { Adapter: TimerFakeAdapter },
        './lib/miio': class {},
        './lib/viomi': class {},
        './lib/vacuum': class {},
        './lib/dreame': class {},
        './lib/XiaomiCloudConnector': class {},
    });
    return startAdapter({ config: {} });
}

describe('Adapter timer administration', () => {
    it('loads and reconciles timers, channels, and room memberships', async () => {
        const adapter = createTimerAdapter();
        const oldTimerId = `${adapter.namespace}.timer.012_07_05`;
        const roomId = 'enum.rooms.living';
        adapter.objects = {
            [oldTimerId]: {
                _id: oldTimerId,
                type: 'state',
                common: { name: '012_07_05' },
                native: { channels: ['living'] },
            },
            [`${adapter.namespace}.rooms.living`]: {
                _id: `${adapter.namespace}.rooms.living`,
                type: 'channel',
                common: { name: 'Living room' },
                native: {},
            },
        };
        adapter.states = { [oldTimerId]: { val: 1 } };
        adapter.roomObjects = {
            [roomId]: {
                _id: roomId,
                type: 'enum',
                common: { name: 'Living room', members: [oldTimerId, 'other.0.state'] },
                native: {},
            },
        };

        const loaded = await adapter.getTimersForAdmin();
        assert.deepEqual(loaded.timers, [
            {
                id: '012_07_05',
                enabled: true,
                day: ['0', '1', '2'],
                hour: 7,
                minute: 5,
                channels: ['living'],
                rooms: [roomId],
            },
        ]);
        assert.deepEqual(loaded.channels, [{ id: 'living', name: 'Living room' }]);

        const saved = await adapter.saveTimersFromAdmin([
            {
                day: ['2', '1'],
                hour: 6,
                minute: 3,
                enabled: false,
                channels: ['living'],
                rooms: [roomId],
            },
        ]);
        const newTimerId = `${adapter.namespace}.timer.12_06_03`;

        assert.deepEqual(adapter.deletedObjects, [oldTimerId]);
        assert.equal(adapter.objects[newTimerId].native.nextProcessTime, 0);
        assert.deepEqual(adapter.objects[newTimerId].native.channels, ['living']);
        assert.deepEqual(adapter.states[newTimerId], { val: -1 });
        assert.deepEqual(adapter.roomObjects[roomId].common.members, ['other.0.state', newTimerId]);
        assert.equal(saved.timers[0].id, '12_06_03');
        assert.equal(saved.timers[0].enabled, false);
    });

    it('rejects normalized duplicate start times before writing objects', async () => {
        const adapter = createTimerAdapter();

        await assert.rejects(
            adapter.saveTimersFromAdmin([
                { day: ['2', '1'], hour: 6, minute: 3 },
                { day: ['1', '2'], hour: '06', minute: '03' },
            ]),
            /same start time/,
        );

        assert.deepEqual(adapter.deletedObjects, []);
        assert.deepEqual(adapter.extendedObjects, []);
        assert.deepEqual(adapter.stateWrites, []);
        assert.deepEqual(adapter.foreignObjectWrites, []);
    });

    it('routes timer results and validation errors through the admin message callback', async () => {
        const adapter = createTimerAdapter();
        const callback = { message: 'admin-callback' };

        await adapter.onMessage({
            command: 'getTimers',
            message: {},
            from: 'system.adapter.admin.0',
            callback,
        });
        await adapter.onMessage({
            command: 'saveTimers',
            message: { timers: 'invalid' },
            from: 'system.adapter.admin.0',
            callback,
        });

        assert.deepEqual(adapter.messageResponses[0], {
            from: 'system.adapter.admin.0',
            command: 'getTimers',
            response: { timers: [], rooms: [], channels: [] },
            callback,
        });
        assert.equal(adapter.messageResponses[1].command, 'saveTimers');
        assert.match(adapter.messageResponses[1].response.err, /Timers must be an array/);
        assert.deepEqual(adapter.deletedObjects, []);
        assert.deepEqual(adapter.extendedObjects, []);
    });
});
