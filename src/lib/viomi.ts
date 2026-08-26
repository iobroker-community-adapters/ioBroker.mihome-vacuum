import objectsModule from './objects';
import type {
    ViomiAdapter,
    ViomiMiioClient,
    ViomiMiioResponse,
    ViomiObjectDefinition,
    ViomiObjectsModule,
    ViomiState,
} from '../types/viomi';

const objects = objectsModule as ViomiObjectsModule;

class ViomiManager {
    readonly Miio: ViomiMiioClient;
    readonly adapter: ViomiAdapter;
    readonly lastProps: Record<string, unknown> = {};
    globalTimeouts: Record<string, NodeJS.Timeout | undefined> = {};
    closed = false;
    readonly ViomiDevices = [
        'dreame.vacuum.mc1808',
        'viomi.vacuum.v6',
        'viomi.vacuum.v7',
        'viomi.vacuum.v8',
        'viomi.vacuum.v19',
    ];
    readonly PARAMS = [
        'run_state',
        'suction_grade',
        'mode',
        'err_state',
        'battary_life',
        'start_time',
        'order_time',
        's_time',
        's_area',
        'v_state',
        'zone_data',
        'repeat_state',
        'remember_map',
        'has_map',
        'water_grade',
        'box_type',
        'mop _type',
        'is_mop',
        'light_state',
        'has_newmap',
        'is_charge',
        'is_work',
    ];
    readonly ERROR_CODES: Record<number, string> = {
        500: 'Radar timed out',
        501: 'Wheels stuck',
        502: 'Low battery',
        503: 'Dust bin missing',
        508: 'Uneven ground',
        509: 'Cliff sensor error',
        510: 'Collision sensor error',
        511: 'Could not return to dock',
        512: 'Could not return to dock',
        513: 'Could not navigate',
        514: 'Vacuum stuck',
        515: 'Charging error',
        516: 'Mop temperature error',
        521: 'Water tank is not installed',
        522: 'Mop is not installed',
        525: 'Insufficient water in water tank',
        527: 'Remove mop',
        528: 'Dust bin missing',
        529: 'Mop and water tank missing',
        530: 'Mop and water tank missing',
        531: 'Water tank is not installed',
        2101: 'Unsufficient battery, continuing cleaning after recharge',
        2105: 'No Error',
    };
    readonly STATES: Record<number, string> = {
        '-1': 'Unknown',
        0: 'IdleNotDocked ',
        1: 'Idle',
        2: 'Idle 2',
        3: 'Cleaning',
        4: 'Returning ',
        5: 'Docked',
        6: 'VacuumingAndMopping',
    };
    readonly FANSPEED: Record<number, string> = {
        0: 'Silent',
        1: 'Standard',
        2: 'Medium',
        3: 'Turbo',
    };
    readonly MODE: Record<number, string> = {
        0: 'Vacuum',
        1: 'VacuumAndMop',
        2: 'Mop',
    };
    readonly ready: Promise<void>;

    constructor(adapterInstance: ViomiAdapter, Miio: ViomiMiioClient) {
        this.Miio = Miio;
        this.adapter = adapterInstance;
        this.adapter.log.debug('select viomi protocol....');
        this.ready = this.main();
    }

    async main(): Promise<void> {
        await this.initStates();
        if (this.closed) {
            return;
        }
        void this.getStates();
    }

    async getStates(): Promise<void> {
        if (this.closed) {
            return;
        }
        clearTimeout(this.globalTimeouts.getStates);
        let deviceData: ViomiMiioResponse | null | undefined;

        this.adapter.log.debug('get params for Viomi');
        try {
            deviceData = await this.Miio.sendMessage('get_prop', this.PARAMS);
            this.adapter.log.debug('Received parameters for Viomi');
        } catch {
            deviceData = null;
            if (!this.closed) {
                this.adapter.log.debug('Could not receive Viomi parameters');
            }
        }

        if (this.closed) {
            return;
        }

        if (deviceData && Array.isArray(deviceData.result)) {
            const answer = deviceData.result;
            answer.slice(0, this.PARAMS.length).forEach((element, index) => {
                const parameter = this.PARAMS[index];
                const objectExists = objects.viomiObjects.find(
                    (stateDefinition: ViomiObjectDefinition) => stateDefinition._id === parameter,
                );

                this.lastProps[parameter] = element;
                if (objectExists !== undefined) {
                    void this.adapter.setStateAsync(`control.${parameter}`, {
                        val: objectExists.common.type === 'boolean' ? !!element : element,
                        ack: true,
                    });
                }
            });
        }
        if (!this.closed) {
            this.globalTimeouts.getStates = setTimeout(() => void this.getStates(), this.adapter.config.pingInterval);
        }
    }

    async initStates(): Promise<void> {
        await Promise.all(
            objects.viomiObjects.map((object: ViomiObjectDefinition) =>
                this.adapter.setObjectNotExistsAsync(`control${object._id ? `.${object._id}` : ''}`, object),
            ),
        );
    }

    async stateChange(id: string, state: ViomiState | null | undefined): Promise<void> {
        if (!state || state.ack) {
            return;
        }
        const terms = id.split('.');
        const command = terms.pop();
        let data: ViomiMiioResponse | null | undefined;
        let actionMode: unknown;
        let method: string;
        let params: unknown[];

        try {
            switch (command) {
                case 'suction_grade':
                    data = await this.Miio.sendMessage('set_suction', [state.val]);
                    this.adapter.log.debug('change suction_grade');
                    break;
                case 'water_grade':
                    data = await this.Miio.sendMessage('set_suction', [state.val]);
                    this.adapter.log.debug('change water_grade');
                    break;
                case 'is_mop':
                    data = await this.Miio.sendMessage('set_mop', [state.val]);
                    this.adapter.log.debug('change mop');
                    break;
                case 'light_state':
                    data = await this.Miio.sendMessage('set_light', [state.val ? 1 : 0]);
                    this.adapter.log.debug('change light_state');
                    break;
                case 'start':
                    if (this.lastProps.mode === 4) {
                        return;
                    }
                    actionMode = this.getActionMode();
                    if (this.lastProps.mode === 3) {
                        method = 'set_mode';
                        params = [3, 1];
                    } else {
                        method = 'set_mode_withroom';
                        params = [actionMode, 1, 0];
                    }
                    data = await this.Miio.sendMessage(method, params);
                    this.adapter.log.debug(`start with: ${method}`);
                    break;
                case 'pause':
                    if (this.lastProps.mode === 4) {
                        return;
                    }
                    actionMode = this.getActionMode();
                    if (this.lastProps.mode === 3) {
                        method = 'set_mode';
                        params = [3, 3];
                    } else {
                        method = 'set_mode_withroom';
                        params = [actionMode, 3, 0];
                    }
                    data = await this.Miio.sendMessage(method, params);
                    this.adapter.log.debug(`pause with: ${method}`);
                    break;
                case 'stop':
                    if (this.lastProps.mode === 3) {
                        method = 'set_mode';
                        params = [3, 0];
                    } else if (this.lastProps.is_mop === 4) {
                        method = 'set_pointclean';
                        params = [0, 0, 0];
                    } else {
                        method = 'set_mode';
                        params = [0];
                    }
                    data = await this.Miio.sendMessage(method, params);
                    this.adapter.log.debug(`stop with: ${method}`);
                    break;
                case 'return_dock':
                    data = await this.Miio.sendMessage('set_charge', [1]);
                    this.adapter.log.debug('change mop');
                    break;
                default:
                    return;
            }
            if (data) {
                void this.adapter.setStateAsync(id, { val: state.val, ack: true });
            }
        } catch {
            this.adapter.log.warn(`Cannot send Viomi command ${command}; please try again`);
        }
    }

    private getActionMode(): unknown {
        if (this.lastProps.mode === 2) {
            return 2;
        }
        return this.lastProps.is_mop === 2 ? 3 : this.lastProps.is_mop;
    }

    startClean(): void {}

    close(): Promise<void> {
        if (this.closed) {
            return Promise.resolve();
        }
        this.closed = true;
        Object.keys(this.globalTimeouts).forEach(id => {
            const timeout = this.globalTimeouts[id];
            if (timeout) {
                clearTimeout(timeout);
            }
        });
        this.globalTimeouts = {};
        return Promise.resolve();
    }
}

export = ViomiManager;
