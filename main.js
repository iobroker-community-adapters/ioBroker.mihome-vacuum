'use strict';

/*
 * Created with @iobroker/create-adapter v1.27.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const dgram = require('dgram');
const MiHome = require('./lib/mihomepacket');
const com = require('./lib/comands');
const TimerManager = require('./lib/timerManager');
const RoomManager = require('./lib/roomManager');
const adapterName = require('./package.json').name.split('.').pop();
const MapHelper = require('./lib/maphelper');
const miio = require('./lib/miio');

global.systemDictionary = {};
require('./admin/words.js');


let Miio;
let Map;

class MihomeVacuum extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'mihome-vacuum',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async main() {
        //create new miio class
        Miio = new miio(this);

        Miio.on('connect', () => {
            this.log.debug('MAIN: Connected to device, try to get model..');
            this.getModelFromApi();

        });
    }

    /**
     * first communicaton to find out the model
     */
    async getModelFromApi() {
        this.InfoCouter = 0;

        try {
            const DeviceData = await Miio.sendMessage('miIO.info');

            this.log.debug('GETMODELFROMAPI:Data: ' + JSON.stringify(DeviceData));
        } catch (error) {
            this.log.debug('GETMODELFROMAPI: Error: No Data recived try again:' + this.InfoCouter);
            this.InfoCouter++;
            if (this.InfoCouter <= 10) {
                setTimeout(this.getModelFromApi.bind(this), 2000);
            } else {
                this.log.debug('GETMODELFROMAPI: Error: give up, make sure your robot has internet or restart your robot!');
            }

        }
    }

    /**
     * delete async function
     * @param {string} id
     */
    async delObj(id) {
        try {
            await this.delObjectAsync(id);
        } catch (error) {
            //... do nothing
        }
    }



    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('config option: ' + JSON.stringify(this.config.devices));
        this.log.info('config option2: ' + this.config.option2);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        await this.setObjectNotExistsAsync('testVariable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates('testVariable');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        await this.setStateAsync('testVariable', {
            val: true,
            ack: true
        });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        await this.setStateAsync('testVariable', {
            val: true,
            ack: true,
            expire: 30
        });

        // examples for the checkPassword/checkGroup functions
        let result = await this.checkPasswordAsync('admin', 'iobroker');
        this.log.info('check user admin pw iobroker: ' + result);

        result = await this.checkGroupAsync('admin', 'admin');
        this.log.info('check group user admin group admin: ' + result);

        Map = new MapHelper(null, this);
        //MAP.Init(); // for Map

        this.main();
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }


    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.message" property to be set to true in io-package.json
     * @param {ioBroker.Message} obj
     */
    onMessage(obj) {
        if (typeof obj === 'object' && obj.message) {
            if (obj.command === 'send') {
                // e.g. send email or pushover or whatever
                this.log.info('send command');

                // Send response in callback if required
                if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
            }
        }

        // responds to the adapter that sent the original message
        function respond(response) {
            obj.callback && adapter.sendTo(obj.from, obj.command, response, obj.callback);
        }

        // some predefined responses so we only have to define them once
        const predefinedResponses = {
            ACK: {
                error: null
            },
            OK: {
                error: null,
                result: 'ok'
            },
            ERROR_UNKNOWN_COMMAND: {
                error: 'Unknown command!'
            },
            MISSING_PARAMETER: paramName => {
                return {
                    error: 'missing parameter "' + paramName + '"!'
                };
            }
        };

        // make required parameters easier
        function requireParams(params /*: string[] */ ) {
            if (!(params && params.length)) {
                return true;
            }
            for (let i = 0; i < params.length; i++) {
                const param = params[i];
                if (!(obj.message && obj.message.hasOwnProperty(param))) {
                    respond(predefinedResponses.MISSING_PARAMETER(param));
                    return false;
                }
            }
            return true;
        }

        // use jsdoc here
        function sendCustomCommand(
            method /*: string */ ,
            params /*: (optional) string[] */ ,
            parser /*: (optional) (object) => object */
        ) {
            // parse arguments
            if (typeof params === 'function') {
                parser = params;
                params = null;
            }
            if (parser && typeof parser !== 'function') {
                throw new Error('Parser must be a function');
            }

            // send msg to the robo and get packet ID
            const id = sendMsg(method, params, {
                rememberPacket: false
            }, err => {
                // on error, respond immediately
                if (err) respond({
                    error: err
                });
                // else wait for the callback
            });

            // create callback to be called later
            sendCommandCallbacks[id] = function (response) {
                if (parser) {
                    // optionally transform the result
                    response = parser(response);
                } else {
                    // in any case, only return the result
                    response = response.result;
                }
                // now respond with the result
                respond({
                    error: null,
                    result: response
                });
                // remove the callback from the dict
                if (sendCommandCallbacks[id] !== null) {
                    delete sendCommandCallbacks[id];
                }
            };
        }

        // handle the message
        if (obj) {
            let params;

            switch (obj.command) {
                case 'discovery':
                    //adapter.log.info('discover' + JSON.stringify(obj))
                    Map.getDeviceStatus(obj.message.username, obj.message.password, obj.message.server, '{"getVirtualModel":false,"getHuamiDevices":0}')
                        .then(data => {
                            adapter.log.debug('discover__' + JSON.stringify(data));
                            respond(data);
                        })
                        .catch(err => {
                            adapter.log.info('discover ' + err);
                            respond({
                                error: err
                            });
                        });
                    return;

                    // call this with
                    // sendTo('mihome-vacuum.0', 'sendCustomCommand',
                    //     {method: 'method_id', params: [...] /* optional*/},
                    //     callback
                    // );

                case 'sendCustomCommand':
                    // require the method to be given
                    if (!requireParams(['method'])) {
                        return;
                    }
                    // params is optional

                    params = obj.message;
                    sendCustomCommand(params.method, params.params);
                    return;

                    // ======================================================================
                    // support for the commands mentioned here:
                    // https://github.com/MeisterTR/XiaomiRobotVacuumProtocol#vaccum-commands

                    // cleaning commands
                case 'startVacuuming':
                    if (cleaning.startCleaning(cleanStates.Cleaning, obj)) {
                        if (ViomiFlag) {
                            sendCustomCommand('set_mode_withroom', [0, 1, 0]);
                        } else {
                            sendCustomCommand('app_start');
                        }
                    }
                    return;

                case 'stopVacuuming':
                    sendCustomCommand('app_stop');
                    return;

                case 'clearQueue':
                    return cleaning.clearQueue();

                case 'cleanSpot':
                    if (cleaning.startCleaning(cleanStates.SpotCleaning, obj)) {
                        sendCustomCommand('app_spot');
                    }
                    return;

                case 'cleanZone':
                    if (!obj.message) {
                        return adapter.log.warn('cleanZone needs paramter coordinates');
                    }
                    if (!obj.zones) { // this data called first time!
                        const message = obj.message;
                        if (message.zones) { // called from roomManager with correct Array
                            obj.zones = message.zones;
                            obj.channels = message.channels;
                            obj.message = obj.zones.join(); // we use String for message
                        } else {
                            obj.zones = [obj.message];
                        }
                    }

                    if (typeof obj.channels == 'undefined') {
                        return roomManager.findChannelsByMapIndex(obj.zones, channels => {
                            adapter.log.debug('search channels for ' + obj.message + ' ->' + channels.join());
                            obj.channels = channels && channels.length ? channels : null;
                            adapter.emit('message', obj); // call function again
                        });
                    }

                    if (cleaning.startCleaning(cleanStates.ZoneCleaning, obj)) {
                        sendCustomCommand('app_zoned_clean', obj.zones);
                    }

                    return;

                case 'cleanSegments':
                    if (!obj.message) {
                        return adapter.log.warn('cleanSegments needs paramter mapIndex');
                    }
                    if (!obj.segments) { // this data called first time!
                        let message = obj.message;
                        if (message.segments) { // called from roomManager with correct Array
                            obj.segments = message.segments;
                            obj.channels = message.channels;
                            obj.message = obj.segments.join(); // we use String for message
                        } else { // build correct Array
                            if (!isNaN(message)) {
                                message = [parseInt(message, 10)];
                            } else {
                                if (typeof message == 'string') {
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
                        return roomManager.findChannelsByMapIndex(obj.segments, channels => {
                            adapter.log.debug('search channels for ' + obj.message + ' ->' + channels.join());
                            obj.channels = channels && channels.length ? channels : null;
                            adapter.emit('message', obj); // call function again
                        });
                    }
                    if (cleaning.startCleaning(cleanStates.RoomCleaning, obj)) {
                        //setTimeout(()=> {cleaning.setRemoteState(cleanStates.RoomCleaning)},2500) //simulate:
                        sendCustomCommand('app_segment_clean', obj.segments);
                    }

                    return;

                case 'cleanRooms':
                    const rooms = obj.message; // comma separated String with enum.rooms.XXX
                    if (!rooms) {
                        return adapter.log.warn('cleanRooms needs parameter ioBroker room-id\'s');
                    }
                    roomManager.findMapIndexByRoom(rooms, roomManager.cleanRooms);
                    return;

                case 'pause':
                    sendCustomCommand('app_pause');
                    setTimeout(sendPing, 2000);
                    return;

                case 'charge':
                    sendCustomCommand('app_charge');
                    setTimeout(sendPing, 2000);
                    return;

                    // TODO: What does this do?
                case 'findMe':
                    sendCustomCommand('find_me');
                    return;

                    // get info about the consumables
                    // TODO: parse the results
                case 'getConsumableStatus':
                    sendCustomCommand('get_consumable', returnSingleResult);
                    return;

                case 'resetConsumables':
                    if (!requireParams(['consumable'])) {
                        return;
                    }
                    sendCustomCommand('reset_consumable', obj.message.consumable);
                    setTimeout(sendMsg, 2000, 'get_consumable');
                    return;

                    // get info about cleanups
                case 'getCleaningSummary':
                    sendCustomCommand('get_clean_summary', parseCleaningSummary);
                    return;

                case 'getCleaningRecord':
                    // require the record id to be given
                    if (!requireParams(['recordId'])) {
                        return;
                    }
                    // TODO: can we do multiple at once?
                    sendCustomCommand('get_clean_record', [obj.message.recordId], parseCleaningRecords);
                    return;

                    // TODO: find out how this works
                    // case 'getCleaningRecordMap':
                    //     sendCustomCommand('get_clean_record_map');
                case 'getMap':
                    sendCustomCommand('get_map_v1');
                    return;

                    // Basic information
                case 'getStatus':
                    sendCustomCommand('get_status', parseStatus);
                    return;

                case 'getSerialNumber':
                    sendCustomCommand('get_serial_number', resp =>
                        resp.result[0].serial_number);
                    return;

                case 'getDeviceDetails':
                    sendCustomCommand('miIO.info');
                    return;

                    // Do not disturb
                case 'getDNDTimer':
                    sendCustomCommand('get_dnd_timer', returnSingleResult);
                    return;

                case 'setDNDTimer':
                    // require start and end time to be given
                    if (!requireParams(['startHour', 'startMinute', 'endHour', 'endMinute'])) {
                        return;
                    }
                    params = obj.message;
                    sendCustomCommand('set_dnd_timer', [params.startHour, params.startMinute, params.endHour, params.endMinute]);
                    return;

                case 'deleteDNDTimer':
                    sendCustomCommand('close_dnd_timer');
                    return;

                    // Fan speed
                case 'getFanSpeed':
                    // require start and end time to be given
                    sendCustomCommand('get_custom_mode', returnSingleResult);
                    return;

                case 'setFanSpeed':
                    // require start and end time to be given
                    if (!requireParams(['fanSpeed'])) {
                        return;
                    }
                    sendCustomCommand('set_custom_mode', [obj.message.fanSpeed]);
                    return;

                    // Remote controls
                case 'startRemoteControl':
                    sendCustomCommand('app_rc_start');
                    return;
                case 'get_prop':
                    sendCustomCommand('get_prop', obj.message);
                    return;

                case 'stopRemoteControl':
                    sendCustomCommand('app_rc_end');
                    return;

                case 'move':
                    // require all params to be given
                    if (!requireParams(['velocity', 'angularVelocity', 'duration', 'sequenceNumber'])) {
                        return;
                    }
                    // TODO: Constrain the params
                    params = obj.message;
                    // TODO: can we issue multiple commands at once?
                    const args = [{
                        omega: params.angularVelocity,
                        velocity: params.velocity,
                        seqnum: params.sequenceNumber, // <- TODO: make this automatic
                        duration: params.duration
                    }];
                    sendCustomCommand('app_rc_move', [args]);
                    return;

                    // ======================================================================
                default:
                    respond(predefinedResponses.ERROR_UNKNOWN_COMMAND);
                    return;
            }
        }
    }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new MihomeVacuum(options);
} else {
    // otherwise start the instance directly
    new MihomeVacuum();
}