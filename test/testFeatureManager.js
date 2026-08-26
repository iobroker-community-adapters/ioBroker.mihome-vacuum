const assert = require('node:assert/strict');
const FeatureManager = require('../build/lib/featureManager');

function createAdapter() {
    const events = [];
    return {
        events,
        log: {
            debug: message => events.push(['debug', String(message)]),
            info: message => events.push(['info', String(message)]),
        },
        getState: (_id, callback) => callback(null, { val: 'roborock.vacuum.synthetic' }),
        getStates: (pattern, callback) => {
            events.push(['getStates', pattern]);
            callback(null, {
                'mihome-vacuum.0.rooms.living.roomFanPower': { val: 104 },
                'mihome-vacuum.0.rooms.living.mapIndex': { val: 16 },
            });
        },
        setState: (id, value, ack) => events.push(['setState', id, value, ack]),
        setStateChanged: (id, value, ack) => events.push(['setStateChanged', id, value, ack]),
        async setStateAsync(id, state) {
            events.push(['setStateAsync', id, state]);
        },
        async extendObjectAsync(id) {
            events.push(['extendObjectAsync', id]);
        },
        async setObjectNotExistsAsync(id) {
            events.push(['setObjectNotExistsAsync', id]);
        },
    };
}

async function runFeatureScenario(Manager, model = 'roborock.vacuum.synthetic') {
    const adapter = createAdapter();
    const manager = new Manager({ modell: model }, adapter);

    manager.init();
    manager.setModel('roborock.vacuum.synthetic');
    await manager.setWaterBox(1);
    await manager.setWaterBox(2);
    await manager.setDustCollect(0);
    await manager.setWashMop('1');
    await manager.setMop(1);
    await manager.setMop(undefined);
    await manager.setWaterBoxMode(201, 10);
    await manager.setMopMode(300);
    await manager.setDockStatus(0);

    return {
        events: adapter.events,
        flags: {
            model: manager.model,
            water_box: manager.water_box,
            dustCollect: manager.dustCollect,
            washMop: manager.washMop,
            mop: manager.mop,
            water_box_mode: manager.water_box_mode,
            mop_mode: manager.mop_mode,
            dock_status: manager.dock_status,
        },
    };
}

describe('Generic vacuum FeatureManager runtime', () => {
    it('initializes once and detects every supported feature', async () => {
        const result = await runFeatureScenario(FeatureManager);

        assert.equal(result.events.filter(event => event[1] === 'info.device_model').length, 1);
        assert.deepEqual(result.flags, {
            model: 'roborock.vacuum.synthetic',
            water_box: true,
            dustCollect: true,
            washMop: true,
            mop: true,
            water_box_mode: 2,
            mop_mode: true,
            dock_status: true,
        });
        assert.deepEqual(
            result.events.filter(event => event[0] === 'setObjectNotExistsAsync').map(event => event[1]),
            [
                'info.water_box',
                'control.dustCollect',
                'control.washMop',
                'info.mop',
                'control.water_box_level',
                'control.mop_mode',
                'info.dock_status',
            ],
        );
    });

    it('preserves extended suction detection and updates only room fan-power objects', async () => {
        const runScenario = async Manager => {
            const adapter = createAdapter();
            const manager = new Manager({ modell: 'roborock.vacuum.a27' }, adapter);

            await manager.setNewSuctionValues(108);
            await manager.setNewSuctionValues(50);

            return { events: adapter.events, detected: manager.NewSuctionPower };
        };

        const result = await runScenario(FeatureManager);

        assert.equal(result.detected, true);
        assert.deepEqual(
            result.events.filter(event => event[0] === 'extendObjectAsync').map(event => event[1]),
            ['control.fan_power', 'mihome-vacuum.0.rooms.living.roomFanPower'],
        );
        assert.equal(result.events.some(event => event.includes('mihome-vacuum.0.rooms.living.mapIndex')), false);
    });

    it('preserves one-time unsupported-feature detection without creating objects', async () => {
        const runScenario = async Manager => {
            const adapter = createAdapter();
            const manager = new Manager({ modell: 'roborock.vacuum.synthetic' }, adapter);

            await manager.setWaterBox('not-numeric');
            await manager.setDustCollect('not-numeric');
            await manager.setWashMop('not-numeric');
            await manager.setMop('not-numeric');
            await manager.setMopMode('not-numeric');
            await manager.setDockStatus('not-numeric');
            await manager.setNewSuctionValues(100);

            return {
                events: adapter.events,
                flags: {
                    water_box: manager.water_box,
                    dustCollect: manager.dustCollect,
                    washMop: manager.washMop,
                    mop: manager.mop,
                    mop_mode: manager.mop_mode,
                    dock_status: manager.dock_status,
                    suction: manager.NewSuctionPower,
                },
            };
        };

        const result = await runScenario(FeatureManager);

        assert.equal(result.events.some(event => event[0] === 'setObjectNotExistsAsync'), false);
        assert.deepEqual(result.flags, {
            water_box: false,
            dustCollect: false,
            washMop: false,
            mop: false,
            mop_mode: false,
            dock_status: false,
            suction: false,
        });
    });
});
