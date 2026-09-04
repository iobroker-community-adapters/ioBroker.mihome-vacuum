'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.MihomeVacuum = void 0;
const diagnostics_1 = require("./lib/diagnostics");
const protectedConfig_1 = require("./lib/protectedConfig");
/*
 * Created with @iobroker/create-adapter v1.27.0
 */
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const XiaomiCloudConnector = require('./lib/XiaomiCloudConnector');
const miio = require('./lib/miio');
/** @typedef {ioBroker.SettableObject & {_id?: string, id?: string}} LegacyObjectDefinition */
const objects = /** @type {{deviceInfo: LegacyObjectDefinition[], customCommands: LegacyObjectDefinition[], iotState: LegacyObjectDefinition[]}} */ /** @type {unknown} Legacy definitions are runtime-validated by package tests. */ require('./lib/objects');
const ViomiManager = require('./lib/viomi');
const VacuumManager = require('./lib/vacuum');
const DreameManager = require('./lib/dreame');
class MihomeVacuum extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'mihome-vacuum',
        });
        this.unsupportedFeatures = '|';
        this.miio = null;
        this.vacuum = null;
        this.xiaomiApi = null;
        this.on('ready', this.onReady.bind(this));
        // @ts-ignore adapter-core's event overloads do not expose the supported stateChange runtime event here.
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    async main() {
        // @ts-ignore legacy adapter config is runtime-validated
        this.config.port = parseInt(this.config.port, 10) || 54321;
        // @ts-ignore legacy adapter config is runtime-validated
        this.config.ownPort = parseInt(this.config.ownPort, 10) || 53421;
        // @ts-ignore legacy adapter config is runtime-validated
        this.config.pingInterval = parseInt(this.config.pingInterval, 10) || 20000;
        // Abfrageintervall mindestens 10 sec.
        // @ts-ignore legacy adapter config is runtime-validated
        if (this.config.pingInterval < 10000) {
            // @ts-ignore legacy adapter config is runtime-validated
            this.config.pingInterval = 10000;
        }
        this.advancedDiagnostic('adapter configuration', {
            region: this.config.server,
            model: this.config.model,
            manager: this.config.manager || 'auto',
            vacuumPort: this.config.port,
            ownPort: this.config.ownPort,
            pingInterval: this.config.pingInterval,
            wifiInterval: this.config.wifiInterval,
            enableMiMap: this.config.enableMiMap === true,
            enableSelfCommands: this.config.enableSelfCommands === true,
            enableResumeZone: this.config.enableResumeZone === true,
            sendPauseBeforeHome: this.config.sendPauseBeforeHome === true,
            valetudoEnabled: this.config.valetudo_enable === true,
            deviceCredentialConfigured: typeof this.config.token === 'string' && this.config.token.length > 0,
            accountCredentialConfigured: typeof this.config.password === 'string' && this.config.password.length > 0,
            cloudAuthenticationConfigured: typeof this.config.cloudSession === 'string' && this.config.cloudSession.length > 0,
            localAddressConfigured: typeof this.config.ip === 'string' && this.config.ip.length > 0,
        });
        // encryptedNative is decrypted by js-controller before the ready event. Validate the
        // resulting clear-text token before it can reach the local UDP protocol implementation.
        // @ts-ignore legacy adapter config is runtime-validated
        const configuredToken = typeof this.config.token === 'string' ? this.config.token.replace(/\s/g, '') : '';
        if (!configuredToken) {
            this.log.warn('Token not specified!');
            return;
        }
        if (!/^(?:[a-f\d]{31}|[a-f\d]{32}|[a-f\d]{96})$/i.test(configuredToken)) {
            this.log.error('Token is invalid or could not be decrypted!');
            return;
        }
        // @ts-ignore legacy adapter config is runtime-validated
        this.config.token = configuredToken;
        // create default States
        await Promise.all(objects.deviceInfo.map(async (o) => {
            const objectId = `deviceInfo${o._id ? `.${o._id}` : ''}`;
            await this.setObjectNotExistsAsync(objectId, o);
            if (o._id === 'wifi_signal') {
                await this.extendObjectAsync(objectId, { common: { def: 0 } });
            }
            this.log.debug(`Creating ${o.type === 'channel' ? 'channel' : 'state'}: ${objectId}`);
        }));
        //create new miio class
        this.miio = new miio(this);
        this.miio.on('connect', () => {
            this.handleConnect();
        });
        //check if Self send Commands is enabled
        // @ts-ignore legacy adapter config is runtime-validated
        if (this.config.enableSelfCommands) {
            await Promise.all(objects.customCommands.map(o => this.setObjectNotExistsAsync(`control${o._id ? `.${o._id}` : ''}`, o)));
        }
        else {
            await Promise.all(objects.customCommands.filter(o => o._id).map(o => this.delObj(`control.${o._id}`)));
        }
        // clean_home is updated by VacuumManager for every supported robot. It must exist
        // independently of the optional Alexa/IOT integration.
        await this.setObjectNotExistsAsync('control.clean_home', objects.iotState[0]);
        // check if additional iot states are enabled
        // @ts-ignore legacy adapter config is runtime-validated
        if (this.config.enableAlexa) {
            this.log.debug('IoT integration enabled; creating additional states');
            await Promise.all(objects.iotState
                .slice(1)
                .map(o => this.setObjectNotExistsAsync(`control${o._id ? `.${o._id}` : ''}`, o)));
        }
        else {
            this.log.debug('IoT integration disabled; removing additional states');
            await Promise.all(objects.iotState.slice(1).map(o => this.delObj(`control${o._id ? `.${o._id}` : ''}`)));
        }
        const unsupportedState = await this.getStateAsync('deviceInfo.unsupported');
        if (unsupportedState && typeof unsupportedState.val === 'string') {
            const storedFeatures = unsupportedState.val;
            this.unsupportedFeatures = storedFeatures
                ? `${storedFeatures.startsWith('|') ? '' : '|'}${storedFeatures}${storedFeatures.endsWith('|') ? '' : '|'}`
                : '|';
        }
    }
    async handleConnect() {
        try {
            this.log.debug('MAIN: Connected to device, try to get model..');
            this.setState('info.IPAddress', {
                // @ts-ignore legacy adapter config is runtime-validated
                val: this.config.ip,
                ack: true,
            });
            await this.getModel();
            if (!this.vacuum) {
                return;
            }
            this.subscribeStates('*');
        }
        catch {
            this.log.error('Device connection initialization failed');
            try {
                await this.setConnection(false);
            }
            catch {
                this.log.debug('Could not reset the connection indicator after the device connection failure');
            }
        }
    }
    advancedDiagnostic(operation, details) {
        (0, diagnostics_1.logAdvancedDiagnostic)(this.log, this.config.enableAdvancedDebug === true, operation, details);
    }
    isUnsupportedFeature(key) {
        return this.unsupportedFeatures.indexOf(`|${key}|`) >= 0;
    }
    async setUnsupportedFeature(key) {
        if (this.unsupportedFeatures.indexOf(`|${key}|`) == -1) {
            this.unsupportedFeatures += `${key}|`;
            try {
                await this.setStateAsync('deviceInfo.unsupported', this.unsupportedFeatures, true);
            }
            catch {
                this.log.warn('Could not persist a detected unsupported device feature');
            }
        }
    }
    /**
     * first communication to find out the model
     */
    async getModel() {
        let DeviceModel;
        let DeviceData;
        // try 5 times to get data
        for (let i = 0; i < 5; i++) {
            DeviceData = await this.getModelFromApi();
            if (DeviceData) {
                this.advancedDiagnostic('local miIO.info response structure', { payload: DeviceData });
                this.log.debug(`miIO.info attempt ${i + 1}/5 succeeded`);
                await this.setModelInfoObject(DeviceData.result);
                DeviceModel = DeviceData.result.model;
                await this.setConnection(true);
                break;
            }
            this.log.debug(`miIO.info attempt ${i + 1}/5 completed without device information`);
        }
        if (!DeviceData) {
            //try to get from Config
            // @ts-ignore legacy adapter config is runtime-validated
            DeviceModel = this.config.model;
            if (DeviceModel) {
                this.log.warn('Device information did not answer during startup; using the configured model');
            }
            else {
                const objModel = await this.getStateAsync('deviceInfo.model');
                if (objModel && objModel.val) {
                    DeviceModel = objModel.val;
                    this.log.warn('Device information did not answer during startup; using the stored model');
                }
            }
        }
        if (!DeviceModel) {
            this.log.error('could not find model, please try again later or set manually in config');
            return;
        }
        this.log.info(`Device model detected: ${DeviceModel}`);
        // @ts-ignore legacy adapter config is runtime-validated
        const manager = this.getManager(DeviceModel, this.config.manager);
        //we get a model so we can select a protocol
        if (manager) {
            this.device = DeviceModel;
            const vacuum = new manager(this, this.miio);
            this.vacuum = vacuum;
            try {
                await vacuum.ready;
            }
            catch {
                this.log.error('Could not initialize the selected vacuum manager');
                try {
                    await vacuum.close();
                }
                catch {
                    this.log.debug('Could not fully clean up the failed vacuum manager initialization');
                }
                if (this.vacuum === vacuum) {
                    this.vacuum = null;
                }
                await this.setConnection(false);
            }
        }
    }
    getManager(model, configuredManager) {
        const managerList = {
            viomi: ViomiManager,
            roborock: VacuumManager,
            rockrobo: VacuumManager,
            dreame: DreameManager,
            xiaomi: DreameManager,
        };
        let manager;
        if (configuredManager) {
            manager = managerList[configuredManager];
            if (!manager) {
                this.log.error(`selected manager ${configuredManager} is not supported`);
            }
        }
        else if (model) {
            //try to get stock Model maybe it is working
            manager = managerList[model.split('.')[0]];
            if (!manager) {
                this.log.error(`Model ${model} not supported! You can try to setup manually a library in settings.`);
            }
        }
        return manager;
    }
    /**
     * function to set DeviceInfo
     *
     * @param deviceInfo Model name from Xiaomi eg: viomi.vacuum.v8
     */
    async setModelInfoObject(deviceInfo) {
        await this.setStateAsync('deviceInfo.model', {
            val: deviceInfo.model,
            ack: true,
        });
        await this.setStateAsync('deviceInfo.fw_ver', {
            val: deviceInfo.fw_ver,
            ack: true,
        });
        await this.setStateAsync('deviceInfo.mac', {
            val: deviceInfo.mac,
            ack: true,
        });
        return true;
    }
    /**
     * Function to set the connection indicator
     *
     * @param indicator could be true or false
     */
    async setConnection(indicator) {
        await this.setStateAsync('info.connection', {
            val: indicator,
            ack: true,
        });
    }
    async getModelFromApi() {
        try {
            const client = this.miio;
            if (!client) {
                return null;
            }
            const DeviceData = await client.sendMessage('miIO.info');
            return DeviceData.result ? DeviceData : null;
        }
        catch (error) {
            this.log.debug(`getModelFromApi: ${error}`);
            return null;
        }
    }
    /**
     * delete async function
     *
     * @param id id
     */
    async delObj(id) {
        try {
            await this.delObjectAsync(id);
        }
        catch (error) {
            this.log.debug(`delObj: ${error}`);
            //... do nothing
        }
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        try {
            // Reset the connection indicator during startup
            await this.setConnection(false);
            await this.ensureAuthStates();
            this.xiaomiApi = new XiaomiCloudConnector(this.log, {}, this);
            await this.main();
        }
        catch {
            this.log.error('Adapter startup failed');
            try {
                await this.setConnection(false);
            }
            catch {
                this.log.debug('Could not reset the connection indicator after the startup failure');
            }
        }
    }
    async ensureAuthStates() {
        await this.setObjectNotExistsAsync('auth', {
            type: 'channel',
            common: { name: 'Xiaomi Cloud authentication' },
            native: {},
        });
        const states /** @type {Record<string, ioBroker.StateCommon>} */ = 
        /** @type {unknown} Legacy definitions omit explicit read/write defaults. */ {
            status: { name: 'Authentication status', type: 'string', role: 'text', def: 'not_authenticated' },
            loginUrl: { name: 'Xiaomi QR login URL', type: 'string', role: 'text.url', def: '' },
            lastError: { name: 'Last authentication error', type: 'string', role: 'text', def: '' },
            expiresAt: { name: 'QR login expiry timestamp', type: 'number', role: 'value.time', def: 0 },
        };
        await Promise.all(Object.entries(states).map(([id, common]) => this.setObjectNotExistsAsync(`auth.${id}`, {
            type: 'state',
            common: { ...common, read: true, write: false },
            native: {},
        })));
        await this.setStateAsync('auth.status', 'not_authenticated', true);
    }
    async getTimersForAdmin() {
        const [objects, states, roomObjects] = await Promise.all([
            this.getAdapterObjectsAsync(),
            this.getStatesAsync('timer.*'),
            this.getForeignObjectsAsync('enum.rooms.*'),
        ]);
        const prefix = `${this.namespace}.timer.`;
        const rooms = Object.values(roomObjects || {}).map(room => ({
            id: room._id,
            name: room.common.name,
            members: room.common.members || [],
        }));
        const channels = Object.values(objects)
            .filter(object => object.type === 'channel' && object._id.startsWith(`${this.namespace}.rooms.`))
            .map(channel => ({ id: channel._id.split('.').pop(), name: channel.common.name }));
        const timers = Object.values(objects)
            .filter(object => object.type === 'state' && object._id.startsWith(prefix))
            .map(object => {
            const name = object._id.slice(prefix.length);
            const [days = '', hour = '0', minute = '0'] = name.split('_');
            return {
                id: name,
                enabled: states[object._id]?.val !== -1,
                day: days.split('').filter(day => /^[0-6]$/.test(day)),
                hour: Number(hour),
                minute: Number(minute),
                channels: object.native.channels || [],
                rooms: rooms.filter(room => room.members.includes(object._id)).map(room => room.id),
            };
        });
        return { timers, rooms: rooms.map(({ id, name }) => ({ id, name })), channels };
    }
    getProtectedConfigStatus() {
        const configuredToken = typeof this.config.token === 'string' ? this.config.token : '';
        let token = '';
        if (configuredToken) {
            try {
                token = (0, protectedConfig_1.normalizeDeviceToken)(configuredToken);
            }
            catch {
                // Keep damaged historical values stored, but never return them to the browser as a usable token.
            }
        }
        return {
            ok: true,
            tokenStored: configuredToken.length > 0,
            token,
            tokenReadable: token.length > 0,
            passwordStored: typeof this.config.password === 'string' && this.config.password.length > 0,
            cloudSessionStored: typeof this.config.cloudSession === 'string' && this.config.cloudSession.length > 0,
        };
    }
    async saveConfigFromAdmin(message) {
        const request = (0, protectedConfig_1.parseProtectedConfigSaveRequest)(message);
        const objectId = `system.adapter.${this.namespace}`;
        const object = await this.getForeignObjectAsync(objectId);
        if (!object || object.type !== 'instance') {
            throw new protectedConfig_1.ProtectedConfigError('INSTANCE_NOT_FOUND', 'Adapter instance configuration was not found');
        }
        const existingNative = object.native;
        const merged = (0, protectedConfig_1.mergeProtectedConfig)(existingNative, request, value => this.encrypt(value));
        object.native = merged.native;
        await this.setForeignObjectAsync(objectId, object);
        return { ok: true, tokenStored: merged.tokenStored };
    }
    async saveTimersFromAdmin(timers) {
        if (!Array.isArray(timers)) {
            throw new Error('Timers must be an array');
        }
        const normalized = new Map();
        for (const timer of timers) {
            const days = [...new Set((timer.day || []).map(String).filter(day => /^[0-6]$/.test(day)))].sort().join('');
            const hour = Number(timer.hour);
            const minute = Number(timer.minute);
            if (!days ||
                !Number.isInteger(hour) ||
                hour < 0 ||
                hour > 23 ||
                !Number.isInteger(minute) ||
                minute < 0 ||
                minute > 59) {
                throw new Error('Invalid timer definition');
            }
            const id = `${days}_${String(hour).padStart(2, '0')}_${String(minute).padStart(2, '0')}`;
            if (normalized.has(id)) {
                throw new Error('Two timers cannot have the same start time');
            }
            normalized.set(id, {
                enabled: !!timer.enabled,
                channels: Array.isArray(timer.channels) ? timer.channels : [],
                rooms: Array.isArray(timer.rooms) ? timer.rooms : [],
            });
        }
        const existing = await this.getAdapterObjectsAsync();
        const prefix = `${this.namespace}.timer.`;
        for (const object of Object.values(existing)) {
            if (object.type === 'state' &&
                object._id.startsWith(prefix) &&
                !normalized.has(object._id.slice(prefix.length))) {
                await this.delObjectAsync(object._id);
            }
        }
        for (const [id, timer] of normalized) {
            const stateId = `timer.${id}`;
            await this.extendObjectAsync(stateId, {
                type: 'state',
                common: {
                    name: id,
                    type: 'number',
                    role: 'value',
                    read: true,
                    write: true,
                    min: -1,
                    max: 2,
                    states: { 1: 'enabled', '-1': 'disabled', 0: 'skip', 2: 'start now' },
                },
                native: { channels: timer.channels, nextProcessTime: 0 },
            });
            await this.setStateAsync(stateId, timer.enabled ? 1 : -1, false);
        }
        const roomObjects = await this.getForeignObjectsAsync('enum.rooms.*');
        for (const room of Object.values(roomObjects || {})) {
            const members = (room.common.members || []).filter(member => !member.startsWith(prefix));
            for (const [id, timer] of normalized) {
                if (timer.rooms.includes(room._id)) {
                    members.push(`${prefix}${id}`);
                }
            }
            room.common.members = [...new Set(members)];
            await this.setForeignObjectAsync(room._id, room);
        }
        return this.getTimersForAdmin();
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback function
     */
    async onUnload(callback) {
        let callbackCalled = false;
        const finishUnload = () => {
            if (callbackCalled) {
                return;
            }
            callbackCalled = true;
            callback();
        };
        if (!this.unloadPromise) {
            this.unloadPromise = (async () => {
                try {
                    this.xiaomiApi?.shutdown();
                }
                catch (e) {
                    this.log.debug(`Cloud shutdown: ${e}`);
                }
                try {
                    if (this.vacuum) {
                        await this.vacuum.close();
                    }
                }
                catch (e) {
                    this.log.debug(`Manager shutdown: ${e}`);
                }
                try {
                    const client = this.miio;
                    if (client) {
                        await new Promise(resolve => client.close(resolve));
                    }
                }
                catch (e) {
                    this.log.debug(`UDP shutdown: ${e}`);
                }
            })();
        }
        try {
            await this.unloadPromise;
        }
        catch (e) {
            this.log.debug(`onUnload: ${e}`);
        }
        finally {
            finishUnload();
        }
    }
    /**
     * Is called if a subscribed state changes
     *
     * @param id id
     * @param state state
     */
    async onStateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        // output to parser
        const terms = id.split('.');
        const command = terms.pop();
        // Send own commands
        if (command === 'X_send_command') {
            const values = (state.val || '').toString().trim().split(';');
            let params = [''];
            if (values[1]) {
                try {
                    params = JSON.parse(values[1]);
                }
                catch (e) {
                    this.log.debug(`onStateChange: ${e}`);
                    return this.setState('control.X_get_response', `Could not send these params because its not in JSON format: ${values[1]}`, true);
                }
                this.log.info('Send custom command with parameters');
            }
            else {
                this.log.info('Send custom command without parameters');
            }
            this.setStateAsync(id, state.val, true);
            try {
                const client = this.miio;
                if (!client) {
                    throw new Error('UDP client not initialized');
                }
                const DeviceData = await client.sendMessage(values[0], params);
                this.log.debug('Custom command response received');
                this.setStateAsync('control.X_get_response', JSON.stringify(DeviceData.result), true);
            }
            catch (error) {
                this.setStateAsync('control.X_get_response', `[${error}]`, true);
            }
        }
        if (this.vacuum) {
            try {
                await this.vacuum.stateChange(id, state);
            }
            catch (error) {
                this.log.warn(`Could not process state change: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }
    }
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     *
     * @param obj message object
     */
    async onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'send') {
                // e.g. send email or pushover or whatever
                this.log.info('send command');
                // Send response in callback if required
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                }
            }
        }
        // responds to the adapter that sent the original message
        const respond = response => obj.callback && this.sendTo(obj.from, obj.command, response, obj.callback);
        // handle the message
        if (obj) {
            switch (obj.command) {
                case 'discovery': {
                    if (!this.xiaomiApi) {
                        this.xiaomiApi = new XiaomiCloudConnector(this.log, obj.message.authObj, this);
                    }
                    else {
                        this.xiaomiApi.init(obj.message.authObj);
                    }
                    const result = await this.xiaomiApi.login();
                    if (result.ok) {
                        try {
                            const devices = await this.xiaomiApi.getDevices(obj.message.server);
                            this.log.debug('Cloud device discovery completed');
                            respond(devices);
                        }
                        catch (error) {
                            respond({
                                err: error instanceof Error ? error.message : 'Could not retrieve Xiaomi devices',
                            });
                        }
                    }
                    else {
                        respond(result);
                    }
                    return;
                }
                case 'startCloudLogin': {
                    if (!this.xiaomiApi) {
                        this.xiaomiApi = new XiaomiCloudConnector(this.log, {}, this);
                    }
                    this.log.debug('Cloud auth: QR login start requested by admin');
                    respond(await this.xiaomiApi.startQrLogin());
                    return;
                }
                case 'getProtectedConfigStatus':
                    if (!/^system\.adapter\.admin\.\d+$/.test(obj.from || '')) {
                        respond({ ok: false, error: { code: 'ADMIN_ONLY', message: 'Admin access required' } });
                        return;
                    }
                    respond(this.getProtectedConfigStatus());
                    return;
                case 'saveConfig':
                    if (!/^system\.adapter\.admin\.\d+$/.test(obj.from || '')) {
                        respond({ ok: false, error: { code: 'ADMIN_ONLY', message: 'Admin access required' } });
                        return;
                    }
                    try {
                        respond(await this.saveConfigFromAdmin(obj.message));
                    }
                    catch (error) {
                        respond({
                            ok: false,
                            error: {
                                code: error instanceof protectedConfig_1.ProtectedConfigError ? error.code : 'CONFIG_SAVE_FAILED',
                                message: error instanceof protectedConfig_1.ProtectedConfigError
                                    ? error.message
                                    : 'Could not save adapter configuration',
                            },
                        });
                    }
                    return;
                case 'getTimers':
                    try {
                        respond(await this.getTimersForAdmin());
                    }
                    catch (error) {
                        respond({ err: error instanceof Error ? error.message : 'Could not load timers' });
                    }
                    return;
                case 'saveTimers':
                    try {
                        respond(await this.saveTimersFromAdmin(obj.message?.timers));
                    }
                    catch (error) {
                        respond({ err: error instanceof Error ? error.message : 'Could not save timers' });
                    }
                    return;
                // ======================================================================
                default:
                    if (!this.vacuum) {
                        return respond({
                            error: { code: 'NOT_INITIALIZED', message: 'Adapter is not initialized' },
                        });
                    }
                    try {
                        respond(await this.vacuum.onMessage(obj));
                    }
                    catch (error) {
                        respond({
                            error: {
                                code: error instanceof Error && 'code' in error && typeof error.code === 'string'
                                    ? error.code
                                    : 'COMMAND_FAILED',
                                message: error instanceof Error ? error.message : 'Command failed',
                            },
                        });
                    }
                    return;
            }
        }
    }
}
exports.MihomeVacuum = MihomeVacuum;
// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = options => new MihomeVacuum(options);
}
else {
    // otherwise start the instance directly
    new MihomeVacuum();
}
//# sourceMappingURL=main.js.map