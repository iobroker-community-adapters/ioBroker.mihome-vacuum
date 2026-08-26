const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const DreameManager = require('../build/lib/dreame');

function createAdapter() {
    const states = new Map();
    const debugMessages = [];
    return {
        config: { pingInterval: 60_000 },
        namespace: 'mihome-vacuum.test',
        states,
        debugMessages,
        log: {
            debug: message => debugMessages.push(String(message)),
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        },
        async setObjectNotExistsAsync() {},
        async setStateAsync(id, state) {
            states.set(id, state);
        },
        async getStateAsync() {
            return this.dockState;
        },
        dockState: /** @type {{val: unknown} | null} */ (null),
    };
}

async function waitForManager() {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
}

describe('DreameManager status polling', () => {
    it('preserves existing object metadata while creating missing Dreame objects', async () => {
        const adapter = createAdapter();
        const storedObjects = new Map([
            [
                'control.start',
                {
                    type: 'state',
                    common: { name: 'Custom start name', type: 'boolean', role: 'button' },
                    native: { userDefined: true },
                },
            ],
        ]);
        adapter.setObjectNotExistsAsync = async (id, object) => {
            if (!storedObjects.has(id)) {
                storedObjects.set(id, object);
            }
        };
        let callCount = 0;
        const manager = new DreameManager(adapter, {
            sendMessage: async () => {
                callCount++;
                return callCount === 1 ? { result: [{ code: -1 }] } : { result: [] };
            },
        });

        await manager.ready;
        await manager.close();

        assert.deepEqual(storedObjects.get('control.start'), {
            type: 'state',
            common: { name: 'Custom start name', type: 'boolean', role: 'button' },
            native: { userDefined: true },
        });
        assert.equal(storedObjects.has('info.battery'), true);
        assert.equal(storedObjects.has('history.total_time'), true);
    });

    it('handles a failed optional wash-base probe without exposing the failure', async () => {
        const adapter = createAdapter();
        let callCount = 0;
        const manager = new DreameManager(adapter, {
            sendMessage: async () => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('SENSITIVE_WASH_BASE_PROBE_MARKER');
                }
                return { result: [] };
            },
        });

        await manager.ready;
        await waitForManager();
        await manager.close();

        assert.equal(adapter.debugMessages.includes('Could not determine wash base availability'), true);
        assert.equal(adapter.debugMessages.join('\n').includes('SENSITIVE_WASH_BASE_PROBE_MARKER'), false);
    });

    it('does not log complete Dreame property responses', async () => {
        const adapter = createAdapter();
        let callCount = 0;
        const manager = new DreameManager(adapter, {
            sendMessage: async (_method, params) => {
                callCount++;
                if (callCount === 1) {
                    return { result: [{ code: -1 }] };
                }
                if (callCount === 2) {
                    const properties = /** @type {any[]} */ (/** @type {unknown} */ (params));
                    return {
                        result: [{ ...properties[0], value: 'SENSITIVE_DREAME_MARKER', code: 0 }],
                    };
                }
                return { result: [] };
            },
        });

        await waitForManager();
        await manager.close();

        assert.equal(adapter.debugMessages.join('\n').includes('SENSITIVE_DREAME_MARKER'), false);
    });

    it('keeps state writes isolated between adapter instances', async () => {
        const firstAdapter = createAdapter();
        const secondAdapter = createAdapter();
        let firstCallCount = 0;
        let firstPropertyRequest = [];
        /** @type {(value: any) => void} */
        let resolvePollStarted = _value => undefined;
        const pollStarted = new Promise(resolve => {
            resolvePollStarted = resolve;
        });
        /** @type {(value: any) => void} */
        let releasePoll = _value => undefined;
        const pollResult = new Promise(resolve => {
            releasePoll = resolve;
        });
        const firstManager = new DreameManager(firstAdapter, {
            sendMessage: async (_method, params) => {
                firstCallCount++;
                if (firstCallCount === 1) {
                    return { result: [{ code: -1 }] };
                }
                if (firstCallCount === 2) {
                    firstPropertyRequest = /** @type {any[]} */ (/** @type {unknown} */ (params));
                    resolvePollStarted(undefined);
                    return pollResult;
                }
                return { result: [] };
            },
        });

        await pollStarted;
        let secondCallCount = 0;
        const secondManager = new DreameManager(secondAdapter, {
            sendMessage: async () => {
                secondCallCount++;
                return secondCallCount === 1 ? { result: [{ code: -1 }] } : { result: [] };
            },
        });
        await waitForManager();
        releasePoll({
            result: [{ ...firstPropertyRequest[0], value: 1, code: 0 }],
        });
        await waitForManager();
        await firstManager.close();
        await secondManager.close();

        assert.equal(firstAdapter.states.size, 1);
        assert.equal(secondAdapter.states.size, 0);
    });

    it('does not continue or reschedule an in-flight chunk after close', async () => {
        const adapter = createAdapter();
        let callCount = 0;
        /** @type {(value: any) => void} */
        let resolvePollStarted = _value => undefined;
        const pollStarted = new Promise(resolve => {
            resolvePollStarted = resolve;
        });
        /** @type {(value: any) => void} */
        let releasePoll = _value => undefined;
        const pollResult = new Promise(resolve => {
            releasePoll = resolve;
        });
        const manager = new DreameManager(adapter, {
            sendMessage: async () => {
                callCount++;
                if (callCount === 1) {
                    return { result: [{ code: -1 }] };
                }
                resolvePollStarted(undefined);
                return pollResult;
            },
        });

        await pollStarted;
        await manager.close();
        releasePoll({ result: [] });
        await waitForManager();

        assert.equal(callCount, 2);
        assert.equal(adapter.states.size, 0);
        assert.deepEqual(manager.globalTimeouts, {});
    });
});

describe('DreameManager TypeScript runtime', () => {
    function createIdleManager(Manager, adapter, miio) {
        const originalMain = Manager.prototype.main;
        Manager.prototype.main = async () => undefined;
        try {
            return new Manager(adapter, miio);
        } finally {
            Manager.prototype.main = originalMain;
        }
    }

    it('matches every reviewed MIOT protocol catalog and polling property', async () => {
        const response = { result: [{ code: -1 }] };
        const manager = createIdleManager(DreameManager, createAdapter(), { sendMessage: async () => response });
        const catalogs = {
            DreameWaterVolumes: DreameManager.DreameWaterVolumes,
            DreameErrors: DreameManager.DreameErrors,
            DreameState: DreameManager.DreameState,
            DreameWashBaseState: DreameManager.DreameWashBaseState,
            DreameProperties: DreameManager.DreameProperties,
            DreameActions: DreameManager.DreameActions,
            DreameBlockedObjects: DreameManager.DreameBlockedObjects,
            PARAMS: manager.PARAMS,
        };
        const digest = crypto.createHash('sha256').update(JSON.stringify(catalogs)).digest('hex');

        assert.equal(digest, '77db27fdcf715ad4b336646c07420139ad89e7fd67c163741c705523d804b096');
        assert.equal(manager.PARAMS.length, 18);
        assert.equal(Object.keys(DreameManager.DreameProperties).length, 122);
        assert.equal(Object.keys(DreameManager.DreameActions).length, 28);
        await waitForManager();
        assert.equal(manager.washBaseAvailable, false);
        await manager.close();
    });

    it('preserves object creation, chunked polling, mappings, and special charging values', async () => {
        const runScenario = async Manager => {
            const adapter = createAdapter();
            const objectIds = [];
            adapter.setObjectNotExistsAsync = async id => {
                objectIds.push(id);
            };
            let calls = 0;
            const manager = new Manager(adapter, {
                sendMessage: async (_method, params) => {
                    calls++;
                    if (calls === 1) {
                        return { result: [{ code: -1 }] };
                    }
                    return {
                        result: params.slice(0, 4).map((property, index) => ({
                            ...property,
                            code: 0,
                            value: [3, 0, 81, 1][index],
                        })),
                    };
                },
            });
            await waitForManager();
            await manager.close();
            return {
                objectIds,
                states: [...adapter.states],
                calls,
                logs: adapter.debugMessages,
                timeouts: manager.globalTimeouts,
            };
        };

        const result = await runScenario(DreameManager);

        assert.equal(result.objectIds.includes('info.battery'), true);
        assert.equal(result.objectIds.includes('history.total_time'), true);
        assert.deepEqual(result.states.find(([id]) => id === 'info.state'), ['info.state', { val: 10, ack: true }]);
        assert.deepEqual(result.states.find(([id]) => id === 'info.is_charging'), [
            'info.is_charging',
            { val: true, ack: true },
        ]);
        assert.equal(result.calls >= 2, true);
        assert.deepEqual(result.timeouts, {});
        assert.equal(result.logs.some(message => message.includes('value')), false);
    });

    it('preserves property writes, actions, and their current acknowledgement contract', async () => {
        const runScenario = async Manager => {
            const adapter = createAdapter();
            const calls = [];
            const manager = createIdleManager(Manager, adapter, {
                sendMessage: async (method, params) => {
                    calls.push({ method, params });
                    if (method === 'action') {
                        return { result: { code: 0 } };
                    }
                    return { result: [{ code: 0 }] };
                },
            });
            await waitForManager();
            calls.length = 0;
            manager.getStates = async () => undefined;

            await manager.stateChange('mihome-vacuum.test.setting.water_grade', { val: '11', ack: false });
            await manager.stateChange('mihome-vacuum.test.control.start', { val: true, ack: false });
            await manager.stateChange('mihome-vacuum.test.control.find', { val: true, ack: false });
            await manager.close();
            return { calls, states: [...adapter.states] };
        };

        const result = await runScenario(DreameManager);

        assert.equal(result.calls[0].method, 'set_properties');
        assert.equal(result.calls[0].params[0].value, 1);
        assert.deepEqual(
            result.calls.slice(1).map(call => [call.params.siid, call.params.aiid]),
            [
                [2, 1],
                [7, 1],
            ],
        );
        assert.equal(result.states.length, 0);
    });

    it('preserves all wash-base command decisions and idempotent shutdown', async () => {
        const runScenario = async Manager => {
            const adapter = createAdapter();
            const calls = [];
            const manager = createIdleManager(Manager, adapter, {
                sendMessage: async (method, params) => {
                    calls.push({ method, params });
                    return method === 'action' ? { result: { code: 0 } } : { result: [{ code: -1 }] };
                },
            });
            await waitForManager();
            calls.length = 0;
            manager.washBaseAvailable = true;
            manager.getStates = async () => undefined;

            adapter.dockState = { val: 4 };
            await manager.doCustomHandling('control.washMop');
            adapter.dockState = { val: 1 };
            await manager.doCustomHandling('control.pauseWashMop');
            adapter.dockState = { val: 0 };
            await manager.doCustomHandling('control.startDrying');
            adapter.dockState = { val: 2 };
            await manager.doCustomHandling('control.stopDrying');
            await manager.close();
            await manager.close();
            return { calls, states: [...adapter.states], timeouts: manager.globalTimeouts };
        };

        const result = await runScenario(DreameManager);

        assert.deepEqual(
            result.calls.map(call => call.params.in[0].value),
            ['1,1', '1,0', '3,0'],
        );
        assert.deepEqual(result.timeouts, {});
    });

    it('stops during a pending chunk after a safely redacted probe failure', async () => {
        const adapter = createAdapter();
        let calls = 0;
        /** @type {() => void} */
        let markPollStarted = () => undefined;
        const pollStarted = new Promise(resolve => {
            markPollStarted = () => resolve(undefined);
        });
        /** @type {(value: unknown) => void} */
        let releasePoll = _value => undefined;
        const pollResult = new Promise(resolve => {
            releasePoll = resolve;
        });
        const manager = new DreameManager(adapter, {
            sendMessage: async () => {
                calls++;
                if (calls === 1) {
                    throw new Error('synthetic-sensitive-wash-probe');
                }
                markPollStarted();
                return pollResult;
            },
        });

        await pollStarted;
        await manager.close();
        releasePoll({ result: [] });
        await waitForManager();

        assert.equal(calls, 2);
        assert.equal(adapter.states.size, 0);
        assert.deepEqual(manager.globalTimeouts, {});
        assert.equal(adapter.debugMessages.join('\n').includes('synthetic-sensitive-wash-probe'), false);
    });
});
