"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const objects_1 = __importDefault(require("./objects"));
const dreameProtocol_1 = require("./dreameProtocol");
const objects = objects_1.default;
const { DreameWaterVolumes, DreameErrors, DreameState: DreameStates, DreameWashBaseState, DreameProperties, DreameActions, DreameBlockedObjects, } = dreameProtocol_1.dreameProtocol;
function resultArray(response) {
    return response && Array.isArray(response.result) ? response.result : null;
}
class DreameManager {
    static DreameWaterVolumes = DreameWaterVolumes;
    static DreameErrors = DreameErrors;
    static DreameState = DreameStates;
    static DreameWashBaseState = DreameWashBaseState;
    static DreameProperties = DreameProperties;
    static DreameActions = DreameActions;
    static DreameBlockedObjects = DreameBlockedObjects;
    Miio;
    adapter;
    washBaseAvailable = false;
    globalTimeouts = {};
    closed = false;
    PARAMS = [
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
    ready;
    constructor(adapterInstance, Miio) {
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
            }
            else {
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
    async createObjects(prefix, definitions, logName) {
        await Promise.all(definitions.map(async (object) => {
            if (!DreameBlockedObjects.includes(object._id)) {
                const contents = await this.adapter.setObjectNotExistsAsync(`${prefix}${object._id ? `.${object._id}` : ''}`, object);
                if (contents) {
                    this.adapter.log.debug(`Create ${logName}: ${JSON.stringify(contents)}`);
                }
            }
        }));
    }
    async init() {
        await this.createObjects('control', objects.stockControl, 'State for control');
        await this.createObjects('info', objects.stockInfo, 'State for stockInfo');
        await this.createObjects('setting', objects.settings, 'State for settings');
        if (!DreameBlockedObjects.includes('consumable')) {
            await this.adapter.setObjectNotExistsAsync('consumable', objects.stockConsumable.channel);
            for (const item of Object.values(objects.stockConsumable.list)) {
                if (!DreameBlockedObjects.includes(item.state._id)) {
                    let contents = await this.adapter.setObjectNotExistsAsync(`consumable.${item.state._id}`, item.state);
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
    async main() {
        await this.init();
        if (!this.closed) {
            void this.getStates();
        }
    }
    async getStates() {
        if (this.closed) {
            return;
        }
        this.adapter.clearTimeout(this.globalTimeouts.getStates);
        let deviceData = null;
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
            }
            catch {
                deviceData = null;
                if (this.closed) {
                    return;
                }
                this.adapter.log.debug('Could not receive Dreame properties');
            }
            const answer = resultArray(deviceData);
            answer?.forEach(element => {
                for (const propertyDefinition of Object.values(DreameProperties)) {
                    if (propertyDefinition.control !== undefined &&
                        propertyDefinition.siid == element.siid &&
                        propertyDefinition.piid == element.piid) {
                        this.updateObjectValue(propertyDefinition, propertyDefinition.control, element);
                    }
                }
            });
        }
        if (!this.closed) {
            this.globalTimeouts.getStates = this.adapter.setTimeout(() => void this.getStates(), this.adapter.config.pingInterval);
        }
    }
    updateObjectValue(property, control, element) {
        let value = element.value;
        if (!this.getSpecialHandlingValues(property.control, value)) {
            value = this.mapDeviceValueToStateValue(value, property);
            if (property.type === 'int') {
                value = Number.parseInt(String(value), 10);
            }
            else if (property.type === 'boolean') {
                value = Boolean(value);
            }
            void this.adapter.setStateAsync(control, { val: value, ack: true });
            this.adapter.log.debug(`Updated Dreame property: ${control}`);
        }
    }
    mapDeviceValueToStateValue(value, property) {
        if (property.control_mapping !== undefined) {
            for (const [mappingKey, mappedValue] of Object.entries(property.control_mapping)) {
                if (Array.isArray(mappedValue)) {
                    if (mappedValue.some(newValue => newValue == value)) {
                        return mappingKey;
                    }
                }
                else if (mappedValue == value) {
                    return mappingKey;
                }
            }
        }
        return value;
    }
    getSpecialHandlingValues(control, dreameValue) {
        if (!control || control !== DreameProperties.CHARGING_STATUS.control) {
            return false;
        }
        const value = dreameValue == 1;
        void this.adapter.setStateAsync(control, { val: value, ack: true });
        this.adapter.log.debug(`Updated specially handled Dreame property: ${control}`);
        return true;
    }
    async stateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        id = id.replace(`${this.adapter.namespace}.`, '');
        this.adapter.log.info(`State changed: ${id}`);
        if (await this.doCustomHandling(id)) {
            return;
        }
        let deviceData = null;
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
        }
        catch {
            this.adapter.log.warn("Can't send Dreame command; please try again");
        }
    }
    async doCustomHandling(id) {
        this.adapter.log.debug('Going to do custom handling...');
        let result;
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
        }
        else {
            this.adapter.log.error('Custom handling error! Leave button/action unacknowledged.');
        }
        return true;
    }
    async washMop() {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val == DreameWashBaseState.PAUSED) {
            this.adapter.log.debug('Washing of mop paused. Send resume action!');
            return this.callWashBaseAction('1,1');
        }
        this.adapter.log.debug('Washing of mop paused. Send wash action!');
        return this.callWashBaseAction('2,1');
    }
    async pauseWashMop() {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val == DreameWashBaseState.WASHING) {
            this.adapter.log.debug('Washing mop. Send pause action!');
            return this.callWashBaseAction('1,0');
        }
        this.adapter.log.debug('Not Washing mop.');
        return false;
    }
    async dryMop() {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val != DreameWashBaseState.DRYING) {
            this.adapter.log.debug('Send dry action!');
            return this.callWashBaseAction('3,1');
        }
        return true;
    }
    async stopDryingMop() {
        const state = await this.adapter.getStateAsync('info.dock_state');
        if (state?.val && state.val == DreameWashBaseState.DRYING) {
            this.adapter.log.debug('Mop is drying. Send stop action!');
            return this.callWashBaseAction('3,0');
        }
        this.adapter.log.info("Can't stop drying because robot is not in status drying!");
        return true;
    }
    async callWashBaseAction(parameters) {
        const actionParameters = [{ piid: DreameProperties.CLEANING_PROPERTIES.piid, value: parameters }];
        this.adapter.log.debug('Send washbase action');
        if (!this.washBaseAvailable) {
            return false;
        }
        return this.sendActionToDevice(DreameActions.START_WASHING, actionParameters);
    }
    async sendValueToDevice(propertyDefinition, state) {
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
    async sendActionToDevice(actionDefinition, parameters = '[]') {
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
    close() {
        if (this.closed) {
            return Promise.resolve();
        }
        this.closed = true;
        for (const timeout of Object.values(this.globalTimeouts)) {
            if (timeout) {
                this.adapter.clearTimeout(timeout);
            }
        }
        this.globalTimeouts = {};
        return Promise.resolve();
    }
}
function asActionResult(value) {
    return value !== null && typeof value === 'object' ? value : null;
}
module.exports = DreameManager;
//# sourceMappingURL=dreame.js.map