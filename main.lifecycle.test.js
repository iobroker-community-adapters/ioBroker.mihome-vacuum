const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

class FakeAdapter extends EventEmitter {
    constructor(options = {}) {
        super();
        this.config = options.config || {};
        this.namespace = 'mihome-vacuum.test';
        this.debugMessages = [];
        this.warnMessages = [];
        this.errorMessages = [];
        this.sentMessages = [];
        this.log = {
            debug: message => this.debugMessages.push(String(message)),
            info: () => undefined,
            warn: message => this.warnMessages.push(String(message)),
            error: message => this.errorMessages.push(String(message)),
        };
    }

    async setObjectNotExistsAsync() {}
    async extendObjectAsync() {}
    async delObjectAsync() {}
    async getStateAsync() {
        return null;
    }
    async setStateAsync() {}
    setState() {}
    subscribeStates() {}
    sendTo(from, command, response, callback) {
        this.sentMessages.push({ from, command, response, callback });
    }
}

/**
 * @param {{ closeThrows?: boolean, managerCloseThrows?: boolean, managerReadyRejects?: boolean, managerCommandRejects?: boolean, managerStateChangeRejects?: boolean, modelResponses?: object[] }} [options]
 */
function createAdapter({
    closeThrows = false,
    managerCloseThrows = false,
    managerReadyRejects = false,
    managerCommandRejects = false,
    managerStateChangeRejects = false,
    modelResponses,
} = {}) {
    const counters = {
        udpClose: 0,
        managerClose: 0,
        mainCloudClose: 0,
        modelRequests: 0,
    };
    const successfulModelResponse = {
        result: { model: 'roborock.vacuum.test', fw_ver: 'test', mac: 'test' },
    };
    const responses = modelResponses ? [...modelResponses] : [successfulModelResponse];

    class FakeMiio extends EventEmitter {
        async sendMessage() {
            counters.modelRequests++;
            return responses.length ? responses.shift() : successfulModelResponse;
        }

        close(callback) {
            counters.udpClose++;
            callback();
            if (closeThrows) throw new Error('synthetic close failure after callback');
        }
    }

    class FakeVacuumManager {
        constructor() {
            this.ready = managerReadyRejects
                ? Promise.reject(new Error('SENSITIVE_MANAGER_INITIALIZATION_MARKER'))
                : Promise.resolve();
        }

        async close() {
            counters.managerClose++;
            if (managerCloseThrows) throw new Error('synthetic manager close failure');
        }

        async stateChange() {
            if (managerStateChangeRejects) throw new Error('synthetic state change failure');
        }

        async onMessage() {
            if (managerCommandRejects) {
                throw Object.assign(new Error('MIIO request timed out'), { code: 'MIIO_TIMEOUT' });
            }
            return { result: ['ok'] };
        }
    }

    class FakeCloudConnector {
        shutdown() {
            counters.mainCloudClose++;
        }
    }

    const startAdapter = proxyquire('./build/main', {
        '@iobroker/adapter-core': { Adapter: FakeAdapter },
        './lib/miio': FakeMiio,
        './lib/viomi': class {},
        './lib/vacuum': FakeVacuumManager,
        './lib/dreame': class {},
        './lib/XiaomiCloudConnector': FakeCloudConnector,
    });
    return {
        adapter: startAdapter({
            config: {
                token: '00000000000000000000000000000000',
                pingInterval: 20000,
            },
        }),
        counters,
    };
}

describe('Adapter unload lifecycle', () => {
    it('keeps manager, UDP client, cloud login, and state routing isolated between compact-mode instances', async () => {
        const managers = [];
        const clients = [];
        const cloudConnectors = [];

        class SharedFakeMiio extends EventEmitter {
            constructor(adapter) {
                super();
                this.adapter = adapter;
                this.closeCalls = 0;
                clients.push(this);
            }

            async sendMessage() {
                return {
                    result: { model: 'roborock.vacuum.test', fw_ver: 'test', mac: 'test' },
                };
            }

            close(callback) {
                this.closeCalls++;
                callback();
            }
        }

        class SharedFakeVacuumManager {
            constructor(adapter, client) {
                this.adapter = adapter;
                this.client = client;
                this.stateChanges = [];
                this.closeCalls = 0;
                managers.push(this);
            }

            stateChange(id) {
                this.stateChanges.push(id);
            }

            async close() {
                this.closeCalls++;
            }
        }

        class SharedFakeCloudConnector {
            constructor(log, auth, adapter) {
                this.adapter = adapter;
                this.startCalls = 0;
                this.shutdownCalls = 0;
                cloudConnectors.push(this);
            }

            async startQrLogin() {
                this.startCalls++;
                return { owner: this.adapter.namespace };
            }

            shutdown() {
                this.shutdownCalls++;
            }
        }

        const startAdapter = proxyquire('./build/main', {
            '@iobroker/adapter-core': { Adapter: FakeAdapter },
            './lib/miio': SharedFakeMiio,
            './lib/viomi': class {},
            './lib/vacuum': SharedFakeVacuumManager,
            './lib/dreame': class {},
            './lib/XiaomiCloudConnector': SharedFakeCloudConnector,
        });
        const firstAdapter = startAdapter({
            config: { token: '11111111111111111111111111111111' },
            namespace: 'mihome-vacuum.first',
        });
        const secondAdapter = startAdapter({
            config: { token: '22222222222222222222222222222222' },
            namespace: 'mihome-vacuum.second',
        });
        firstAdapter.namespace = 'mihome-vacuum.first';
        secondAdapter.namespace = 'mihome-vacuum.second';

        await firstAdapter.main();
        await firstAdapter.getModel();
        await secondAdapter.main();
        await secondAdapter.getModel();
        await firstAdapter.onStateChange('mihome-vacuum.first.control.start', { val: true, ack: false });
        await secondAdapter.onStateChange('mihome-vacuum.second.control.start', { val: true, ack: false });
        await firstAdapter.onMessage({ command: 'startCloudLogin', message: {}, from: 'admin', callback: 'first' });
        await secondAdapter.onMessage({ command: 'startCloudLogin', message: {}, from: 'admin', callback: 'second' });
        await firstAdapter.onUnload(() => undefined);
        await secondAdapter.onUnload(() => undefined);

        assert.equal(managers.length, 2);
        assert.deepEqual(managers[0].stateChanges, ['mihome-vacuum.first.control.start']);
        assert.deepEqual(managers[1].stateChanges, ['mihome-vacuum.second.control.start']);
        assert.deepEqual(managers.map(manager => manager.closeCalls), [1, 1]);
        assert.deepEqual(clients.map(client => client.closeCalls), [1, 1]);
        assert.equal(managers[0].client, clients[0]);
        assert.equal(managers[1].client, clients[1]);
        assert.equal(cloudConnectors.length, 2);
        assert.deepEqual(cloudConnectors.map(connector => connector.startCalls), [1, 1]);
        assert.deepEqual(cloudConnectors.map(connector => connector.shutdownCalls), [1, 1]);
        assert.deepEqual(firstAdapter.sentMessages[0].response, { owner: 'mihome-vacuum.first' });
        assert.deepEqual(secondAdapter.sentMessages[0].response, { owner: 'mihome-vacuum.second' });
    });

    it('invokes the unload callback once even if closing throws after callback', async () => {
        const { adapter } = createAdapter({ closeThrows: true });
        let callbackCalls = 0;

        await adapter.main();
        await adapter.onUnload(() => callbackCalls++);

        assert.equal(callbackCalls, 1);
    });

    it('runs its resource shutdown path once across repeated unload calls', async () => {
        const { adapter, counters } = createAdapter();
        let firstCallbackCalls = 0;
        let secondCallbackCalls = 0;

        await adapter.onReady();
        await new Promise(resolve => setImmediate(resolve));
        await adapter.getModel();
        await Promise.all([
            adapter.onUnload(() => firstCallbackCalls++),
            adapter.onUnload(() => secondCallbackCalls++),
        ]);

        assert.deepEqual(counters, {
            udpClose: 1,
            managerClose: 1,
            mainCloudClose: 1,
            modelRequests: 1,
        });
        assert.equal(firstCallbackCalls, 1);
        assert.equal(secondCallbackCalls, 1);
    });

    it('closes UDP even if manager shutdown fails', async () => {
        const { adapter, counters } = createAdapter({ managerCloseThrows: true });
        let callbackCalls = 0;

        await adapter.onReady();
        await new Promise(resolve => setImmediate(resolve));
        await adapter.getModel();
        await adapter.onUnload(() => callbackCalls++);

        assert.equal(counters.managerClose, 1);
        assert.equal(counters.udpClose, 1);
        assert.equal(callbackCalls, 1);
    });

    it('returns a typed response when a manager command fails', async () => {
        const { adapter } = createAdapter({ managerCommandRejects: true });

        await adapter.main();
        await adapter.getModel();
        await adapter.onMessage({ command: 'getStatus', message: {}, from: 'script', callback: 'request' });

        assert.deepEqual(adapter.sentMessages[0].response, {
            error: { code: 'MIIO_TIMEOUT', message: 'MIIO request timed out' },
        });
        await adapter.onUnload(() => undefined);
    });

    it('awaits and contains a failed manager state change', async () => {
        const { adapter } = createAdapter({ managerStateChangeRejects: true });

        await adapter.main();
        await adapter.getModel();
        await adapter.onStateChange('mihome-vacuum.test.control.start', { val: true, ack: false });

        assert.equal(adapter.warnMessages.includes('Could not process state change: synthetic state change failure'), true);
        await adapter.onUnload(() => undefined);
    });

    it('retries miIO.info sequentially and logs only a real result as success', async () => {
        const success = { result: { model: 'roborock.vacuum.test', fw_ver: 'test', mac: 'test' } };
        const { adapter, counters } = createAdapter({ modelResponses: [{}, success] });

        await adapter.main();
        await adapter.getModel();

        assert.equal(counters.modelRequests, 2);
        assert.equal(adapter.debugMessages.includes('miIO.info attempt 1/5 completed without device information'), true);
        assert.equal(adapter.debugMessages.includes('miIO.info attempt 2/5 succeeded'), true);
        assert.equal(adapter.debugMessages.includes('miIO.info response received'), false);
        await adapter.onUnload(() => undefined);
    });

    it('waits for main startup work in the ready lifecycle', async () => {
        const { adapter } = createAdapter();
        /** @type {(state: null) => void} */
        let releaseState = () => undefined;
        const stateGate = new Promise(resolve => {
            releaseState = resolve;
        });
        adapter.getStateAsync = async id => (id === 'deviceInfo.unsupported' ? stateGate : null);

        let readyCompleted = false;
        const ready = adapter.onReady().then(() => {
            readyCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(readyCompleted, false);

        releaseState(null);
        await ready;
        assert.equal(readyCompleted, true);
        await adapter.onUnload(() => undefined);
    });

    it('handles startup failures without exposing details and leaves the connection inactive', async () => {
        const { adapter } = createAdapter();
        const connectionValues = [];
        adapter.setStateAsync = async (id, state) => {
            if (id === 'info.connection') {
                connectionValues.push(state.val);
            }
        };
        adapter.setObjectNotExistsAsync = async id => {
            if (id === 'auth') {
                throw new Error('SENSITIVE_STARTUP_FAILURE_MARKER');
            }
        };

        await adapter.onReady();

        assert.equal(adapter.miio, null);
        assert.deepEqual(connectionValues, [false, false]);
        assert.equal(adapter.errorMessages.includes('Adapter startup failed'), true);
        assert.equal(adapter.errorMessages.join('\n').includes('SENSITIVE_STARTUP_FAILURE_MARKER'), false);
        await adapter.onUnload(() => undefined);
    });

    it('waits for manager initialization and cleans up a failed manager safely', async () => {
        const { adapter, counters } = createAdapter({ managerReadyRejects: true });
        const connectionValues = [];
        adapter.setStateAsync = async (id, state) => {
            if (id === 'info.connection') {
                connectionValues.push(state.val);
            }
        };

        await adapter.main();
        await adapter.getModel();

        assert.equal(adapter.vacuum, null);
        assert.equal(counters.managerClose, 1);
        assert.deepEqual(connectionValues, [true, false]);
        assert.equal(adapter.errorMessages.includes('Could not initialize the selected vacuum manager'), true);
        assert.equal(adapter.errorMessages.join('\n').includes('SENSITIVE_MANAGER_INITIALIZATION_MARKER'), false);
        await adapter.onUnload(() => undefined);
    });

    it('handles connection initialization failures without exposing details', async () => {
        const { adapter } = createAdapter();
        const connectionValues = [];
        adapter.setStateAsync = async (id, state) => {
            if (id === 'deviceInfo.model') {
                throw new Error('SENSITIVE_CONNECTION_FAILURE_MARKER');
            }
            if (id === 'info.connection') {
                connectionValues.push(state.val);
            }
        };

        await adapter.main();
        await adapter.handleConnect();

        assert.equal(adapter.vacuum, null);
        assert.deepEqual(connectionValues, [false]);
        assert.equal(adapter.errorMessages.includes('Device connection initialization failed'), true);
        assert.equal(adapter.errorMessages.join('\n').includes('SENSITIVE_CONNECTION_FAILURE_MARKER'), false);
        await adapter.onUnload(() => undefined);
    });

    it('waits for custom command and IoT state creation before startup completes', async () => {
        const { adapter } = createAdapter();
        adapter.config.enableSelfCommands = true;
        adapter.config.enableAlexa = true;
        const delayedIds = [];
        /** @type {() => void} */
        let releaseWrites = () => undefined;
        const writeGate = new Promise(resolve => {
            releaseWrites = () => resolve(undefined);
        });
        adapter.setObjectNotExistsAsync = async id => {
            if (id === 'control.X_send_command' || id === 'control.pauseResume') {
                delayedIds.push(id);
                await writeGate;
            }
        };

        let startupCompleted = false;
        const startup = adapter.main().then(() => {
            startupCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.deepEqual(delayedIds, ['control.X_send_command']);
        assert.equal(startupCompleted, false);

        releaseWrites();
        await startup;
        assert.deepEqual(delayedIds.sort(), ['control.X_send_command', 'control.pauseResume']);
        assert.equal(startupCompleted, true);
        await adapter.onUnload(() => undefined);
    });

    it('repairs the numeric wifi-signal default on existing objects', async () => {
        const { adapter } = createAdapter();
        const updates = [];
        adapter.extendObjectAsync = async (id, update) => {
            updates.push({ id, update });
        };

        await adapter.main();

        assert.deepEqual(updates, [{ id: 'deviceInfo.wifi_signal', update: { common: { def: 0 } } }]);
        await adapter.onUnload(() => undefined);
    });

    it('waits for optional state cleanup without deleting the shared control channel', async () => {
        const { adapter } = createAdapter();
        const deletedIds = [];
        /** @type {() => void} */
        let releaseDeletes = () => undefined;
        const deleteGate = new Promise(resolve => {
            releaseDeletes = () => resolve(undefined);
        });
        adapter.delObjectAsync = async id => {
            deletedIds.push(id);
            await deleteGate;
        };

        let startupCompleted = false;
        const startup = adapter.main().then(() => {
            startupCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(deletedIds.includes('control'), false);
        assert.equal(deletedIds.includes('control.X_send_command'), true);
        assert.equal(startupCompleted, false);

        releaseDeletes();
        await startup;
        assert.equal(deletedIds.includes('control.pauseResume'), true);
        assert.equal(startupCompleted, true);
        await adapter.onUnload(() => undefined);
    });

    it('restores and normalizes unsupported features before startup completes', async () => {
        const { adapter } = createAdapter();
        /** @type {(state: {val: string}) => void} */
        let releaseState = () => undefined;
        const stateGate = new Promise(resolve => {
            releaseState = resolve;
        });
        adapter.getStateAsync = async id => {
            if (id === 'deviceInfo.unsupported') {
                return stateGate;
            }
            return null;
        };

        let startupCompleted = false;
        const startup = adapter.main().then(() => {
            startupCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(startupCompleted, false);
        assert.equal(adapter.isUnsupportedFeature('segemntCleanRepeat'), false);

        releaseState({ val: 'segemntCleanRepeat' });
        await startup;

        assert.equal(adapter.unsupportedFeatures, '|segemntCleanRepeat|');
        assert.equal(adapter.isUnsupportedFeature('segemntCleanRepeat'), true);
        await adapter.onUnload(() => undefined);
    });

    it('awaits unsupported-feature persistence and handles write failures safely', async () => {
        const { adapter } = createAdapter();
        /** @type {(error: Error) => void} */
        let rejectWrite = () => undefined;
        const writeGate = new Promise((_resolve, reject) => {
            rejectWrite = reject;
        });
        adapter.setStateAsync = async id => {
            if (id === 'deviceInfo.unsupported') {
                return writeGate;
            }
        };

        let persistenceCompleted = false;
        const persistence = adapter.setUnsupportedFeature('segemntCleanRepeat').then(() => {
            persistenceCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(persistenceCompleted, false);

        rejectWrite(new Error('SENSITIVE_UNSUPPORTED_WRITE_MARKER'));
        await persistence;

        assert.equal(persistenceCompleted, true);
        assert.equal(adapter.unsupportedFeatures, '|segemntCleanRepeat|');
        assert.equal(adapter.warnMessages.includes('Could not persist a detected unsupported device feature'), true);
        assert.equal(adapter.warnMessages.join('\n').includes('SENSITIVE_UNSUPPORTED_WRITE_MARKER'), false);
    });
});
