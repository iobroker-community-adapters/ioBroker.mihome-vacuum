import objectsModule from './objects';
import { dreameProtocol as protocol } from './dreameProtocol';
import type {
    DreameActionDefinition,
    DreameAdapter,
    DreameMiioClient,
    DreameMiioResponse,
    DreameObjectDefinition,
    DreameObjectsModule,
    DreamePropertyDefinition,
    DreamePropertyValue,
    DreameState,
} from '../types/dreame';

const objects = objectsModule as DreameObjectsModule;
const {
    DreameWaterVolumes,
    DreameErrors,
    DreameState: DreameStates,
    DreameWashBaseState,
    DreameProperties,
    DreameActions,
    DreameBlockedObjects,
} = protocol;

function resultArray(response: DreameMiioResponse | null | undefined): DreamePropertyValue[] | null {
    return response && Array.isArray(response.result) ? (response.result as DreamePropertyValue[]) : null;
}

class DreameManager {
    static readonly DreameWaterVolumes = DreameWaterVolumes;
    static readonly DreameErrors = DreameErrors;
    static readonly DreameState = DreameStates;
    static readonly DreameWashBaseState = DreameWashBaseState;
    static readonly DreameProperties = DreameProperties;
    static readonly DreameActions = DreameActions;
    static readonly DreameBlockedObjects = DreameBlockedObjects;

    readonly Miio: DreameMiioClient;
    readonly adapter: DreameAdapter;
    washBaseAvailable = false;
    globalTimeouts: Record<string, NodeJS.Timeout | undefined> = {};
    closed = false;
    readonly PARAMS: DreamePropertyDefinition[] = [
        DreameProperties.STATE,
        DreameProperties.ERROR,
        DreameProperties.BATTERY_LEVEL,
        DreameProperties.CHARGING_STATUS,
        DreameProperties.CLEANED_AREA,
        DreameProperties.CLEANING_TIME,
        DreameProperties.VOLUME,
        DreameProperties.MAIN_BRUSH_LEFT,
        DreameProperties.MOP_PAD_LEFT,
        DreameProperties.SIDE_BRUSH_LEFT,
        DreameProperties.FILTER_LEFT,
        DreameProperties.SENSOR_DIRTY_LEFT,
        DreameProperties.SUCTION_LEVEL,
        DreameProperties.WATER_VOLUME,
        DreameProperties.DND,
        DreameProperties.TOTAL_CLEANING_TIME,
        DreameProperties.CLEANING_COUNT,
        DreameProperties.TOTAL_CLEANED_AREA,
    ];
    readonly ready: Promise<void>;

    constructor(adapterInstance: DreameAdapter, Miio: DreameMiioClient) {
        this.Miio = Miio;
        this.adapter = adapterInstance;
        this.adapter.log.debug('select dreame protocol...');

        const data = [
            {
                did: '',
                siid: DreameProperties.SELF_WASH_BASE_STATUS.siid,
                piid: DreameProperties.SELF_WASH_BASE_STATUS.piid,
            },
        ];
        void this.Miio.sendMessage('get_properties', data)
            .then(result => {
                if (this.closed) {
                    return;
                }
                const properties = resultArray(result);
                if (properties?.[0] && properties[0].code != -1) {
                    this.washBaseAvailable = true;
                    this.PARAMS.push(DreameProperties.SELF_WASH_BASE_STATUS);
                    this.adapter.log.debug('Wash base found!');
                } else {
                    this.adapter.log.debug('No wash base found!');
                }
            })
            .catch(() => {
                if (!this.closed) {
                    this.adapter.log.debug('Could not determine wash base availability');
                }
            });

        this.ready = this.main();
    }

    private async createObjects(prefix: string, definitions: DreameObjectDefinition[], logName: string): Promise<void> {
        await Promise.all(
            definitions.map(async object => {
                if (!DreameBlockedObjects.includes(object._id)) {
                    const contents = await this.adapter.setObjectNotExistsAsync(
                        `${prefix}${object._id ? `.${object._id}` : ''}`,
                        object,
                    );
                    if (contents) {
                        this.adapter.log.debug(`Create ${logName}: ${JSON.stringify(contents)}`);
                    }
                }
            }),
        );
    }

    async init(): Promise<void> {
        await this.createObjects('control', objects.stockControl, 'State for control');
        await this.createObjects('info', objects.stockInfo, 'State for stockInfo');
        await this.createObjects('setting', objects.settings, 'State for settings');

        if (!DreameBlockedObjects.includes('consumable')) {
            await this.adapter.setObjectNotExistsAsync('consumable', objects.stockConsumable.channel);
            for (const item of Object.values(objects.stockConsumable.list)) {
                if (!DreameBlockedObjects.includes(item.state._id)) {
                    let contents = await this.adapter.setObjectNotExistsAsync(
                        `consumable.${item.state._id}`,
                        item.state,
                    );
                    if (contents) {
                        this.adapter.log.debug(`Create State for consumable: ${JSON.stringify(contents)}`);
                    }
                    contents = await this.adapter.setObjectNotExistsAsync(`consumable.${item.button._id}`, item.button);
                    if (contents) {
                        this.adapter.log.debug(`Create Button for consumable: ${JSON.stringify(contents)}`);
                    }
                }
            }
        }

        await this.createObjects('history', objects.stockHistory, 'State for stockHistory');
        this.adapter.log.debug('Get Status Wash Base to create objects.');
        if (this.washBaseAvailable) {
            await this.createObjects('control', objects.wash_base, 'Wash Base State for control');
            await this.createObjects('info', objects.wash_base_info, 'Wash Base State for info');
        }
        this.adapter.log.debug('Create State done!');
    }

    async main(): Promise<void> {
        await this.init();
        if (!this.closed) {
            void this.getStates();
        }
    }

    async getStates(): Promise<void> {
        if (this.closed) {
            return;
        }
        clearTimeout(this.globalTimeouts.getStates);
        let deviceData: DreameMiioResponse | null = null;
        this.adapter.log.debug('get params for Dreame');
        const chunkSize = 15;
        for (let index = 0; index < this.PARAMS.length; index += chunkSize) {
            try {
                const request = this.PARAMS.slice(index, index + chunkSize).map(property => ({
                    did: '',
                    siid: property.siid,
                    piid: property.piid,
                }));
                this.adapter.log.debug(`Requesting ${request.length} Dreame properties`);
                deviceData = await this.Miio.sendMessage('get_properties', request);
                if (this.closed) {
                    return;
                }
                this.adapter.log.debug('Received Dreame property response');
            } catch {
                deviceData = null;
                if (this.closed) {
                    return;
                }
                this.adapter.log.debug('Could not receive Dreame properties');
            }

            const answer = resultArray(deviceData);
            answer?.forEach(element => {
                for (const propertyDefinition of Object.values(DreameProperties)) {
                    if (
                        propertyDefinition.control !== undefined &&
                        propertyDefinition.siid == element.siid &&
                        propertyDefinition.piid == element.piid
                    ) {
                        this.updateObjectValue(propertyDefinition, propertyDefinition.control, element);
                    }
                }
            });
        }
        if (!this.closed) {
            this.globalTimeouts.getStates = setTimeout(() => void this.getStates(), this.adapter.config.pingInterval);
        }
    }

    updateObjectValue(property: DreamePropertyDefinition, control: string, element: DreamePropertyValue): void {
        let value = element.value;
        if (!this.getSpecialHandlingValues(property.control, value)) {
            value = this.mapDeviceValueToStateValue(value, property);
            if (property.type === 'int') {
                value = Number.parseInt(String(value), 10);
            } else if (property.type === 'boolean') {
                value = Boolean(value);
            }
            void this.adapter.setStateAsync(control, { val: value, ack: true });
            this.adapter.log.debug(`Updated Dreame property: ${control}`);
        }
    }

    mapDeviceValueToStateValue(value: unknown, property: DreamePropertyDefinition): unknown {
        if (property.control_mapping !== undefined) {
            for (const [mappingKey, mappedValue] of Object.entries(property.control_mapping)) {
                if (Array.isArray(mappedValue)) {
                    if (mappedValue.some(newValue => newValue == value)) {
                        return mappingKey;
                    }
                } else if (mappedValue == value) {
                    return mappingKey;
                }
            }
        }
        return value;
    }

    getSpecialHandlingValues(control: string | undefined, dreameValue: unknown): boolean {
        if (!control || control !== DreameProperties.CHARGING_STATUS.control) {
            return false;
        }
        const value = dreameValue == 1;
        void this.adapter.setStateAsync(control, { val: value, ack: true });
        this.adapter.log.debug(`Updated specially handled Dreame property: ${control}`);
        return true;
    }

    async stateChange(id: string, state: DreameState | null | undefined): Promise<void> {
        if (!state || state.ack) {
            return;
        }
        id = id.replace(`${this.adapter.namespace}.`, '');
        this.adapter.log.info(`State changed: ${id}`);
        if (await this.doCustomHandling(id)) {
            return;
        }

        let deviceData: DreameMiioResponse | boolean | null = null;
        try {
            for (const propertyDefinition of Object.values(DreameProperties)) {
                if (id == propertyDefinition.control) {
                    deviceData = await this.sendValueToDevice(propertyDefinition, state);
                }
            }
            if (deviceData && typeof deviceData === 'object' && deviceData.result) {
                await this.getStates();
                return;
            }

            for (const actionDefinition of Object.values(DreameActions)) {
                if (id == actionDefinition.control) {
                    deviceData = await this.sendActionToDevice(actionDefinition);
                }
            }
            if (deviceData && typeof deviceData === 'object' && deviceData.result) {
                void this.adapter.setStateAsync(id, { val: false, ack: true });
                void this.getStates();
            }
        } catch {
            this.adapter.log.warn("Can't send Dreame command; please try again");
        }
    }

    async doCustomHandling(id: string): Promise<boolean> {
        this.adapter.log.debug('Going to do custom handling...');
        let result: boolean;
        switch (id) {
            case 'control.washMop':
                result = await this.washMop();
                break;
            case 'control.pauseWashMop':
                result = await this.pauseWashMop();
                break;
            case 'control.startDrying':
                result = await this.dryMop();
                break;
            case 'control.stopDrying':
                result = await this.stopDryingMop();
                break;
            default:
                this.adapter.log.debug('No custom handling defined!');
                return false;
        }
        if (result) {
            this.adapter.log.debug('Custom handling successful. Going to reset state of button!');
            void this.adapter.setStateAsync(id, { val: false, ack: true });
            void this.getStates();
        } else {
            this.adapter.log.error('Custom handling error! Leave button/action unacknowledged.');
        }
        return true;
    }

    async washMop(): Promise<boolean> {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val == DreameWashBaseState.PAUSED) {
            this.adapter.log.debug('Washing of mop paused. Send resume action!');
            return this.callWashBaseAction('1,1');
        }
        this.adapter.log.debug('Washing of mop paused. Send wash action!');
        return this.callWashBaseAction('2,1');
    }

    async pauseWashMop(): Promise<boolean> {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val == DreameWashBaseState.WASHING) {
            this.adapter.log.debug('Washing mop. Send pause action!');
            return this.callWashBaseAction('1,0');
        }
        this.adapter.log.debug('Not Washing mop.');
        return false;
    }

    async dryMop(): Promise<boolean> {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val != DreameWashBaseState.DRYING) {
            this.adapter.log.debug('Send dry action!');
            return this.callWashBaseAction('3,1');
        }
        return true;
    }

    async stopDryingMop(): Promise<boolean> {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val == DreameWashBaseState.DRYING) {
            this.adapter.log.debug('Mop is drying. Send stop action!');
            return this.callWashBaseAction('3,0');
        }
        this.adapter.log.info("Can't stop drying because robot is not in status drying!");
        return true;
    }

    async callWashBaseAction(parameters: string): Promise<boolean> {
        const actionParameters = [{ piid: DreameProperties.CLEANING_PROPERTIES.piid, value: parameters }];
        this.adapter.log.debug('Send washbase action');
        if (!this.washBaseAvailable) {
            return false;
        }
        return this.sendActionToDevice(DreameActions.START_WASHING, actionParameters);
    }

    async sendValueToDevice(
        propertyDefinition: DreamePropertyDefinition,
        state: DreameState,
    ): Promise<DreameMiioResponse> {
        let value = state.val;
        if (propertyDefinition.control_mapping !== undefined) {
            for (const [mappingKey, mappedValue] of Object.entries(propertyDefinition.control_mapping)) {
                if (mappingKey == value) {
                    value = mappedValue;
                }
            }
        }
        this.adapter.log.debug(`Changing Dreame property: ${propertyDefinition.control}`);
        return this.Miio.sendMessage('set_properties', [
            {
                did: propertyDefinition.did,
                siid: propertyDefinition.siid,
                piid: propertyDefinition.piid,
                value,
            },
        ]);
    }

    async sendActionToDevice(actionDefinition: DreameActionDefinition, parameters: unknown = '[]'): Promise<boolean> {
        this.adapter.log.debug(`Sending Dreame action: ${actionDefinition.control}`);
        const returnData = await this.Miio.sendMessage('action', {
            did: actionDefinition.did,
            siid: actionDefinition.siid,
            aiid: actionDefinition.aiid,
            in: parameters,
        });
        const result = asActionResult(returnData.result);
        if (result?.code == -1) {
            this.adapter.log.debug('Action failed! MIOT Action not available or data sent not correct.');
            return false;
        }
        this.adapter.log.debug('Action successfull!');
        return true;
    }

    close(): Promise<void> {
        if (this.closed) {
            return Promise.resolve();
        }
        this.closed = true;
        for (const timeout of Object.values(this.globalTimeouts)) {
            if (timeout) {
                clearTimeout(timeout);
            }
        }
        this.globalTimeouts = {};
        return Promise.resolve();
    }
}

function asActionResult(value: unknown): { code?: number } | null {
    return value !== null && typeof value === 'object' ? value : null;
}

export = DreameManager;
