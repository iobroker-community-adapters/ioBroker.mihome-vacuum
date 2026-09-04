/* eslint-disable no-prototype-builtins, jsdoc/check-tag-names */
'use strict';
// const utils = require('@iobroker/adapter-core');
// const {hostname} = require('os');
// const miio = null;
const objects = require('./objects');
const TimerManager = require('./timerManager.js');
const RoomManager = require('./roomManager');
const MapHelper = require('./maphelper');
const commands = require('./stockCommands');
const FeatureManager = require('./featureManager');
const cleaningHistory = require('./cleaningHistory');
const vacuumStatus = require('./vacuumStatus');
const commandPayloads = require('./vacuumCommandPayloads');
const multiMapProtocol = require('./multiMapProtocol');
const consumableProtocol = require('./consumableProtocol');
const mapStateProtocol = require('./mapStateProtocol');
const networkInfoProtocol = require('./networkInfoProtocol');
const mapPointerProtocol = require('./mapPointerProtocol');
const carpetModeProtocol = require('./carpetModeProtocol');
const roomMappingProtocol = require('./roomMappingProtocol');
const { i18n, cleanStates, activeCleanStates, defaultCarpetModeSettings } = require('./vacuumProtocol');
global.systemDictionary = require('../../admin/words.js');
// const lastProps = {};
/**
 * @typedef {object} VacuumDeviceState
 * @property {string} modell Detected vacuum model.
 * @property {{ carpetMode: boolean | null, roomMapping: boolean | null }} features Detected feature flags.
 * @property {unknown[]} lastGoto Last go-to coordinates.
 * @property {unknown[][]} lastZone Last zone-clean coordinates.
 * @property {unknown} [firmware] Detected firmware version.
 * @property {unknown[]} [rooms] Detected room mapping.
 */
class VacuumManager {
    constructor(adapterInstance, Miio) {
        this.Miio = Miio;
        this.Map = new MapHelper(null, adapterInstance);
        this.device = adapterInstance.device;
        /** @type {VacuumDeviceState} */
        this.vacuum = {
            modell: adapterInstance.device,
            features: { carpetMode: null, roomMapping: null },
            lastGoto: [],
            lastZone: [[]],
        };
        this.carpetModeSettings = { ...defaultCarpetModeSettings };
        this.adapter = adapterInstance;
        this.globalTimeouts = {};
        this.closed = false;
        this.logEntries = [];
        this.Error = false;
        // remember last Map State
        this.lastMapState = null;
        // values for Roboter StatusControl
        this.cleandState = cleanStates.Unknown; // current robot Status
        this.cleanActiveState = 0; // if robot is working, than here the status is saved
        // this.checkCleanState = null;
        this.activeChannels = null;
        this.queue = []; // if new job is called, while robot is already cleaning
        // values for Map
        // this.mapRetries = 0;
        this.mapPointer = '';
        this.mapLastSave = Date.now();
        this.mapGet = false;
        this.mapEnable = this.adapter.config.enableMiMap || this.adapter.config.valetudo_enable;
        // MAP initial
        this.cMapPoll = 900000; // 15 Min
        this.cMapLastPoll = 0;
        this.mapSaveIntervall = parseInt(this.adapter.config.valetudo_MapsaveIntervall, 10) || 5000;
        this.mapPollIntervall = parseInt(this.adapter.config.valetudo_requestIntervall, 10) || 2000;
        this.mapReady = {
            login: false,
            mappointer: false,
        };
        this.adapter.getState('info.device_fw', (err, state) => {
            if (state && state.val) {
                this.vacuum.firmware = state.val;
            }
        });
        this.startUp = {
            getMultiMapsList: this.getMultiMapsList,
            setGetCleanSummary: this.setGetCleanSummary,
            setGetConsumable: this.setGetConsumable,
        };
        this.adapter.log.info('Using standard vacuum protocol');
        this.features = new FeatureManager(this.vacuum, this.adapter);
        this.roomManager = new RoomManager(this.adapter, i18n);
        this.timerManager = new TimerManager(this.adapter, i18n);
        this.ready = this.main();
    }
    async main() {
        await this.initStates();
        await this.init();
        this.getStates();
    }
    async init() {
        //übersetzte Begriffe
        // adapter.log.debug(JSON.stringify(adapter.systemDictionary));
        // adapter.getForeignObjectAsync('system.config').then( systemConfig => {
        //     if (systemConfig && systemConfig.common && systemConfig.common.language && systemDictionary.Sunday[systemConfig.common.language]) {
        //         userLang = systemConfig.common.language;
        //         let obj;
        //         for (const i in i18n) {
        //             obj = i18n[i];
        //             if (typeof obj == 'string') {
        //                 i18n[i] = systemDictionary[obj][userLang];
        //             } else if (typeof obj == 'object') {
        //                 for (const o in obj) {
        //                     obj[o] = systemDictionary[obj[o]][userLang];
        //                 }
        //             }
        //         }
        //     }
        // });
        if (this.adapter.config.enableMiMap) {
            await this.Map.login()
                .then(result => {
                //reqParams.push('get_map_v1'); todo: is this necessary, or it is enough with mapPoll?
                this.mapReady.login = result.ok;
            })
                .catch(error => this.adapter.log.warn(error));
        }
        else if (this.adapter.config.valetudo_enable) {
            //this._MapPoll();
        }
        await Promise.all(objects.stockControl.map(async (o) => {
            const contents = await this.adapter.setObjectNotExistsAsync(`control${o._id ? `.${o._id}` : ''}`, o);
            contents && this.adapter.log.debug(`Create State for control: ${JSON.stringify(contents)}`);
        }));
        await Promise.all(objects.stockInfo.map(async (o) => {
            const contents = await this.adapter.setObjectNotExistsAsync(`info${o._id ? `.${o._id}` : ''}`, o);
            contents && this.adapter.log.debug(`Create State for stockInfo: ${JSON.stringify(contents)}`);
        }));
        await Promise.all(objects.stockHistory.map(async (o) => {
            const contents = await this.adapter.setObjectNotExistsAsync(`history${o._id ? `.${o._id}` : ''}`, o);
            contents && this.adapter.log.debug(`Create State for stockHistory: ${JSON.stringify(contents)}`);
        }));
        await Promise.all(objects.roomStates.map(async (o) => {
            await this.adapter.setObjectNotExistsAsync(`info${o._id ? `.${o._id}` : ''}`, o);
            this.adapter.log.debug(`Create State for Queue: ${o._id}`);
        }));
        // check if resume Zoneclean is enabled
        !this.adapter.config.enableResumeZone &&
            (await Promise.all(objects.enableResumeZone.map(async (o) => {
                const contents = await this.adapter.setObjectNotExistsAsync(`control${o._id ? `.${o._id}` : ''}`, o);
                contents &&
                    this.adapter.log.debug(`Create State for enableResumeZone: ${JSON.stringify(contents)}`);
            })));
        //chek if map is enabled -> therefore, that this datapoints also need for multifloor, we have to add them always
        //if (adapter.config.enableMiMap || adapter.config.valetudo_enable) {
        //adapter.log.info('create states for map');
        await Promise.all(objects.mapObjects.map(async (o) => {
            await this.adapter.setObjectNotExistsAsync(`cleanmap${o._id ? `.${o._id}` : ''}`, o);
            this.adapter.log.debug(`Create State for map: ${o._id}`);
        }));
        /*} else {
            adapter.log.info('Map not selected delete states...');
            objects.mapObjects.map(async o => await this.delObj('map' + (o._id ? '.' + o.id : '')));
        }*/
        if (this.adapter.config.enableResumeZone) {
            await Promise.all(objects.enableResumeZone.filter(o => o._id).map(o => this.delObj(`control.${o._id}`)));
        }
        this.adapter.log.debug('Create State done!');
    }
    async delObj(id) {
        try {
            await this.adapter.delObjectAsync(id);
        }
        catch (error) {
            this.adapter.log.debug(error);
        }
    }
    async getStates() {
        this.adapter.clearTimeout(this.globalTimeouts['getStates']);
        if (this.closed) {
            return;
        }
        // let DeviceData;
        this.adapter.log.debug('get params for stock Vacuum');
        try {
            // DeviceData = await this.Miio.sendMessage('get_map_v1');
            await this.setGetStatus();
            if (this.closed) {
                return;
            }
            await this.getSetNetwork();
            if (this.closed) {
                return;
            }
            await this.setGetSoundVolume();
            if (this.closed) {
                return;
            }
            // await this.setGetConsumable();
            // await this.setGetCleanSummary();
            // await this.getMultiMapsList();
            // NoError = true;
            await this.getOnlyAtStart();
            if (this.closed) {
                return;
            }
            if (Date.now() - this.cMapLastPoll > this.cMapPoll && this.mapGet) {
                await this.getMapPointer();
                if (this.closed) {
                    return;
                }
            }
            this.timerManager && this.timerManager.check();
            // Promise.all([statusObj, soundObj, consumableObj, cleaningObj]).catch(function (err) {
            // 	adapter.log.error(err);
            // });
        }
        catch (error) {
            if (!this.closed) {
                this.adapter.log.warn(`ERROR${error}`);
            }
        }
        if (this.closed) {
            return;
        }
        //carpetMode first run to create States need no Error to detect if Messages receive before
        if (!this.Error && this.vacuum.features.carpetMode === null) {
            await this.checkFeaturesCarpet();
            if (this.closed) {
                return;
            }
        }
        this.vacuum.features.carpetMode && (await this.setGetCarpetMode());
        if (this.closed) {
            return;
        }
        //Room Mapping first run to create States need no Error to detect if Messages receive before
        if (!this.Error && this.features.roomMapping === null) {
            await this.checkFeaturesRoomMapping();
            if (this.closed) {
                return;
            }
        }
        this.globalTimeouts['getStates'] = this.adapter.setTimeout(this.getStates.bind(this), this.adapter.config.pingInterval);
    }
    async getOnlyAtStart() {
        for (const __fkt in this.startUp) {
            if (this.closed) {
                return;
            }
            const isTrue = await this[__fkt]();
            if (this.closed) {
                return;
            }
            this.adapter.log.debug(`Startup: ${__fkt} Answer: ${isTrue}`);
            if (isTrue) {
                delete this.startUp[__fkt];
                this.adapter.log.debug(`Startup: Delete ${__fkt}`);
            }
        }
    }
    async getSetNetwork() {
        try {
            const answer = await this.Miio.sendMessage('get_network_info');
            const wifiSignal = networkInfoProtocol.parseWifiSignal(answer);
            if (wifiSignal !== null) {
                await this.adapter.setStateAsync('deviceInfo.wifi_signal', {
                    val: wifiSignal,
                    ack: true,
                });
            }
        }
        catch (error) {
            this.adapter.log.debug(`Error at getSetNetwork: ${error}`);
        }
    }
    async getMultiMapsList() {
        //get_multi_maps_list
        try {
            const answer = await this.Miio.sendMessage('get_multi_maps_list');
            const multiMaps = multiMapProtocol.parseMultiMapList(answer);
            if (multiMaps) {
                this.adapter.log.debug(`States for ${multiMaps.maps.length} Map: ${JSON.stringify(multiMaps.maps)}`);
                if (multiMaps.maps.length > 0) {
                    this.adapter.log.debug(`States for Map: ${JSON.stringify(multiMaps.states)}`);
                    this.adapter.extendObjectAsync('cleanmap.actualMap', {
                        common: {
                            states: multiMaps.states,
                        },
                    });
                    return true;
                }
                return true;
            }
            return true;
        }
        catch (error) {
            this.adapter.log.debug(error);
            return false;
        }
    }
    async checkFeaturesRoomMapping() {
        try {
            const answer = await this.Miio.sendMessage('get_room_mapping');
            const roomMapping = roomMappingProtocol.parseRoomMapping(answer);
            if (roomMapping !== null) {
                this.features.roomMapping = true;
                this.vacuum.rooms = [roomMapping];
                this.vacuum.features.roomMapping = true;
                this.roomManager.processRoomMaping(answer);
                // check again in 15 min
                this.globalTimeouts['getRoomMap'] = this.adapter.setTimeout(this.checkFeaturesRoomMapping.bind(this), 900000);
            }
            else {
                this.features.roomMapping = false;
                this.vacuum.features.roomMapping = false;
                if (typeof this.vacuum.rooms === 'undefined') {
                    this.vacuum.features.roomMapping = false;
                }
            }
        }
        catch (error) {
            this.features.roomMapping = false;
            this.globalTimeouts['getRoomMap'] = this.adapter.setTimeout(this.checkFeaturesRoomMapping.bind(this), 900000);
            this.adapter.log.debug(error);
        }
    }
    async getMapPointer() {
        this.adapter.clearTimeout(this.globalTimeouts['getMapData']);
        //if map is not enabled, dont do anything to prevent rate limit
        if (!this.mapEnable) {
            return;
        }
        //valetudo dont need a mappointer so go on
        if (this.adapter.config.valetudo_enable) {
            this.getMapData();
            return;
        }
        try {
            for (let index = 0; index < 5; index++) {
                const answer = await this.Miio.sendMessage('get_map_v1');
                const mapPointer = mapPointerProtocol.parseMapPointerResponse(answer);
                if (mapPointer.action === 'stop') {
                    return;
                }
                if (mapPointer.action === 'ready') {
                    this.mapPointer = mapPointer.pointer;
                    this.adapter.log.debug('Mappointer_updated');
                    this.mapReady.mappointer = true;
                    await this.getMapData();
                    return;
                }
                // robo need some time to generate mappointer if he wants a "retry"
                await this.delay(300);
            }
            // received no Mappointer, try again in ...
            if (this.mapGet) {
                this.globalTimeouts['getMapData'] = this.adapter.setTimeout(async () => {
                    this.adapter.log.debug('Get Mappointer while cleaning');
                    this.mapEnable && this.getMapPointer(); // get pointer only by mimap
                }, this.mapPollIntervall);
            }
            return;
        }
        catch (error) {
            this.adapter.log.debug(error);
            if (this.mapGet) {
                this.globalTimeouts['getMapData'] = this.adapter.setTimeout(async () => {
                    this.adapter.log.debug('Get Mappointer while cleaning');
                    this.mapEnable && this.getMapPointer(); // get pointer only by mimap
                }, this.mapPollIntervall);
            }
        }
    }
    async delay(time) {
        return new Promise(resolve => (this.globalTimeouts['delay'] = this.adapter.setTimeout(resolve, time)));
    }
    async getMapData() {
        if ((!this.mapReady.mappointer || !this.mapReady.login) && this.adapter.config.enableMiMap) {
            return;
        }
        this.Map.updateMap(this.mapPointer)
            .then(async (data) => {
            if (data) {
                // get rooms from Map only needed for S5
                const rooms = data[1];
                if ((this.vacuum.modell === 'roborock.vacuum.s5' || this.vacuum.modell === 'roborock.vacuum.s5e') &&
                    this.vacuum.features.roomMapping === false &&
                    typeof rooms !== 'undefined' &&
                    rooms.length > 0) {
                    const roomids = mapStateProtocol.createFallbackRooms(rooms);
                    this.adapter.log.info(`Room array empty... generate from mapdata.. ${JSON.stringify(roomids)}`);
                    this.vacuum.features.roomMapping = true;
                    this.vacuum.rooms = roomids;
                    this.roomManager.processRoomMaping({
                        id: 'dummy',
                        result: roomids,
                    });
                }
                // get zone cleaning coordinates
                const zones = data[2];
                if (mapStateProtocol.shouldUpdateZones(zones, this.vacuum.lastZone)) {
                    this.adapter.log.debug(`zone changed${JSON.stringify(zones)}`);
                    this.vacuum.lastZone = zones;
                    await this.adapter.setForeignStateAsync(`${this.adapter.namespace}.control.zoneClean`, {
                        val: mapStateProtocol.createZoneStateValue(zones),
                        ack: true,
                    });
                }
                // get Point  coordinates
                const goto = data[3];
                if (mapStateProtocol.shouldUpdateGoTo(goto, this.vacuum.lastGoto)) {
                    this.adapter.log.debug(`goto changed${JSON.stringify(goto)}`);
                    this.vacuum.lastGoto = goto;
                    await this.adapter.setForeignStateAsync(`${this.adapter.namespace}.control.goTo`, {
                        val: mapStateProtocol.createGoToStateValue(goto),
                        ack: true,
                    });
                }
                const dataurl = data[0].toDataURL();
                await this.adapter.setForeignStateAsync(`${this.adapter.namespace}.cleanmap.map64`, {
                    val: dataurl,
                    ack: true,
                });
                if (Date.now() - this.mapLastSave > this.mapSaveIntervall) {
                    const buf = data[0].toBuffer();
                    this.adapter.writeFile(`mihome-vacuum.${this.adapter.instance}.userfiles`, `actualMap.png`, buf, error => {
                        if (error) {
                            this.adapter.log.error('Error by saving of the map');
                        }
                        else {
                            this.adapter.setState('cleanmap.mapURL', `/mihome-vacuum.${this.adapter.instance}.userfiles/actualMap.png`, true);
                        }
                        this.mapLastSave = Date.now();
                    });
                }
                this.cMapLastPoll = Date.now();
            }
            if (this.mapGet) {
                //adapter.log.info(VALETUDO.POLLMAPINTERVALL)
                this.globalTimeouts['getMapData'] = this.adapter.setTimeout(async () => {
                    this.adapter.log.debug('Get Mappointer while cleaning');
                    this.mapEnable && this.getMapPointer(); // get pointer only by mimap
                    //this.getMapData();
                }, this.mapPollIntervall);
            }
        })
            .catch(err => {
            this.adapter.log.debug(err);
            if (this.mapGet) {
                this.globalTimeouts['getMapData'] = this.adapter.setTimeout(async () => {
                    this.mapEnable && this.getMapPointer(); // get pointer only by mimap
                    //	this.getMapData();
                }, this.mapPollIntervall);
            }
        });
    }
    async checkFeaturesCarpet() {
        try {
            const answer = await this.Miio.sendMessage('get_carpet_mode');
            if (carpetModeProtocol.isCarpetModeSupported(answer)) {
                if (this.vacuum.features.carpetMode === null) {
                    this.vacuum.features.carpetMode = true;
                    this.adapter.log.info('create state for carpet_mode');
                    this.adapter.setObjectNotExists('control.carpet_mode', objects.carpet_mode);
                }
            }
            else {
                this.vacuum.features.carpetMode = false;
            }
        }
        catch (error) {
            this.vacuum.features.carpetMode = false;
            this.adapter.log.debug(error);
        }
    }
    async setGetCarpetMode() {
        try {
            const answer = await this.Miio.sendMessage('get_carpet_mode');
            const carpetMode = carpetModeProtocol.parseCarpetMode(answer);
            if (carpetMode) {
                await this.adapter.setStateAsync('control.carpet_mode', {
                    val: carpetMode.enabled,
                    ack: true,
                });
                if (carpetMode.enabled) {
                    this.carpetModeSettings = carpetMode.settings;
                }
            }
        }
        catch (error) {
            this.adapter.log.debug(error);
        }
    }
    async setGetCleanSummary() {
        try {
            const answer = await this.Miio.sendMessage('get_clean_summary');
            if (!answer.result) {
                return false;
            }
            const summary = await this.parseCleaningSummary(answer);
            this.adapter.setStateAsync('history.total_time', {
                val: Math.round(summary.clean_time / 60),
                ack: true,
            });
            this.adapter.setStateAsync('history.total_area', {
                val: Math.round(summary.total_area / 1000000),
                ack: true,
            });
            this.adapter.setStateAsync('history.total_cleanups', {
                val: summary.num_cleanups,
                ack: true,
            });
            if (!(await this.isEquivalent(summary.cleaning_record_ids, this.logEntries))) {
                this.logEntries = summary.cleaning_record_ids;
                const cleanlogJson = await this.getLogEntries(this.logEntries);
                this.adapter.setStateAsync('history.allTableJSON', {
                    val: JSON.stringify(cleanlogJson),
                    ack: true,
                });
                this.adapter.setStateAsync('history.allTableHTML', {
                    val: await this.createHtmlTable(cleanlogJson),
                    ack: true,
                });
                return true;
            }
            return true;
        }
        catch (error) {
            this.adapter.log.debug(`ERROR at setGetCleanSummary: ${error}`);
            return false;
        }
    }
    async parseCleaningSummary(response) {
        return cleaningHistory.parseCleaningSummary(response);
    }
    async isEquivalent(a, b) {
        return cleaningHistory.isEquivalent(a, b);
    }
    async getLogEntries(logArray) {
        if (!logArray || logArray.length === 0) {
            return;
        }
        const cleanJSON = [];
        try {
            const start = async () => {
                await this.asyncForEach(logArray, async (num) => {
                    const response = await this.Miio.sendMessage('get_clean_record', [num]);
                    const records = await this.parseCleaningRecords(response);
                    records &&
                        records.forEach(record => {
                            const dates = new Date();
                            dates.setTime(record.start_time * 1000);
                            cleanJSON.push({
                                Datum: `${dates.getDate()}.${dates.getMonth() + 1}`,
                                Start: `${(dates.getHours() < 10 ? '0' : '') + dates.getHours()}:${dates.getMinutes() < 10 ? '0' : ''}${dates.getMinutes()}`,
                                Saugzeit: `${Math.round(record.duration / 60)} min`,
                                Fläche: `${Math.round(record.area / 10000) / 100} m²`,
                                Error: record.errors,
                                Ende: record.completed,
                            });
                        });
                });
                if (!this.closed) {
                    this.adapter.log.debug(`Cleaning history processed: ${cleanJSON.length} entries`);
                }
            };
            await start();
            return cleanJSON;
        }
        catch (error) {
            if (!this.closed) {
                this.adapter.log.warn(`Error at history: ${error}`);
            }
        }
    }
    async parseCleaningRecords(response) {
        return cleaningHistory.parseCleaningRecords(response);
    }
    async createHtmlTable(cleanJSON) {
        return cleaningHistory.createHtmlTable(cleanJSON);
    }
    async asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }
    async setGetSoundVolume() {
        try {
            const message = await this.Miio.sendMessage('get_sound_volume');
            this.Error = !message.result;
            if (!message.result) {
                return;
            }
            this.adapter.setStateAsync('control.sound_volume', {
                val: message.result[0],
                ack: true,
            });
        }
        catch (error) {
            this.adapter.log.debug(`ERROR at setGetSoundVolume: ${error}`);
            this.Error = true;
        }
    }
    async setGetConsumable() {
        try {
            const message = await this.Miio.sendMessage('get_consumable');
            if (!message.result) {
                return false;
            }
            const consumable = message.result[0]; //parseConsumable(answer)
            this.Error = false;
            if (!this.features.consumables) {
                this.features.consumables = [];
                await this.adapter.setObjectNotExistsAsync('consumable', objects.stockConsumable.channel);
                const detectedConsumables = consumableProtocol.detectConsumables(consumable, objects.stockConsumable.list, commands);
                for (const detected of detectedConsumables) {
                    let contents = await this.adapter.setObjectNotExistsAsync(`consumable.${detected.state._id}`, detected.state);
                    contents && this.adapter.log.debug(`Create State for consumable: ${JSON.stringify(contents)}`);
                    contents = await this.adapter.setObjectNotExistsAsync(`consumable.${detected.button._id}`, detected.button);
                    contents && this.adapter.log.debug(`Create Button for consumable: ${JSON.stringify(contents)}`);
                    this.features.consumables[detected.id] = { name: detected.name, calc: detected.calc };
                }
            }
            for (let id in this.features.consumables) {
                this.adapter.setStateAsync(`consumable.${id}`, {
                    val: consumableProtocol.calculateConsumableValue(consumable, this.features.consumables[id]),
                    ack: true,
                });
            }
            return true;
        }
        catch (error) {
            this.adapter.log.debug(`ERROR at setGetConsumable: ${error}`);
            this.Error = true;
            return false;
        }
    }
    async setGetStatus() {
        try {
            const answer = await this.Miio.sendMessage('get_status');
            this.Error = !answer.result;
            if (!answer.result) {
                return;
            }
            const status = await this.parseStatus(answer);
            this.adapter.log.debug(`Status update: state=${status.state}, battery=${status.battery}, error=${status.error_code}, cleaning=${status.in_cleaning}, fan=${status.fan_power}, map=${status.map_status}`);
            await this.features.setMop(status.mop_forbidden_enable);
            await this.features.setNewSuctionValues(Math.round(status.fan_power));
            await this.features.setWaterBox(status.water_box_status);
            await this.features.setWaterBoxMode(status.water_box_mode, status.distance_off);
            await this.features.setMopMode(status.mop_mode);
            await this.features.setDockStatus(status.dock_error_status);
            await this.features.setDustCollect(status.dust_collection_status);
            await this.features.setWashMop(status.wash_ready);
            this.adapter.setStateAsync('info.battery', {
                val: status.battery,
                ack: true,
            });
            this.adapter.setStateAsync('info.state', {
                val: status.state,
                ack: true,
            });
            this.adapter.setStateAsync('info.cleanedtime', {
                val: Math.round(status.clean_time / 60),
                ack: true,
            });
            this.adapter.setStateAsync('info.cleanedarea', {
                val: Math.round(status.clean_area / 10000) / 100,
                ack: true,
            });
            this.adapter.setStateAsync('control.fan_power', {
                val: Math.round(status.fan_power),
                ack: true,
            });
            this.adapter.setStateAsync('info.error', {
                val: status.error_code,
                ack: true,
            });
            this.adapter.setStateAsync('info.dnd', {
                val: status.dnd_enabled,
                ack: true,
            });
            // map data
            if (status.map_status !== this.lastMapState) {
                //map has changed Set new States and run getmap and rooms
                this.lastMapState = status.map_status;
                await this.adapter.setStateAsync('cleanmap.actualMap', {
                    val: !status.isLocating ? status.map_status >> 2 : -1,
                    ack: true,
                });
                await this.adapter.setStateAsync('cleanmap.mapStatus', {
                    val: status.map_status % 4,
                    ack: true,
                });
                await this.getMapPointer();
                await this.checkFeaturesRoomMapping();
            }
            // features
            this.features.water_box &&
                this.adapter.setStateAsync('info.water_box', {
                    val: status.water_box_status === 1,
                    ack: true,
                });
            this.features.water_box_mode &&
                this.adapter.setStateAsync('control.water_box_mode', {
                    val: Math.round(status.water_box_mode),
                    ack: true,
                });
            this.features.water_box_mode == 2 &&
                status.distance_off > 0 &&
                this.adapter.setStateAsync('control.water_box_level', {
                    val: Math.round((210 - status.distance_off) / 5),
                    ack: true,
                });
            this.features.dock_status &&
                this.adapter.setStateAsync('info.dock_status', {
                    val: Math.round(status.dock_error_status),
                    ack: true,
                });
            this.features.mop_mode &&
                this.adapter.setStateAsync('control.mop_mode', {
                    val: Math.round(status.mop_mode),
                    ack: true,
                });
            if (this.cleandState !== status.state) {
                this.setRemoteState(status.state);
            }
        }
        catch (error) {
            this.adapter.log.debug(`ERROR at setGetStatus: ${error}`);
            this.Error = true;
        }
    }
    async parseStatus(response) {
        return vacuumStatus.parseStatus(response);
    }
    /** Parses the answer of get_room_mapping */
    async initStates() { }
    // function to control goto params
    async parseGoTo(params) {
        const result = commandPayloads.parseGoToCoordinates(params);
        if (result.coordinates) {
            await this.Miio.sendMessage('app_goto_target', result.coordinates);
            this.adapter.log.debug('Go-to coordinates validated');
        }
        else if (result.error === 'argument_count') {
            this.adapter.log.error('GoTo only work with two arguments seperated by ', '');
        }
        else {
            this.adapter.log.error('GoTo need two koordinates with type number');
            this.adapter.log.debug('Go-to coordinates validated');
        }
    }
    async stateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        const terms = id.split('.');
        const command = terms.pop();
        const parent = terms.pop();
        this.adapter.log.debug(`command: ${command} parent: ${parent}`);
        // let data;
        // let actionMode, method, params;
        try {
            switch (command) {
                case 'clean_home':
                case 'start':
                    if (state.val) {
                        if (await this.startCleaning(cleanStates.Cleaning, {})) {
                            await this.Miio.sendMessage('app_start');
                        }
                    }
                    else if (command === 'clean_home' && this.cleanActiveState) {
                        this.stopCleaning();
                    }
                    this.adapter.setForeignState(id, !!state.val, true);
                    break;
                case 'pauseResume':
                    if (this.cleanActiveState && activeCleanStates[this.cleanActiveState].resume) {
                        if (state.val == true) {
                            this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                                this.setGetStatus();
                            }, 1000);
                            if (this.cleandState === cleanStates.Pause) {
                                await this.Miio.sendMessage(activeCleanStates[this.cleanActiveState].resume);
                            }
                            else {
                                await this.Miio.sendMessage('app_pause');
                            }
                            this.adapter.setState(id, false, true);
                        }
                    }
                    else {
                        this.adapter.log.error(`Could not pause or Resume, because no cleaning active`);
                    }
                    break;
                case 'dustCollect':
                    if (this.cleandState == cleanStates.DustCollecting) {
                        await this.Miio.sendMessage(commands.stopDustCollect.method);
                    }
                    else if (this.cleandState == cleanStates.Charging) {
                        await this.Miio.sendMessage(commands.startDustCollect.method);
                    }
                    else {
                        this.adapter.log.error(`Cant start dust collection only if charging`);
                    }
                    this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                        this.setGetStatus();
                    }, 2000);
                    this.adapter.setState(id, false, true);
                    break;
                case 'washMop':
                    if (this.cleandState == cleanStates.CleaningMop) {
                        await this.Miio.sendMessage(commands.stopWashMop.method);
                    }
                    else if (this.cleandState == cleanStates.Charging) {
                        await this.Miio.sendMessage(commands.startWashMop.method);
                    }
                    else {
                        this.adapter.log.error(`Cant start Mop washing only if charging`);
                    }
                    this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                        this.setGetStatus();
                    }, 2000);
                    this.adapter.setState(id, false, true);
                    break;
                case 'home':
                    if (!state.val) {
                        return;
                    }
                    await this.stopCleaning();
                    this.adapter.setForeignState(id, true, true);
                    break;
                case 'loadMap':
                    if (!state.val) {
                        return;
                    }
                    await this.getMapPointer();
                    this.adapter.setForeignState(id, true, true);
                    break;
                case 'clearQueue':
                    if (!state.val) {
                        return;
                    }
                    await this.clearQueue();
                    this.adapter.setForeignState(id, true, true);
                    break;
                case 'spotclean':
                    if (!state.val) {
                        return;
                    }
                    if (await this.startCleaning(cleanStates.SpotCleaning, {})) {
                        await this.Miio.sendMessage('app_spot');
                    }
                    this.adapter.setForeignState(id, state.val, true);
                    break;
                case 'carpet_mode':
                    //when carpetmode change
                    if (state.val === true || state.val === 'true') {
                        await this.Miio.sendMessage('set_carpet_mode', [this.carpetModeSettings]);
                        this.adapter.setForeignState(id, state.val, true);
                    }
                    else {
                        await this.Miio.sendMessage('set_carpet_mode', [
                            {
                                enable: 0,
                            },
                        ]);
                        this.adapter.setForeignState(id, false, true);
                    }
                    break;
                case 'water_box_level':
                    await this.Miio.sendMessage('set_water_box_distance_off', {
                        distance_off: 210 - state.val * 5,
                    });
                    this.adapter.setForeignState(id, state.val, true);
                    break;
                case 'water_box_mode':
                    await this.Miio.sendMessage('set_water_box_custom_mode', [state.val]);
                    this.adapter.setForeignState(id, state.val, true);
                    break;
                case 'goTo':
                    await this.parseGoTo(state.val);
                    this.adapter.setForeignState(id, state.val, true);
                    break;
                case 'zoneClean':
                    this.adapter.sendTo(this.adapter.namespace, 'cleanZone', state.val);
                    this.adapter.setForeignState(id, '', true);
                    break;
                case 'addRoom':
                    if (!isNaN(state.val)) {
                        await this.roomManager.createRoom(`manual_${state.val}`, parseInt(state.val, 10));
                    }
                    else {
                        const terms = state.val.match(/((?:[0-9]+,){3,3}[0-9]+)(,[0-9]+)?/);
                        if (terms) {
                            await this.roomManager.createRoom(`manual_${terms[1].replace(/,/g, '_')}`, `[${terms[1]}${terms[2] || ',1'}]`);
                        }
                        else {
                            this.adapter.log.warn('invalid input for addRoom, use index of map or coordinates like 1111,2222,3333,4444');
                        }
                    }
                    this.adapter.setForeignState(id, '', true);
                    break;
                case 'roomClean':
                    if (!state.val) {
                        return;
                    }
                    this.roomManager.cleanRooms([id.replace('roomClean', 'mapIndex')]);
                    this.adapter.setForeignState(id, true, true);
                    break;
                case 'loadRooms':
                    this.checkFeaturesRoomMapping();
                    this.adapter.setForeignState(id, true, true);
                    break;
                case 'roomFanPower':
                case 'roomWaterBoxMode':
                case 'roomWaterBoxLevel':
                case 'roomMopMode':
                case 'repeat':
                    // do nothing, only confirm value for next roomClean
                    this.adapter.setForeignState(id, state.val, true);
                    break;
                case 'actualMap':
                    await this.Miio.sendMessage('load_multi_map', [state.val]);
                    this.adapter.setForeignState(id, state.val, true);
                    this.getStates();
                    break;
                default:
                    // try to find common command
                    if (commands[command]) {
                        let params = commands[command].params || '';
                        if (state.val !== true && state.val !== 'true') {
                            params = state.val;
                        }
                        if (state.val !== false && state.val !== 'false') {
                            await this.Miio.sendMessage(commands[command].method, [params]);
                            this.adapter.setForeignState(id, state.val, true);
                            // if consumables reset get data again
                            if (commands[command].method === 'reset_consumable') {
                                this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                                    this.setGetConsumable();
                                }, 500);
                            }
                        }
                    }
                    else if (command === 'multiRoomClean' || parent === 'timer') {
                        if (parent === 'timer') {
                            this.adapter.setForeignState(id, state.val == TimerManager.SKIP || state.val == TimerManager.DISABLED
                                ? state.val
                                : TimerManager.ENABLED, true, () => this.timerManager.calcNextProcess());
                            if (state.val != TimerManager.START) {
                                return;
                            }
                        }
                        else {
                            if (!state.val) {
                                return;
                            }
                            this.adapter.setForeignState(id, true, true);
                        }
                        this.roomManager.cleanRoomsFromState(id);
                    }
                    else {
                        this.adapter.log.warn(`can not set ${command}`);
                    }
                    break;
            }
        }
        catch (error) {
            this.adapter.log.warn(`Cant send command please try again "${command}"\n${error}`);
        }
    }
    async onMessage(obj) {
        this.adapter.log.debug(`Received adapter message command: ${obj && obj.command ? obj.command : 'unknown'}`);
        //return {test: 'true'}
        this.adapter.clearTimeout(this.globalTimeouts['onMessage']);
        const requireParams = (params) => {
            if (!(params && params.length)) {
                return true;
            }
            if (!obj.message) {
                this.adapter.log.warn('command needs parameter');
                return false;
            }
            const paramArray = [];
            if (typeof params == 'string') {
                // only one parameter needed, than it could be the message self
                if (!obj.message.hasOwnProperty(params)) {
                    // it is not a member of message
                    if (typeof obj.message != 'string') {
                        this.adapter.log.warn(`command needs parameter "${params}" or a string`);
                        return false;
                    }
                    const messageObj = {};
                    messageObj[params] = obj.message;
                    obj.message = messageObj; // transform message to object with messagecontent to params
                }
                paramArray.push(obj.message[params]);
            }
            else {
                for (let i = 0; i < params.length; i++) {
                    const param = params[i];
                    if (!obj.message.hasOwnProperty(param)) {
                        //respond(predefinedResponses.MISSING_PARAMETER(param));
                        this.adapter.log.warn(`command needs parameter "${param}"`);
                        return false;
                    }
                    paramArray.push(obj.message[param]);
                }
            }
            return paramArray;
        };
        if (obj) {
            let params;
            switch (obj.command) {
                case 'sendCustomCommand':
                    // require the method to be given
                    if (!requireParams(['method'])) {
                        return;
                    }
                    // params is optional
                    params = obj.message;
                    return await this.Miio.sendMessage(params.method, params.params);
                // ======================================================================
                // support for the commands mentioned here:
                // https://github.com/MeisterTR/XiaomiRobotVacuumProtocol#vaccum-commands
                // cleaning commands
                case 'startVacuuming': {
                    const answer = await this.Miio.sendMessage('app_start');
                    this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                        void this.setGetStatus().catch(() => {
                            this.Error = true;
                            this.adapter.log.debug('Delayed status update failed');
                        });
                    }, 2000);
                    return answer;
                }
                case 'stopVacuuming':
                    return await this.Miio.sendMessage('app_stop');
                case 'clearQueue':
                    return this.clearQueue();
                case 'cleanSpot':
                    if (await this.startCleaning(cleanStates.SpotCleaning, {})) {
                        return await this.Miio.sendMessage('app_spot');
                    }
                    return;
                case 'cleanZone':
                    if (!obj.message) {
                        return this.adapter.log.warn('cleanZone needs parameter coordinates');
                    }
                    if (!obj.zones) {
                        // this data called first time!
                        const message = obj.message;
                        if (message.zones) {
                            // called from roomManager with correct Array
                            obj.zones = message.zones;
                            obj.channels = message.channels;
                            obj.message = obj.zones.join(); // we use String for message
                        }
                        else {
                            if (message.hasOwnProperty('coordinates')) {
                                if (message.hasOwnProperty('waterBoxMode')) {
                                    obj.waterBoxMode = message.waterBoxMode;
                                }
                                if (message.hasOwnProperty('waterBoxLevel')) {
                                    obj.waterBoxLevel = message.waterBoxLevel;
                                }
                                if (message.hasOwnProperty('mopMode')) {
                                    obj.mopMode = message.mopMode;
                                }
                                if (message.hasOwnProperty('fanSpeed')) {
                                    obj.fanSpeed = message.fanSpeed;
                                }
                                obj.zones = [message.coordinates];
                            }
                            else {
                                obj.zones = [obj.message];
                            }
                        }
                    }
                    if (typeof obj.channels == 'undefined') {
                        return this.roomManager.findChannelsByMapIndex(obj.zones, channels => {
                            this.adapter.log.debug(`search channels for ${obj.message} ->${channels.join()}`);
                            obj.channels = channels && channels.length ? channels : null;
                            this.adapter.emit('message', obj); // call function again
                        });
                    }
                    if (await this.startCleaning(cleanStates.ZoneCleaning, obj)) {
                        if (obj.repeat) {
                            // would be set, if we only have one zone
                            obj.zones[0] = obj.zones[0].replace(/,[0-9]+\]/, `,${obj.repeat}]`);
                        }
                        return await this.Miio.sendMessage('app_zoned_clean', obj.zones);
                    }
                    return;
                case 'cleanSegments':
                    if (!obj.message) {
                        return this.adapter.log.warn('cleanSegments needs paramter mapIndex');
                    }
                    if (!obj.segments) {
                        // this data called first time!
                        let message = obj.message;
                        if (message.segments) {
                            // called from roomManager with correct Array
                            obj.segments = message.segments;
                            obj.channels = message.channels;
                            obj.message = obj.segments.join(); // we use String for message
                        }
                        else {
                            // build correct Array
                            if (typeof message == 'object' && message.hasOwnProperty('rooms')) {
                                if (message.hasOwnProperty('waterBoxMode')) {
                                    obj.waterBoxMode = message.waterBoxMode;
                                }
                                if (message.hasOwnProperty('waterBoxLevel')) {
                                    obj.waterBoxLevel = message.waterBoxLevel;
                                }
                                if (message.hasOwnProperty('mopMode')) {
                                    obj.mopMode = message.mopMode;
                                }
                                if (message.hasOwnProperty('fanSpeed')) {
                                    obj.fanSpeed = message.fanSpeed;
                                }
                                if (message.hasOwnProperty('repeat')) {
                                    obj.repeat = message.repeat;
                                }
                                message = message.rooms;
                            }
                            if (!isNaN(message)) {
                                // only one number
                                message = [parseInt(message, 10)];
                            }
                            else {
                                if (typeof message == 'string') {
                                    // we expect String with comma seperate Numbers, like "11,12,13"
                                    message = obj.message.split(',');
                                }
                                for (const i in message) {
                                    message[i] = parseInt(message[i], 10);
                                    if (isNaN(message[i])) {
                                        delete message[i];
                                    }
                                }
                            }
                            obj.segments = message;
                        }
                    }
                    if (typeof obj.channels === 'undefined') {
                        return this.roomManager.findChannelsByMapIndex(obj.segments, channels => {
                            this.adapter.log.debug(`search channels for ${obj.message} ->${channels.join()}`);
                            obj.channels = channels && channels.length ? channels : null;
                            this.adapter.emit('message', obj); // call function again
                        });
                    }
                    if (await this.startCleaning(cleanStates.RoomCleaning, obj)) {
                        params = obj.segments;
                        let repeat = obj.repeat;
                        if (repeat) {
                            obj.repeat = false; // only process once
                            if (Number(repeat) < 2) {
                                repeat = null; // no repeat neccessary
                            }
                            else if (!this.adapter.isUnsupportedFeature('segemntCleanRepeat')) {
                                params = [
                                    {
                                        segments: obj.segments,
                                        repeat: repeat,
                                    },
                                ];
                                // clean_order_mode': 0,
                                // clean_mop: 0
                                repeat = null; // handled by complex Param
                            }
                        }
                        let answer = await this.Miio.sendMessage('app_segment_clean', params);
                        if (answer.error) {
                            // {"error":{"code":-10000,"message":"data for segment is not a number"}}
                            if (params[0] && params[0].repeat) {
                                // some devices don't support complex Object for app_segment_clean, so we have to use fallback mode
                                repeat = params[0].repeat;
                                answer = await this.Miio.sendMessage('app_segment_clean', params[0].segments);
                                // Remember only in-memory for this adapter run. Persisting permanently caused
                                // native multi-pass to stay disabled after a single transient error.
                                if (typeof this.adapter.unsupportedFeatures === 'string' &&
                                    this.adapter.unsupportedFeatures.indexOf('|segemntCleanRepeat|') === -1) {
                                    this.adapter.unsupportedFeatures += 'segemntCleanRepeat|';
                                }
                                this.adapter.log.info('native segment repeat not accepted by device, using queue fallback for this run');
                            }
                        }
                        if (repeat) {
                            // Fallback mode: each additional pass is a new clean job → room params must be re-applied
                            obj.info = 'repeat segment';
                            for (let i = 1; i < repeat; i++) {
                                this.push(JSON.parse(JSON.stringify(obj)));
                            }
                        }
                        return answer;
                    }
                    return;
                case 'cleanRooms':
                    if (!requireParams('rooms')) {
                        return;
                    }
                    this.roomManager.findMapIndexByRoom(obj.message.rooms, this.roomManager.cleanRooms);
                    return;
                case 'pause':
                    this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                        this.setGetStatus();
                    }, 2000);
                    return this.Miio.sendMessage('app_pause');
                case 'charge':
                    this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                        this.setGetStatus();
                    }, 2000);
                    return this.Miio.sendMessage('app_charge');
                case 'findMe':
                    return await this.Miio.sendMessage('find_me');
                case 'getConsumableStatus':
                    return await this.Miio.sendMessage('get_consumable');
                case 'resetConsumables':
                    if (!requireParams('consumable')) {
                        return;
                    }
                    this.globalTimeouts['onMessage'] = this.adapter.setTimeout(() => {
                        this.setGetStatus();
                    }, 2000);
                    return await this.Miio.sendMessage('reset_consumable', obj.message.consumable);
                // get info about cleanups
                case 'getCleaningSummary':
                    return await this.Miio.sendMessage('reset_consumable', obj.message.consumable);
                case 'getCleaningRecord':
                    // require the record id to be given
                    if (!requireParams('recordId')) {
                        return;
                    }
                    // TODO: can we do multiple at once?
                    return await this.Miio.sendMessage('get_clean_record', [obj.message.recordId]);
                // TODO: find out how this works
                // case 'getCleaningRecordMap':
                //     sendCustomCommand('get_clean_record_map');
                case 'getMap':
                    return await this.Miio.sendMessage('get_map_v1');
                // Basic information
                case 'getStatus':
                    return await this.Miio.sendMessage('get_status');
                case 'getSerialNumber':
                    return await this.Miio.sendMessage('get_serial_number');
                case 'getDeviceDetails':
                    return await this.Miio.sendMessage('miIO.info');
                // Do not disturb
                case 'getDNDTimer':
                    return await this.Miio.sendMessage('get_dnd_timer');
                case 'setDNDTimer':
                    // require start and end time to be given
                    params = requireParams(['startHour', 'startMinute', 'endHour', 'endMinute']);
                    if (!params) {
                        return;
                    }
                    return await this.Miio.sendMessage('set_dnd_timer', params);
                case 'deleteDNDTimer':
                    return await this.Miio.sendMessage('close_dnd_timer');
                // Fan speed
                case 'getFanSpeed':
                    return await this.Miio.sendMessage('get_custom_mode');
                //break;
                case 'setFanSpeed':
                    if (!requireParams('fanSpeed')) {
                        return;
                    }
                    //sendCustomCommand('set_custom_mode', [obj.message.fanSpeed]);
                    return await this.Miio.sendMessage('set_custom_mode', [obj.message.fanSpeed]);
                //Water Flow Mode
                case 'getWaterBoxMode':
                    return await this.Miio.sendMessage('get_water_box_custom_mode');
                case 'setWaterBoxMode':
                    //require start and end time to be given
                    if (!requireParams('waterBoxMode')) {
                        return;
                    }
                    if (obj.message.waterBoxMode == 207) {
                        if (requireParams('waterBoxLevel')) {
                            await this.Miio.sendMessage('set_water_box_distance_off', {
                                distance_off: obj.message.waterBoxLevel,
                            });
                        }
                        return this.Miio.sendMessage('set_water_box_custom_mode', [207]);
                    }
                    return await this.Miio.sendMessage('set_water_box_custom_mode', [obj.message.waterBoxMode]);
                //Mop Mode
                case 'getMopMode':
                    return await this.Miio.sendMessage('get_mop_mode');
                case 'setMopMode':
                    if (!requireParams('mopMode')) {
                        return;
                    }
                    return await this.Miio.sendMessage('set_mop_mode', [obj.message.mopMode]);
                // Remote controls
                case 'startRemoteControl':
                    return await this.Miio.sendMessage('app_rc_start');
                case 'get_prop':
                    return await this.Miio.sendMessage('get_prop', obj.message);
                case 'stopRemoteControl':
                    return await this.Miio.sendMessage('app_rc_end');
                case 'move': {
                    // require all params to be given
                    if (!requireParams(['velocity', 'angularVelocity', 'duration', 'sequenceNumber'])) {
                        return;
                    }
                    return await this.Miio.sendMessage('app_rc_move', commandPayloads.createRemoteMovePayload(obj.message));
                }
                // ======================================================================
                default:
                    if (commands[obj.command]) {
                        params = commands[obj.command].params || '';
                        if (params) {
                            params = requireParams(params);
                            if (!params) {
                                return;
                            }
                        }
                        return await this.Miio.sendMessage(commands[obj.command].method, params);
                    }
                    this.adapter.log.error(`command "${obj.command}" unkown!`);
                    return;
            }
        }
    }
    //_________________________________
    // vacuum State control
    //__________________________________
    /**
     * is called, if robot send status
     *
     * @param newVal new status
     */
    async setRemoteState(newVal) {
        this.cleandState = newVal;
        //adapter.setState('control.pauseResume', this.cleandState === cleanStates.Pause, true);
        if (activeCleanStates[this.cleandState]) {
            if (newVal === this.cleanActiveState) {
                // cleanActiveState was set in startCleaning and now confirmed
                if (this.activeChannels) {
                    for (const i in this.activeChannels) {
                        this.adapter.setState(`${this.activeChannels[i]}.state`, i18n.cleanRoom, true);
                    }
                }
            }
            else {
                this.cleanActiveState = this.cleandState;
            }
        }
        else if (cleanStates.Pause === this.cleandState) {
            // cleanActiveState should be the initial State, so do nothing
            return;
        }
        else {
            this.cleanActiveState = 0;
            if (this.activeChannels) {
                for (const i in this.activeChannels) {
                    this.adapter.setState(`${this.activeChannels[i]}.state`, '', true);
                }
                this.activeChannels = null;
            }
            if ([
                cleanStates.Sleeping,
                cleanStates.Waiting,
                cleanStates.Back_toHome,
                cleanStates.Charging,
                cleanStates.GoingToSpot,
            ].includes(this.cleandState)) {
                if (this.queue.length > 0) {
                    this.adapter.log.debug('use clean trigger from Queue');
                    this.adapter.emit('message', this.queue.shift());
                    this.updateQueue();
                }
            }
            if (cleanStates.Charging === newVal) {
                // update values
                await this.setGetConsumable();
                await this.setGetCleanSummary();
            }
        }
        // if (this.checkCleanState)
        // 	this.checkCleanState = !!clearTimeout(this.checkCleanState);
        /*if (adapter.config.enableAlexa) */
        this.adapter.setState('control.clean_home', !!this.cleanActiveState, true);
        if (this.mapEnable) {
            // set map getter to true if..
            if ([
                cleanStates.Cleaning,
                cleanStates.Back_toHome,
                cleanStates.SpotCleaning,
                cleanStates.GoingToSpot,
                cleanStates.ZoneCleaning,
                cleanStates.RoomCleaning,
            ].indexOf(this.cleandState) > -1) {
                this.mapGet = true;
                this.getMapPointer();
            }
            else {
                this.mapGet = false;
            }
        }
    }
    async startCleaning(cleanStatus, messageObj) {
        this.adapter.log.debug(`Preparing cleaning action: status=${cleanStatus}`);
        const activeCleanState = activeCleanStates[cleanStatus];
        if (!activeCleanState) {
            this.adapter.log.warn(`Invalid cleanStatus(${cleanStatus}) for startCleaning`);
            return false;
        }
        if (this.cleanActiveState) {
            if (cleanStatus === cleanStates.Cleaning && this.adapter.config.enableResumeZone) {
                this.adapter.log.debug(`Resuming paused ${activeCleanStates[this.cleanActiveState].name}`);
                await this.Miio.sendMessage(activeCleanStates[this.cleanActiveState].resume);
            }
            else {
                this.adapter.log.info(`should trigger cleaning ${activeCleanState.name}${messageObj.message || ''}, but is currently active(${this.cleanActiveState}). Add to queue`);
                messageObj.info = activeCleanState.name;
                this.push(messageObj);
            }
            return false;
        }
        this.cleanActiveState = cleanStatus;
        this.activeChannels = messageObj.channels;
        // For queued/multi-room jobs: always re-read and apply room settings before clean starts.
        // Previously this used fire-and-forget setStateChanged, so the clean command often won the race
        // and later passes kept the robot default (e.g. fan MAXIMUM) instead of roomFanPower.
        if (this.activeChannels && this.activeChannels.length >= 1) {
            // One miIO clean job can only use one fan/mop setting; use the first room as source.
            const roomChannel = this.activeChannels[0];
            if (messageObj.fanSpeed === undefined || messageObj.fanSpeed === null) {
                const fanPower = await this.adapter.getStateAsync(`${roomChannel}.roomFanPower`);
                if (fanPower && fanPower.val !== null && fanPower.val !== undefined) {
                    messageObj.fanSpeed = fanPower.val;
                }
            }
            if (this.features.water_box_mode != null && !messageObj.waterBoxMode) {
                const waterBoxMode = await this.adapter.getStateAsync(`${roomChannel}.roomWaterBoxMode`);
                if (waterBoxMode && waterBoxMode.val !== null && waterBoxMode.val !== undefined) {
                    messageObj.waterBoxMode = waterBoxMode.val;
                }
            }
            if (this.features.water_box_mode == 2 &&
                !messageObj.waterBoxLevel &&
                Number(messageObj.waterBoxMode) === 207) {
                const waterBoxLevel = await this.adapter.getStateAsync(`${roomChannel}.roomWaterBoxLevel`);
                if (waterBoxLevel && waterBoxLevel.val !== null && waterBoxLevel.val !== undefined) {
                    messageObj.waterBoxLevel = waterBoxLevel.val;
                }
            }
            if (this.features.mop_mode != null && !messageObj.mopMode) {
                const mopMode = await this.adapter.getStateAsync(`${roomChannel}.roomMopMode`);
                if (mopMode && mopMode.val !== null && mopMode.val !== undefined) {
                    messageObj.mopMode = mopMode.val;
                }
            }
            if (this.activeChannels.length === 1 && typeof messageObj.repeat === 'undefined') {
                const repeatObj = await this.adapter.getStateAsync(`${roomChannel}.repeat`);
                if (repeatObj && Number(repeatObj.val) > 1) {
                    messageObj.repeat = repeatObj.val;
                }
            }
        }
        await this.applyCleaningParams(messageObj);
        this.adapter.log.info(`trigger cleaning ${activeCleanState.name}${messageObj.message || ''}`);
        /// need to verify?? this.checkStartCleaning(2);
        return true;
    }
    /**
     * Apply fan/water/mop params to the robot before starting a clean.
     * Sends miIO commands directly so equal ioBroker values still reach the device
     * (important after dock/home between queued rooms/repeats).
     *
     * @param messageObj cleaning request object
     */
    async applyCleaningParams(messageObj) {
        if (messageObj.fanSpeed !== undefined && messageObj.fanSpeed !== null && messageObj.fanSpeed !== '') {
            this.adapter.log.debug(`Apply fan_power ${messageObj.fanSpeed} before cleaning`);
            await this.Miio.sendMessage('set_custom_mode', [messageObj.fanSpeed]);
            await this.adapter.setStateAsync('control.fan_power', messageObj.fanSpeed, true);
        }
        if (this.features.water_box_mode != null) {
            if (messageObj.waterBoxMode !== undefined &&
                messageObj.waterBoxMode !== null &&
                messageObj.waterBoxMode !== '') {
                this.adapter.log.debug(`Apply water_box_mode ${messageObj.waterBoxMode} before cleaning`);
                await this.Miio.sendMessage('set_water_box_custom_mode', [messageObj.waterBoxMode]);
                await this.adapter.setStateAsync('control.water_box_mode', messageObj.waterBoxMode, true);
            }
            if (messageObj.waterBoxLevel !== undefined &&
                messageObj.waterBoxLevel !== null &&
                messageObj.waterBoxLevel !== '' &&
                this.features.water_box_mode == 2) {
                this.adapter.log.debug(`Apply water_box_level ${messageObj.waterBoxLevel} before cleaning`);
                await this.Miio.sendMessage('set_water_box_distance_off', {
                    distance_off: 210 - messageObj.waterBoxLevel * 5,
                });
                await this.adapter.setStateAsync('control.water_box_level', messageObj.waterBoxLevel, true);
            }
        }
        if (messageObj.mopMode !== undefined &&
            messageObj.mopMode !== null &&
            messageObj.mopMode !== '' &&
            this.features.mop_mode != null) {
            this.adapter.log.debug(`Apply mop_mode ${messageObj.mopMode} before cleaning`);
            await this.Miio.sendMessage('set_mop_mode', [messageObj.mopMode]);
            await this.adapter.setStateAsync('control.mop_mode', messageObj.mopMode, true);
        }
    }
    async stopCleaning() {
        try {
            if (this.adapter.config.sendPauseBeforeHome) {
                await this.Miio.sendMessage('app_pause');
            }
            this.clearQueue();
            this.cleandState = cleanStates.Unknown; // Force calling setRemoteState on next get_status answer
            await this.Miio.sendMessage('app_charge');
            this.setGetStatus();
        }
        catch (error) {
            this.adapter.log.warn(`Error at stop Cleaning: ${error}`);
        }
    }
    clearQueue() {
        for (const i in this.queue) {
            const channels = this.queue[i].channels;
            if (channels) {
                for (const c in channels) {
                    this.adapter.setState(`${channels[c]}.state`, '', true);
                }
            }
        }
        this.queue = [];
        this.updateQueue();
    }
    push(messageObj) {
        this.queue.push(messageObj);
        if (messageObj.channels) {
            const getObjs = [];
            for (const i in messageObj.channels) {
                getObjs.push(this.adapter.getObjectAsync(messageObj.channels[i]).then(obj => {
                    if (obj && obj.common) {
                        messageObj.info += ` ${obj.common.name}`;
                    }
                }));
            }
            Promise.all(getObjs).then(() => this.updateQueue());
        }
        else {
            this.updateQueue();
        }
    }
    updateQueue() {
        // pingInterval = this.queue.length > 0 ? 10000 : adapter.config.pingInterval;
        const json = [];
        for (let i = this.queue.length - 1; i >= 0; i--) {
            json.push(this.queue[i].info);
            const channels = this.queue[i].channels;
            if (channels) {
                for (const c in channels) {
                    this.adapter.setState(`${channels[c]}.state`, `${i18n.waitingPos}: ${i}`, true);
                }
            }
        }
        this.adapter.setStateChanged('info.queue', JSON.stringify(json), true);
    }
    async close() {
        if (!this.closePromise) {
            this.closed = true;
            this.closePromise = (async () => {
                this.timerManager?.close();
                Object.keys(this.globalTimeouts).forEach(id => this.globalTimeouts[id] && this.adapter.clearTimeout(this.globalTimeouts[id]));
                this.globalTimeouts = {};
                await this.Map.shutdown();
            })();
        }
        return this.closePromise;
    }
}
module.exports = VacuumManager;
//# sourceMappingURL=vacuum.js.map