const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ViomiManager = require('../build/lib/viomi');

function asViomiAdapter(adapter) {
    return /** @type {import('../src/types/viomi').ViomiAdapter} */ (/** @type {unknown} */ (adapter));
}

function createAdapter() {
    const states = new Map();
    const debugMessages = [];
    return {
        config: { pingInterval: 60_000 },
        states,
        debugMessages,
        log: {
            debug: message => debugMessages.push(String(message)),
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        },
        setTimeout: (callback, delay) => setTimeout(callback, delay),
        clearTimeout: timeout => clearTimeout(timeout),
        async setObjectNotExistsAsync() {},
        async setStateAsync(id, state) {
            states.set(id, state);
        },
    };
}

async function waitForPolling() {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
}

describe('ViomiManager status polling', () => {
    it('waits for all state definitions during initialization', async () => {
        const adapter = createAdapter();
        /** @type {() => void} */
        let releaseWrites = () => undefined;
        const writeGate = new Promise(resolve => {
            releaseWrites = () => resolve(undefined);
        });
        const writtenIds = [];
        adapter.setObjectNotExistsAsync = async id => {
            writtenIds.push(id);
            await writeGate;
        };
        const originalMain = ViomiManager.prototype.main;
        ViomiManager.prototype.main = async () => undefined;
        let manager;
        try {
            manager = new ViomiManager(asViomiAdapter(adapter), { sendMessage: async () => ({}) });
        } finally {
            ViomiManager.prototype.main = originalMain;
        }

        let initializationCompleted = false;
        const initialization = manager.initStates().then(() => {
            initializationCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(writtenIds.includes('control.run_state'), true);
        assert.equal(initializationCompleted, false);

        releaseWrites();
        await initialization;
        assert.equal(initializationCompleted, true);
        await manager.close();
    });

    it('does not log complete Viomi responses', async () => {
        const adapter = createAdapter();
        const manager = new ViomiManager(asViomiAdapter(adapter), {
            sendMessage: async () => ({ result: ['SENSITIVE_VIOMI_MARKER'] }),
        });

        await waitForPolling();
        await manager.close();

        assert.equal(adapter.debugMessages.join('\n').includes('SENSITIVE_VIOMI_MARKER'), false);
    });

    it('keeps adapter state and latest properties isolated between instances', async () => {
        const firstAdapter = createAdapter();
        const secondAdapter = createAdapter();
        const firstCalls = [];
        const secondCalls = [];
        const createMiio = (calls, mode) => ({
            sendMessage: async (method, params) => {
                calls.push({ method, params });
                if (method !== 'get_prop') {
                    return { result: ['ok'] };
                }
                const result = new Array(22).fill(0);
                result[2] = mode;
                result[17] = 0;
                return { result };
            },
        });
        const firstManager = new ViomiManager(asViomiAdapter(firstAdapter), createMiio(firstCalls, 2));
        await waitForPolling();
        const secondManager = new ViomiManager(asViomiAdapter(secondAdapter), createMiio(secondCalls, 3));
        await waitForPolling();

        await firstManager.stateChange('mihome-vacuum.0.control.start', { val: true, ack: false });
        await firstManager.close();
        await secondManager.close();

        assert.deepEqual(firstCalls[firstCalls.length - 1], {
            method: 'set_mode_withroom',
            params: [2, 1, 0],
        });
        assert.deepEqual(firstAdapter.states.get('mihome-vacuum.0.control.start'), { val: true, ack: true });
        assert.equal(secondAdapter.states.has('mihome-vacuum.0.control.start'), false);
    });

    it('does not process or reschedule an in-flight poll after close', async () => {
        const adapter = createAdapter();
        /** @type {(value: any) => void} */
        let resolvePoll = _value => undefined;
        const pollStarted = new Promise(resolve => {
            resolvePoll = resolve;
        });
        /** @type {(value: any) => void} */
        let releasePoll = _value => undefined;
        const pollResult = new Promise(resolve => {
            releasePoll = resolve;
        });
        const manager = new ViomiManager(asViomiAdapter(adapter), {
            sendMessage: async () => {
                resolvePoll(undefined);
                return pollResult;
            },
        });

        await pollStarted;
        await manager.close();
        releasePoll({ result: [5, 3] });
        await waitForPolling();

        assert.equal(adapter.states.size, 0);
        assert.deepEqual(manager.globalTimeouts, {});
    });

    it('maps a get_prop response to matching Viomi states', async () => {
        const adapter = createAdapter();
        const miio = {
            sendMessage: async () => ({
                result: [5, 3, 1, 2105, 80, 0, '0', 30, 42, 10, '0', 0, 1, 1, 2, 1, 1, 0, 1, 1, 0, 1],
            }),
        };
        const manager = new ViomiManager(asViomiAdapter(adapter), miio);

        await waitForPolling();
        await manager.close();

        assert.deepEqual(adapter.states.get('control.run_state'), { val: 5, ack: true });
        assert.deepEqual(adapter.states.get('control.suction_grade'), { val: 3, ack: true });
        assert.deepEqual(adapter.states.get('control.battary_life'), { val: 80, ack: true });
        assert.deepEqual(adapter.states.get('control.light_state'), { val: true, ack: true });
    });

    it('updates available values from a shorter response without reading beyond it', async () => {
        const adapter = createAdapter();
        const manager = new ViomiManager(asViomiAdapter(adapter), {
            sendMessage: async () => ({ result: [5, 2] }),
        });

        await waitForPolling();
        await manager.close();

        assert.deepEqual([...adapter.states.keys()].sort(), ['control.run_state', 'control.suction_grade']);
    });

    it('ignores a malformed non-array result', async () => {
        const adapter = createAdapter();
        const manager = new ViomiManager(asViomiAdapter(adapter), {
            sendMessage: async () => ({ result: { unexpected: true } }),
        });

        await waitForPolling();
        await manager.close();

        assert.equal(adapter.states.size, 0);
    });
});

describe('ViomiManager TypeScript runtime', () => {
    function createIdleManager(Manager, adapter, miio) {
        const originalMain = Manager.prototype.main;
        Manager.prototype.main = async () => undefined;
        try {
            return new Manager(adapter, miio);
        } finally {
            Manager.prototype.main = originalMain;
        }
    }

    it('matches the reviewed protocol catalogs and state definitions', async () => {
        const manager = createIdleManager(ViomiManager, createAdapter(), { sendMessage: async () => ({}) });
        const catalogs = {
            ViomiDevices: manager.ViomiDevices,
            PARAMS: manager.PARAMS,
            ERROR_CODES: manager.ERROR_CODES,
            STATES: manager.STATES,
            FANSPEED: manager.FANSPEED,
            MODE: manager.MODE,
        };
        const digest = crypto.createHash('sha256').update(JSON.stringify(catalogs)).digest('hex');

        assert.equal(digest, 'da2dba11838e839001488a6a286dee14cc26ddb7278981075fe20b416a735584');
        assert.equal(manager.PARAMS.length, 22);
        assert.equal(Object.keys(manager.STATES).length, 8);
        await manager.close();
    });

    it('creates polling objects, state values, and safe logs', async () => {
        const result = [5, 3, 1, 2105, 80, 0, '0', 30, 42, 10, '0', 0, 1, 1, 2, 1, 1, 0, 1, 1, 0, 1];
        const adapter = createAdapter();
        const objectIds = [];
        adapter.setObjectNotExistsAsync = async id => {
            objectIds.push(id);
        };
        const manager = new ViomiManager(asViomiAdapter(adapter), {
            sendMessage: async () => ({ result: [...result] }),
        });

        await waitForPolling();
        await manager.close();

        assert.equal(objectIds.length, 20);
        assert.equal(objectIds.includes('control.run_state'), true);
        assert.equal(objectIds.includes('control.light_state'), true);
        assert.deepEqual(adapter.states.get('control.run_state'), { val: 5, ack: true });
        assert.deepEqual(adapter.states.get('control.battary_life'), { val: 80, ack: true });
        assert.equal(manager.lastProps.mode, 1);
        assert.equal(adapter.debugMessages.some(message => message.includes(JSON.stringify(result))), false);
    });

    it('preserves every supported command branch and acknowledgement', async () => {
        const cases = [
            ['suction_grade', 2, {}, 'set_suction', [2]],
            ['water_grade', 3, {}, 'set_suction', [3]],
            ['is_mop', 1, {}, 'set_mop', [1]],
            ['light_state', true, {}, 'set_light', [1]],
            ['start', true, { mode: 2 }, 'set_mode_withroom', [2, 1, 0]],
            ['start', true, { mode: 0, is_mop: 2 }, 'set_mode_withroom', [3, 1, 0]],
            ['start', true, { mode: 3 }, 'set_mode', [3, 1]],
            ['pause', true, { mode: 0, is_mop: 1 }, 'set_mode_withroom', [1, 3, 0]],
            ['pause', true, { mode: 3 }, 'set_mode', [3, 3]],
            ['stop', true, { mode: 3 }, 'set_mode', [3, 0]],
            ['stop', true, { mode: 0, is_mop: 4 }, 'set_pointclean', [0, 0, 0]],
            ['stop', true, { mode: 0, is_mop: 0 }, 'set_mode', [0]],
            ['return_dock', true, {}, 'set_charge', [1]],
        ];

        for (const [command, value, properties, expectedMethod, expectedParams] of cases) {
            const adapter = createAdapter();
            const calls = [];
            const manager = createIdleManager(ViomiManager, adapter, {
                sendMessage: async (method, params) => {
                    calls.push({ method, params });
                    return { result: ['ok'] };
                },
            });
            Object.assign(manager.lastProps, properties);
            const id = `mihome-vacuum.0.control.${command}`;

            await manager.stateChange(id, { val: value, ack: false });

            assert.deepEqual(calls, [{ method: expectedMethod, params: expectedParams }]);
            assert.deepEqual(adapter.states.get(id), { val: value, ack: true });
            await manager.close();
        }
    });

    it('preserves ignored writes, blocked mode, and safe command failures', async () => {
        const runScenario = async Manager => {
            const warnings = [];
            const adapter = createAdapter();
            adapter.log.warn = message => {
                warnings.push(String(message));
                return undefined;
            };
            const calls = [];
            const manager = createIdleManager(Manager, adapter, {
                sendMessage: async (method, params) => {
                    calls.push({ method, params });
                    throw new Error('synthetic-sensitive-command-failure');
                },
            });
            await manager.stateChange('mihome-vacuum.0.control.start', { val: true, ack: true });
            manager.lastProps.mode = 4;
            await manager.stateChange('mihome-vacuum.0.control.start', { val: true, ack: false });
            await manager.stateChange('mihome-vacuum.0.control.unknown', { val: true, ack: false });
            await manager.stateChange('mihome-vacuum.0.control.return_dock', { val: true, ack: false });
            await manager.close();
            await manager.close();
            return { calls, warnings, states: [...adapter.states], timeouts: manager.globalTimeouts };
        };

        const result = await runScenario(ViomiManager);

        assert.deepEqual(result.calls, [{ method: 'set_charge', params: [1] }]);
        assert.deepEqual(result.timeouts, {});
        assert.equal(JSON.stringify(result).includes('synthetic-sensitive-command-failure'), false);
    });
});
