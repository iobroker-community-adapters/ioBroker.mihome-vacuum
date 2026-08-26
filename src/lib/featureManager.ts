import objectsModule from './objects';
import type {
    ConsumableFeature,
    FeatureAdapter,
    FeatureObjectsModule,
    VacuumFeatureDeviceState,
} from '../types/featureManager';

const objects = objectsModule as FeatureObjectsModule;

function isNumeric(value: unknown): boolean {
    return !Number.isNaN(Number(value));
}

class FeatureManager {
    readonly deviceState: VacuumFeatureDeviceState;
    readonly adapter: FeatureAdapter;
    model: unknown = null;
    zoneClean = false;
    mop_mode: boolean | null = null;
    water_box: boolean | null = null;
    water_box_mode: boolean | 2 | null = null;
    dustCollect: boolean | null = null;
    washMop: boolean | null = null;
    roomMapping: boolean | null = null;
    NewSuctionPower: boolean | null = null;
    mop: boolean | null = null;
    dock_status: boolean | null = null;
    consumables: ConsumableFeature[] | null = null;

    constructor(deviceState: VacuumFeatureDeviceState, adapterInstance: FeatureAdapter) {
        this.deviceState = deviceState;
        this.adapter = adapterInstance;
    }

    init(): void {
        this.adapter.getState('info.device_model', (_error, state) => {
            if (state?.val) {
                this.setModel(state.val);
            }
        });
        this.adapter.setState('info.wifi_signal', null, true);
    }

    detect(): void {}

    setNewSuctionValues(value: number): Promise<void> {
        if (this.NewSuctionPower === null && value > 100) {
            this.adapter.log.info('change states from State control.fan_power');
            if (this.deviceState.modell === 'roborock.vacuum.a27') {
                objects.newfan_power.common.max = 108;
                objects.newfan_power.common.states['105'] = 'OFF';
                objects.newfan_power.common.states['108'] = 'MAXIMUM+';
            }
            this.NewSuctionPower = true;
            void this.adapter.extendObjectAsync('control.fan_power', objects.newfan_power);
            this.adapter.getStates('rooms.*', (_error, states) => {
                if (states) {
                    for (const stateId of Object.keys(states)) {
                        if (stateId.endsWith('.roomFanPower')) {
                            this.adapter.log.debug(`Updating room fan-power state definition: ${stateId}`);
                            void this.adapter.extendObjectAsync(stateId, objects.newfan_power);
                        }
                    }
                }
            });
        } else if (this.NewSuctionPower === null && value <= 100) {
            this.NewSuctionPower = false;
        }
        return Promise.resolve();
    }

    setModel(model: unknown): void {
        if (this.model !== model) {
            this.adapter.setStateChanged('info.device_model', model, true);
            this.model = model;
        }
    }

    async setWaterBox(status: unknown): Promise<void> {
        if (this.water_box === null) {
            this.water_box = isNumeric(status);
            if (this.water_box) {
                this.adapter.log.info('create states for water box');
                await this.adapter.setObjectNotExistsAsync('info.water_box', objects.water_box);
            }
        }
    }

    async setDustCollect(status: unknown): Promise<void> {
        if (this.dustCollect === null) {
            this.dustCollect = isNumeric(status);
            if (this.dustCollect) {
                this.adapter.log.info('create states for dust collecting');
                await this.adapter.setObjectNotExistsAsync('control.dustCollect', objects.dustCollect);
            }
        }
    }

    async setWashMop(status: unknown): Promise<void> {
        if (this.washMop === null) {
            this.washMop = isNumeric(status);
            if (this.washMop) {
                this.adapter.log.info('create states for Mop washing');
                await this.adapter.setObjectNotExistsAsync('control.washMop', objects.washMop);
            }
        }
    }

    async setMop(status: unknown): Promise<void> {
        if (typeof status === 'undefined') {
            return;
        }
        if (this.mop === null) {
            this.mop = isNumeric(status);
            if (this.mop) {
                this.adapter.log.info('create states for mop');
                await this.adapter.setObjectNotExistsAsync('info.mop', objects.mop);
                objects.newfan_power.common.states['105'] = 'OFF';
            }
        }
        void this.adapter.setStateAsync('info.mop', { val: !!status, ack: true });
    }

    async setWaterBoxMode(mode: unknown, distanceOff: unknown): Promise<void> {
        if (this.water_box_mode === null && mode) {
            this.water_box_mode = isNumeric(mode);
            if (this.water_box_mode) {
                this.adapter.log.info('create states for water box mode');
                if (isNumeric(distanceOff)) {
                    this.water_box_mode = 2;
                    objects.water_box_mode.common.max = 207;
                    objects.water_box_mode.common.states[207] = 'LEVEL';
                    await this.adapter.setObjectNotExistsAsync('control.water_box_level', objects.water_box_level);
                }
                await this.adapter.extendObjectAsync('control.water_box_mode', objects.water_box_mode);
            }
        }
    }

    async setMopMode(mode: unknown): Promise<void> {
        if (this.mop_mode === null && mode) {
            this.mop_mode = isNumeric(mode);
            if (this.mop_mode) {
                this.adapter.log.info('create states for mop mode');
                await this.adapter.setObjectNotExistsAsync('control.mop_mode', objects.mop_mode);
            }
        }
    }

    async setDockStatus(status: unknown): Promise<void> {
        if (this.dock_status === null && typeof status !== 'undefined') {
            this.dock_status = isNumeric(status);
            if (this.dock_status) {
                this.adapter.log.info('create states for dock status');
                await this.adapter.setObjectNotExistsAsync('info.dock_status', objects.dock_status);
            }
        }
    }
}

export = FeatureManager;
