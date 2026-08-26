const assert = require('node:assert/strict');
const sinon = require('sinon');
const TimerManager = require('../build/lib/timerManager');

function asTimerAdapter(adapter) {
    adapter.setTimeout ??= (callback, delay) => setTimeout(callback, delay);
    adapter.clearTimeout ??= timeout => clearTimeout(timeout);
    adapter.extendObject ??= adapter.setObject ?? (() => undefined);
    return /** @type {import('../src/types/timer').TimerAdapter} */ (/** @type {unknown} */ (adapter));
}

describe('TimerManager lifecycle', () => {
    it('keeps delayed initialization isolated between instances', async () => {
        const clock = sinon.useFakeTimers();
        const createAdapter = () => {
            const writes = { objects: 0, states: 0 };
            return {
                config: { pingInterval: 20_000 },
                namespace: 'mihome-vacuum.test',
                writes,
                log: {
                    debug: () => undefined,
                    warn: () => undefined,
                },
                formatDate: () => '00:00',
                setObjectNotExists: () => writes.objects++,
                getStatesOf: (_channel, callback) => callback(null, []),
                getStates: (_pattern, callback) => callback(null, {}),
                setObject: () => undefined,
                setState: () => writes.states++,
            };
        };
        const i18n = {
            nextTimer: 'Next timer',
            notAvailable: 'not available',
            weekDaysFull: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        };
        const firstAdapter = createAdapter();
        const secondAdapter = createAdapter();
        const firstManager = new TimerManager(asTimerAdapter(firstAdapter), i18n);
        const secondManager = new TimerManager(asTimerAdapter(secondAdapter), i18n);

        try {
            await clock.tickAsync(500);

            assert.deepEqual(firstAdapter.writes, { objects: 1, states: 1 });
            assert.deepEqual(secondAdapter.writes, { objects: 1, states: 1 });
        } finally {
            firstManager.close();
            secondManager.close();
            clock.restore();
        }
    });

    it('cancels its initialization timer once and performs no write after close', async () => {
        const clock = sinon.useFakeTimers();
        let objectWrites = 0;
        let stateWrites = 0;
        const adapter = {
            config: { pingInterval: 20000 },
            setObjectNotExists: () => objectWrites++,
            setState: () => stateWrites++,
        };
        try {
            const manager = new TimerManager(asTimerAdapter(adapter), {
                nextTimer: 'Next timer',
                notAvailable: 'not available',
                weekDaysFull: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            });

            manager.close();
            manager.close();
            await clock.tickAsync(1000);

            assert.equal(objectWrites, 0);
            assert.equal(stateWrites, 0);
            assert.equal(manager.timeouts.size, 0);
        } finally {
            clock.restore();
        }
    });
});

describe('TimerManager TypeScript runtime', () => {
    const translations = {
        nextTimer: 'Next timer',
        notAvailable: 'not available',
        weekDaysFull: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    };

    function createAdapter() {
        const writes = [];
        return {
            adapter: {
                config: { pingInterval: 20_000 },
                namespace: 'mihome-vacuum.test',
                log: {
                    debug: () => undefined,
                    info: () => undefined,
                    warn: () => undefined,
                },
                formatDate: date => `${date.getHours()}:${date.getMinutes()}`,
                setObjectNotExists: (id, object) => writes.push(['setObjectNotExists', id, object]),
                setObject: (id, object) => writes.push(['setObject', id, object]),
                setState: (id, value, acknowledge) => writes.push(['setState', id, value, acknowledge]),
                setForeignState: (_id, _value, _acknowledge, callback) => callback(null, {}),
                getChannelsOf: (_channel, callback) =>
                    callback(null, [{ _id: 'mihome-vacuum.test.rooms.kitchen', common: { name: 'Kitchen' } }]),
                getStatesOf: (_channel, callback) => callback(null, []),
                getStates: (_pattern, callback) => callback(null, {}),
                supportsFeature: () => false,
                getPluginInstance: () => undefined,
            },
            writes,
        };
    }

    it('exposes stable constants and performs delayed initialization writes', async () => {
        const clock = sinon.useFakeTimers();
        const runtime = createAdapter();
        const manager = new TimerManager(asTimerAdapter(runtime.adapter), translations);

        try {
            await clock.tickAsync(500);
            assert.deepEqual(
                [TimerManager.DISABLED, TimerManager.SKIP, TimerManager.ENABLED, TimerManager.START],
                [-1, 0, 1, 2],
            );
            assert.equal(runtime.writes.length, 3);
            assert.deepEqual(
                runtime.writes.map(write => write.slice(0, 2)),
                [
                    ['setObjectNotExists', 'info.nextTimer'],
                    ['setObject', 'timer'],
                    ['setState', 'info.nextTimer'],
                ],
            );
        } finally {
            manager.close();
            clock.restore();
        }
    });

    it('calculates the next run and updates room names', () => {
        const runtime = createAdapter();
        const manager = new TimerManager(asTimerAdapter(runtime.adapter), translations);
        const timerObject = {
            _id: 'mihome-vacuum.test.timer.135_14_30',
            native: { channels: ['kitchen'] },
            common: { name: '', states: {} },
        };
        const now = new Date(2026, 7, 3, 10, 0, 0, 0);

        try {
            const nextProcessTime = manager._calcNextProcessTime(timerObject, now);

            assert.equal(nextProcessTime, timerObject.native.nextProcessTime);
            assert.ok(nextProcessTime instanceof Date);
            assert.equal(nextProcessTime.getFullYear(), 2026);
            assert.equal(nextProcessTime.getMonth(), 7);
            assert.equal(nextProcessTime.getDate(), 3);
            assert.equal(nextProcessTime.getHours(), 14);
            assert.equal(nextProcessTime.getMinutes(), 30);
            assert.equal(timerObject.common.name, 'Mo We Fr 14:30 >Kitchen');
            assert.deepEqual(timerObject.common.states, { 1: 'Mon 14:30' });
            assert.equal(runtime.writes.length, 1);
            assert.deepEqual(runtime.writes[0].slice(0, 2), ['setObject', timerObject._id]);
        } finally {
            manager.close();
        }
    });

    it('keeps the historical invalid persisted-date contract', () => {
        const runtime = createAdapter();
        const manager = new TimerManager(asTimerAdapter(runtime.adapter), translations);
        const timerObject = {
            _id: 'mihome-vacuum.test.timer.1_12_00',
            native: { nextProcessTime: 'invalid' },
            common: { name: '', states: {} },
        };

        try {
            const result = manager._calcNextProcessTime(timerObject, new Date(2026, 7, 3));

            assert.equal(Number.isNaN(Number(result)), true);
            assert.equal(Number.isNaN(Number(timerObject.native.nextProcessTime)), true);
            assert.equal(runtime.writes.length, 0);
        } finally {
            manager.close();
        }
    });
});
