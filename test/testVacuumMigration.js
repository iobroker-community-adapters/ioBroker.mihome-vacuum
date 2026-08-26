const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

class FakeMapHelper {
    async shutdown() {}
}

class FakeManager {
    close() {}
}

class FakeFeatureManager {
    constructor() {
        this.roomMapping = null;
    }
}

function loadManager(modulePath) {
    return proxyquire(modulePath, {
        './maphelper': FakeMapHelper,
        './timerManager.js': FakeManager,
        './roomManager': FakeManager,
        './featureManager': FakeFeatureManager,
    });
}

function createManager(Manager) {
    const adapter = {
        config: {},
        device: 'roborock.vacuum.synthetic',
        log: { debug() {}, info() {}, warn() {}, error() {} },
        getState: (_id, callback) => callback(null, null),
    };
    const originalMain = Manager.prototype.main;
    Manager.prototype.main = () => undefined;
    try {
        return new Manager(adapter, { sendMessage: async () => ({}) });
    } finally {
        Manager.prototype.main = originalMain;
    }
}

describe('VacuumManager TypeScript runtime contract', () => {
    it('exposes the complete reviewed public and internal prototype surface', () => {
        const VacuumManager = loadManager('../build/lib/vacuum');

        assert.deepEqual(Object.getOwnPropertyNames(VacuumManager.prototype).sort(), [
            'asyncForEach',
            'checkFeaturesCarpet',
            'checkFeaturesRoomMapping',
            'clearQueue',
            'close',
            'constructor',
            'createHtmlTable',
            'delObj',
            'delay',
            'getLogEntries',
            'getMapData',
            'getMapPointer',
            'getMultiMapsList',
            'getOnlyAtStart',
            'getSetNetwork',
            'getStates',
            'init',
            'initStates',
            'isEquivalent',
            'main',
            'onMessage',
            'parseCleaningRecords',
            'parseCleaningSummary',
            'parseGoTo',
            'parseStatus',
            'push',
            'setGetCarpetMode',
            'setGetCleanSummary',
            'setGetConsumable',
            'setGetSoundVolume',
            'setGetStatus',
            'setRemoteState',
            'startCleaning',
            'stateChange',
            'stopCleaning',
            'updateQueue',
        ]);
    });

    it('initializes the generic manager without narrowing it to one vacuum model', async () => {
        const VacuumManager = loadManager('../build/lib/vacuum');
        const manager = createManager(VacuumManager);

        assert.deepEqual({
            device: manager.device,
            vacuum: manager.vacuum,
            carpetModeSettings: manager.carpetModeSettings,
            closed: manager.closed,
            Error: manager.Error,
            cleanActiveState: manager.cleanActiveState,
            queue: manager.queue,
            mapEnable: manager.mapEnable,
            mapReady: manager.mapReady,
        }, {
            device: 'roborock.vacuum.synthetic',
            vacuum: {
                modell: 'roborock.vacuum.synthetic',
                features: { carpetMode: null, roomMapping: null },
                lastGoto: [],
                lastZone: [[]],
            },
            carpetModeSettings: {
                enabled: 1,
                integral: 450,
                high: 500,
                low: 400,
                stall_time: 10,
            },
            closed: false,
            Error: false,
            cleanActiveState: 0,
            queue: [],
            mapEnable: undefined,
            mapReady: { login: false, mappointer: false },
        });
        await manager.close();
    });
});
