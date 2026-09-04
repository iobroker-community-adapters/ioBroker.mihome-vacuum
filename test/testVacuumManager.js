const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

class FakeMapHelper {
    constructor() {
        this.shutdownCalls = 0;
    }

    async shutdown() {
        this.shutdownCalls++;
    }
}

class FakeTimerManager {
    constructor() {
        this.closeCalls = 0;
    }

    close() {
        this.closeCalls++;
    }
}

const VacuumManager = proxyquire('../build/lib/vacuum', {
    './maphelper': FakeMapHelper,
    './timerManager.js': FakeTimerManager,
    './roomManager': class {},
});

function createManager(sendMessage = async () => ({})) {
    const debugMessages = [];
    const objectUpdates = [];
    const stateUpdates = [];
    const adapter = {
        config: {},
        device: 'roborock.vacuum.test',
        log: {
            debug: message => debugMessages.push(String(message)),
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
        },
        setTimeout: (callback, delay) => setTimeout(callback, delay),
        clearTimeout: timeout => clearTimeout(timeout),
        getState: (id, callback) => callback(null, null),
        getStateAsync: async () => null,
        setStateAsync: async id => stateUpdates.push(id),
        setState: () => undefined,
        setStateChanged: () => undefined,
        setObjectAsync: async id => objectUpdates.push(id),
        extendObjectAsync: async id => objectUpdates.push(id),
        setObjectNotExistsAsync: async id => objectUpdates.push(id),
        delObjectAsync: async () => undefined,
    };
    const originalMain = VacuumManager.prototype.main;
    VacuumManager.prototype.main = () => undefined;
    try {
        return {
            manager: new VacuumManager(adapter, { sendMessage }),
            debugMessages,
            adapter,
            objectUpdates,
            stateUpdates,
        };
    } finally {
        VacuumManager.prototype.main = originalMain;
    }
}

describe('VacuumManager lifecycle', () => {
    it('keeps the manager context for the delayed status update after startVacuuming', async () => {
        const clock = sinon.useFakeTimers();
        try {
            const methods = [];
            const { manager } = createManager(async method => {
                methods.push(method);
                return { result: ['ok'] };
            });
            let statusCalls = 0;
            manager.setGetStatus = async function () {
                assert.equal(this, manager);
                statusCalls++;
            };

            await manager.onMessage({ command: 'startVacuuming', message: null });
            await clock.tickAsync(2_000);

            assert.deepEqual(methods, ['app_start']);
            assert.equal(statusCalls, 1);
            await manager.close();
        } finally {
            clock.restore();
        }
    });

    it('starts cleaning from a control state without sending the command to itself', async () => {
        const methods = [];
        const { manager, adapter } = createManager(async method => {
            methods.push(method);
            return { result: ['ok'] };
        });
        let selfMessages = 0;
        adapter.sendTo = () => selfMessages++;
        adapter.setForeignState = () => undefined;
        manager.startCleaning = async () => true;

        await manager.stateChange('mihome-vacuum.0.control.clean_home', { val: true, ack: false });

        assert.equal(selfMessages, 0);
        assert.deepEqual(methods, ['app_start']);
        await manager.close();
    });

    it('waits for resume-state cleanup without deleting the shared control channel', async () => {
        const { manager, adapter } = createManager();
        adapter.config.enableResumeZone = true;
        const deletedIds = [];
        /** @type {() => void} */
        let releaseDeletes = () => undefined;
        const deleteGate = new Promise(resolve => {
            releaseDeletes = () => resolve(undefined);
        });
        adapter.delObjectAsync = async id => {
            deletedIds.push(id);
            await deleteGate;
            return undefined;
        };

        let initializationCompleted = false;
        const initialization = manager.init().then(() => {
            initializationCompleted = true;
        });
        await new Promise(resolve => setImmediate(resolve));

        assert.deepEqual(deletedIds.sort(), ['control.resumeRoomClean', 'control.resumeZoneClean']);
        assert.equal(deletedIds.includes('control'), false);
        assert.equal(initializationCompleted, false);

        releaseDeletes();
        await initialization;
        assert.equal(initializationCompleted, true);
        await manager.close();
    });

    it('keeps asynchronous status writes isolated between adapter instances', async () => {
        /** @type {(value: any) => void} */
        let releaseStatus = _value => undefined;
        const statusResponse = new Promise(resolve => {
            releaseStatus = resolve;
        });
        const { manager: firstManager, stateUpdates: firstStateUpdates } = createManager(() => statusResponse);
        const featureMethods = [
            'setMop',
            'setNewSuctionValues',
            'setWaterBox',
            'setWaterBoxMode',
            'setMopMode',
            'setDockStatus',
            'setDustCollect',
            'setWashMop',
        ];
        featureMethods.forEach(method => (firstManager.features[method] = async () => undefined));
        const statusUpdate = firstManager.setGetStatus();
        const { manager: secondManager, stateUpdates: secondStateUpdates } = createManager();

        releaseStatus({
            result: [
                {
                    state: 8,
                    battery: 100,
                    clean_time: 0,
                    clean_area: 0,
                    error_code: 0,
                    in_cleaning: 0,
                    fan_power: 100,
                    dnd_enabled: 0,
                    map_status: 0,
                },
            ],
        });
        await statusUpdate;
        await firstManager.close();
        await secondManager.close();

        assert.equal(firstStateUpdates.includes('info.battery'), true);
        assert.equal(secondStateUpdates.length, 0);
    });

    it('keeps detected device features isolated between instances', async () => {
        const { manager: firstManager } = createManager(async method =>
            method === 'get_carpet_mode' ? { result: [{ enable: 1 }] } : {},
        );
        await firstManager.checkFeaturesCarpet();
        const { manager: secondManager } = createManager();
        let secondCarpetDetectionCalls = 0;
        secondManager.setGetStatus = async () => undefined;
        secondManager.getSetNetwork = async () => undefined;
        secondManager.setGetSoundVolume = async () => undefined;
        secondManager.getOnlyAtStart = async () => undefined;
        secondManager.checkFeaturesCarpet = async () => secondCarpetDetectionCalls++;
        secondManager.setGetCarpetMode = async () => undefined;
        secondManager.checkFeaturesRoomMapping = async () => undefined;

        await secondManager.getStates();
        await firstManager.close();
        await secondManager.close();

        assert.equal(secondCarpetDetectionCalls, 1);
    });

    it('shuts down the timer and map helper once when closing repeatedly', async () => {
        const { manager } = createManager();

        await manager.close();
        await manager.close();

        assert.equal(manager.Map.shutdownCalls, 1);
        assert.equal(manager.timerManager.closeCalls, 1);
    });

    it('does not continue or reschedule an in-flight poll after close', async () => {
        const { manager } = createManager();
        /** @type {() => void} */
        let finishStatus = () => undefined;
        /** @type {Promise<void>} */
        const statusPending = new Promise(resolve => (finishStatus = resolve));
        let networkCalls = 0;
        let soundCalls = 0;
        let startupCalls = 0;
        manager.setGetStatus = () => statusPending;
        manager.getSetNetwork = async () => networkCalls++;
        manager.setGetSoundVolume = async () => soundCalls++;
        manager.getOnlyAtStart = async () => startupCalls++;

        const polling = manager.getStates();
        await Promise.resolve();
        await manager.close();
        finishStatus();
        await polling;

        assert.equal(networkCalls, 0);
        assert.equal(soundCalls, 0);
        assert.equal(startupCalls, 0);
        assert.deepEqual(manager.globalTimeouts, {});
    });
});

describe('VacuumManager safe debug logging', () => {
    it('logs only the cleaning-history entry count', async () => {
        const privateHistoryMarker = 1234567890;
        const { manager, debugMessages } = createManager(async () => ({
            result: [
                {
                    begin: privateHistoryMarker,
                    end: privateHistoryMarker + 60,
                    duration: 60,
                    area: 10000,
                    error: 0,
                    complete: 1,
                },
            ],
        }));

        const result = await manager.getLogEntries([1]);

        assert.equal(result.length, 1);
        assert.equal(debugMessages.includes('Cleaning history processed: 1 entries'), true);
        assert.equal(debugMessages.some(message => message.includes(String(privateHistoryMarker))), false);
        await manager.close();
    });

    it('logs a status summary without the complete response', async () => {
        const status = {
            state: 8,
            battery: 100,
            clean_time: 60,
            clean_area: 10000,
            error_code: 0,
            in_cleaning: 0,
            fan_power: 104,
            dnd_enabled: 0,
            map_status: 3,
            secretFutureField: 'PRIVATE_STATUS_MARKER',
        };
        const { manager, debugMessages } = createManager(async () => ({ result: [status] }));
        const featureMethods = [
            'setMop',
            'setNewSuctionValues',
            'setWaterBox',
            'setWaterBoxMode',
            'setMopMode',
            'setDockStatus',
            'setDustCollect',
            'setWashMop',
        ];
        featureMethods.forEach(method => (manager.features[method] = async () => undefined));
        manager.lastMapState = 3;
        manager.cleandState = 8;

        await manager.setGetStatus();

        assert.equal(
            debugMessages.includes('Status update: state=8, battery=100, error=0, cleaning=false, fan=104, map=3'),
            true,
        );
        assert.equal(debugMessages.some(message => message.includes('PRIVATE_STATUS_MARKER')), false);
        await manager.close();
    });
});

describe('VacuumManager object lookup', () => {
    it('updates only roomFanPower states using an optimizable prefix lookup', async () => {
        const { manager, adapter, objectUpdates } = createManager();
        let requestedPattern;
        adapter.getStates = (pattern, callback) => {
            requestedPattern = pattern;
            callback(null, {
                'mihome-vacuum.test.rooms.living.roomFanPower': { val: 104 },
                'mihome-vacuum.test.rooms.living.mapIndex': { val: 16 },
                'mihome-vacuum.test.rooms.living.roomClean': { val: false },
            });
        };

        await manager.features.setNewSuctionValues(104);

        assert.equal(requestedPattern, 'rooms.*');
        assert.deepEqual(objectUpdates, [
            'control.fan_power',
            'mihome-vacuum.test.rooms.living.roomFanPower',
        ]);
        await manager.close();
    });
});

describe('VacuumManager startCleaning room params', () => {
    it('awaits room settings and applies them via miIO before cleaning starts', async () => {
        const sent = [];
        const { manager, adapter, stateUpdates } = createManager(async (method, params) => {
            sent.push({ method, params });
            return { result: ['ok'] };
        });
        adapter.getStateAsync = async id => {
            if (id.endsWith('roomFanPower')) {
                return { val: 102 };
            }
            if (id.endsWith('roomWaterBoxMode')) {
                return { val: 201 };
            }
            if (id.endsWith('roomMopMode')) {
                return { val: 300 };
            }
            return null;
        };
        manager.features.water_box_mode = 1;
        manager.features.mop_mode = 1;

        const started = await manager.startCleaning(18, {
            channels: ['rooms.kitchen', 'rooms.living'],
            message: 'queued rooms',
        });

        assert.equal(started, true);
        assert.deepEqual(sent, [
            { method: 'set_custom_mode', params: [102] },
            { method: 'set_water_box_custom_mode', params: [201] },
            { method: 'set_mop_mode', params: [300] },
        ]);
        assert.deepEqual(stateUpdates, ['control.fan_power', 'control.water_box_mode', 'control.mop_mode']);
        await manager.close();
    });

    it('marks native segment repeat unsupported only in memory for the current run', async () => {
        const sent = [];
        const { manager, adapter } = createManager(async (method, params) => {
            sent.push({ method, params });
            if (method === 'app_segment_clean' && params && params[0] && params[0].repeat) {
                return { error: { code: -10000, message: 'data for segment is not a number' } };
            }
            return { result: ['ok'] };
        });
        adapter.unsupportedFeatures = '|';
        adapter.isUnsupportedFeature = key => adapter.unsupportedFeatures.indexOf(`|${key}|`) >= 0;
        adapter.setUnsupportedFeature = async () => {
            throw new Error('must not persist unsupported feature for transient segment-repeat errors');
        };
        manager.startCleaning = async () => true;

        await manager.onMessage({
            command: 'cleanSegments',
            message: { segments: [16], repeat: 2 },
            segments: [16],
            channels: null,
            repeat: 2,
        });

        assert.equal(adapter.unsupportedFeatures, '|segemntCleanRepeat|');
        assert.equal(sent.length >= 2, true);
        assert.equal(sent[0].method, 'app_segment_clean');
        assert.equal(sent[1].method, 'app_segment_clean');
        assert.deepEqual(sent[1].params, [16]);
        assert.equal(manager.queue.length, 1);
        await manager.close();
    });
});
