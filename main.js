/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';


// you have to require the utils module and call adapter function
const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const adapter = new utils.Adapter('mihome-vacuum');
const dgram = require('dgram');
const MiHome = require(__dirname + '/lib/mihomepacket');
const com = require(__dirname + '/lib/comands');
const TimerManager = require(__dirname + '/lib/timerManager');
const RoomManager = require(__dirname + '/lib/roomManager');
global.systemDictionary = {}
require(__dirname + '/admin/words.js')

let maphelper = require(__dirname + '/lib/maphelper')


const server = dgram.createSocket('udp4');

let userLang = "en"
let isConnect = false;
let connected = false;
let commands = {};
let paramPingInterval;
let packet;
let firstSet = true;
let cleanLog = [];
let cleanLogHtmlAllLines = '';
let clean_log_html_table = '';
let logEntries = {};
let logEntriesNew = {};
let roomManager = null;
let timerManager = null;
let Map

// this parts will be translated
const i18n = {
    weekDaysFull: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    notAvailable: "not available",
    nextTimer: "next timer",
    loadRooms: "load rooms from robot",
    cleanRoom: "clean Room",
    cleanMultiRooms: "clean assigned rooms",
    addRoom: "insert map Index or zone coordinates",
    waterBox_installed: "water box installed",
    waterBox_filter: "clean water Filter",
    waterBox_filter_reset: "water filter reset"
}
const cleanStatus_Unknown = 0
const cleanStatus_Initiating = 1
const cleanStatus_Sleeping = 2
const cleanStatus_Waiting = 3
//const cleanStatus_??? = 4
const cleanStatus_Cleaning = 5
const cleanStatus_Back_toHome = 6
const cleanStatus_ManuellMode = 7
const cleanStatus_Charging = 8
const cleanStatus_Charging_Error = 9
const cleanStatus_Pause = 10
const cleanStatus_SpotCleaning = 11
const cleanStatus_InError = 12
const cleanStatus_ShuttingDown = 13
const cleanStatus_Updating = 14
const cleanStatus_Docking = 15
const cleanStatus_GoingToSpot = 16
const cleanStatus_ZoneCleaning = 17
const cleanStatus_RoomCleaning = 18

const MAP = function () {}; // init MAP

class Cleaning {
    constructor() {
        this.state = cleanStatus_Unknown // current robot Status
        this.isActive = false // if robot is working, than her the status is saved
        this.queue = [] // if new job is aclled, while robot is already cleaning
    }

    /**
     * is called, if robot send status
     * @param {number} newVal new status
     */
    setRemoteState(newVal) {
        this.state = newVal;
        adapter.setState('info.state', this.state, true);

        if ([cleanStatus_Cleaning, cleanStatus_ZoneCleaning, cleanStatus_RoomCleaning, cleanStatus_SpotCleaning].indexOf(this.state) > -1) {
            this.isActive = this.state;
        } else {
            this.isActive = 0
            if ([cleanStatus_Sleeping, cleanStatus_Waiting, cleanStatus_Back_toHome, cleanStatus_Charging, cleanStatus_GoingToSpot].indexOf(this.state) > -1) {
                if (this.queue.length > 0) {
                    adapter.log.debug("use clean trigger from Queue")
                    adapter.emit('message', this.queue.shift());
                    adapter.setState("info.queue", this.queue.length, true)
                }
            }
        }
        adapter.setState('control.clean_home', this.isActive != 0, true);


        if (MAP.ENABLED) { // set map getter to true if..
            if ([cleanStatus_Cleaning, cleanStatus_Back_toHome, cleanStatus_SpotCleaning, cleanStatus_GoingToSpot, cleanStatus_ZoneCleaning, cleanStatus_RoomCleaning].indexOf(this.state) > -1) {
                MAP.StartMapPoll();
            } else {
                MAP.GETMAP = false;
            }
        }
    }

    cleanHome(value) {
        if (value && !this.isActive) {
            sendMsg(com.start.method);
            setTimeout(() => sendMsg(com.get_status.method), 2000);
        } else if (!value && this.isActive) {
            sendMsg(com.pause.method);
            setTimeout(() => sendMsg(com.home.method), 1000);
            this.isActive = 0
        }
        adapter.setForeignState('control.clean_home', value, true);
    }

    push(messageObj) {
        this.queue.push(messageObj)
        adapter.setState('info.queue', this.queue.length, true)
    }
}

const cleaning = new Cleaning()

// new features are initial false and shold be enabled, if result from robot is available
class FeatureManager {

    constructor() {
        this.firmware = null
        this.model = null
        this.goto = false
        this.zoneClean = false
        this.mob = false
        this.water_box = null
        this.carpetMode = null
        this.roomMapping = null
    }

    init() {
        //adapter.states
        adapter.getState('info.device_model', function (err, state) {
            state && state.val && features.setModel(state.val);
        });
        adapter.getState('info.device_fw', function (err, state) {
            state && state.val && features.setFirmware(state.val);
        });

        // we get miIO.info only, if the robot is connected to the internet, so we init with unavailable
        adapter.setState('info.wifi_signal', "unavailable", true);

        roomManager = new RoomManager(adapter, i18n)
        timerManager = new TimerManager(adapter, i18n)

        setTimeout(this.initDelayed, 3000); // wait for extending 'control.fan_power'
    }

    initDelayed() {
        sendMsg(com.get_carpet_mode.method) // test, if supported
        sendMsg('get_room_mapping'); // test, if supported
        setTimeout(function () { // it is UDP, so let's try agin once again after 1 minute
            this.carpetMode === null && sendMsg(com.get_carpet_mode.method)
            this.roomMapping === null && sendMsg('get_room_mapping')
        }, 60000)
    }

    setModel(model) {
        if (this.model != model) {
            adapter.setStateChanged('info.device_model', model, true);
            this.model = model;
            this.mob = (model === 'roborock.vacuum.s5' || model === 'roborock.vacuum.s6')

            if (model === 'roborock.vacuum.m1s' || model === 'roborock.vacuum.s5' || model === 'roborock.vacuum.s6') {
                adapter.log.info('change states from State control.fan_power');
                adapter.setObject('control.fan_power', {
                    type: 'state',
                    common: {
                        name: 'Suction power',
                        type: 'number',
                        role: 'level',
                        read: true,
                        write: true,
                        min: 101,
                        max: 106,
                        states: {
                            101: 'QUIET',
                            102: 'BALANCED',
                            103: 'TURBO',
                            104: 'MAXIMUM',
                            106: 'CUSTOM' // setting for rooms will be used
                        }
                    },
                    native: {}
                });
            }
            if (this.mob) {
                adapter.log.info('extend state mop for State control.fan_power');
                setTimeout(adapter.extendObject, 2000, 'control.fan_power', {
                    common: {
                        max: 105,
                        states: {
                            105: "MOP" // no vacuum, only mop
                        }
                    }
                }); // need time, until the new setting above
            }
        }
    }

    setFirmware(fw_ver) {
        if (this.firmware != fw_ver) {
            this.firmware = fw_ver
            adapter.setStateChanged('info.device_fw', fw_ver, true);

            let fw = fw_ver.split('_'); // Splitting the FW into [Version, Build] array.
            if (parseInt(fw[0].replace(/\./g, ''), 10) > 339 || (parseInt(fw[0].replace(/\./g, ''), 10) === 339 && parseInt(fw[1], 10) >= 3194)) {
                adapter.log.info('New generation or new fw detected, create new states goto and zoneclean');
                this.goto = true;
                this.zoneClean = true;
            }
            this.goto && adapter.setObjectNotExists('control.goTo', {
                type: 'state',
                common: {
                    name: 'Go to point',
                    type: 'string',
                    read: true,
                    write: true,
                    desc: 'let the vacuum go to a point on the map',
                },
                native: {}
            });
            if (this.zoneClean) {
                adapter.setObjectNotExists('control.zoneClean', {
                    type: 'state',
                    common: {
                        name: 'Clean a zone',
                        type: 'string',
                        read: true,
                        write: true,
                        desc: 'let the vacuum go to a point and clean a zone',
                    },
                    native: {}
                });
                if (!adapter.config.enableResumeZone) {
                    adapter.setObjectNotExists('control.resumeZoneClean', {
                        type: 'state',
                        common: {
                            name: "Resume paused zoneClean",
                            type: "boolean",
                            role: "button",
                            read: false,
                            write: true,
                            desc: "resume zoneClean that has been paused before",
                        },
                        native: {}
                    });
                } else {
                    adapter.deleteState(adapter.namespace, 'control', 'resumeZoneClean');
                }
            }
        }
    }

    setCarpetMode(enabled) {
        if (this.carpetMode === null) {
            this.carpetMode = true
            adapter.log.info('create state for carpet_mode');
            adapter.setObjectNotExists('control.carpet_mode', {
                type: 'state',
                common: {
                    name: 'Carpet mode',
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: true,
                    desc: 'Fanspeed is Max on carpets',
                },
                native: {}
            });
            reqParams.push(com.get_carpet_mode.method); // from now, it should be checked always 
        }
        adapter.setStateChanged('control.carpet_mode', enabled === 1, true);
    }

    setWaterBox(water_box_status) {
        if (this.water_box === null) { // todo: check if filter_element_work_time depends on water_box_status and 
            this.water_box = !isNaN(water_box_status);
            if (this.water_box) {
                adapter.log.info('create states for water box');
                adapter.setObjectNotExists('info.water_box', {
                    type: "state",
                    common: {
                        name: i18n.waterBox_installed,
                        type: "text",
                        role: "info",
                        read: true,
                        write: false
                    },
                    native: {}
                });
                adapter.log.info('create states for water box filter');
                adapter.setObjectNotExists('consumable.water_filter', {
                    type: "state",
                    common: {
                        name: i18n.waterBox_filter,
                        type: "number",
                        role: "level",
                        read: true,
                        write: false,
                        unit: "%"
                    },
                    native: {}
                });
                adapter.setObjectNotExists('consumable.water_filter_reset', {
                    type: "state",
                    common: {
                        name: i18n.waterBox_filter_reset,
                        type: "boolean",
                        role: "button",
                        read: false,
                        write: true,
                        unit: "%"
                    },
                    native: {}
                });
            }
        }
        this.water_box && adapter.setStateChanged('info.water_box', water_box_status === 1, true);
    }
}
const features = new FeatureManager();

const last_id = {
    get_status: 0,
    get_consumable: 0,
    get_clean_summary: 0,
    get_clean_record: 0,
    X_send_command: 0,
};

let reqParams = [
    com.miIO_info.method,
    com.get_consumable.method,
    com.clean_summary.method,
    com.get_sound_volume.method
];

//Tabelleneigenschaften
// TODO: Translate
const clean_log_html_attr = '<colgroup> <col width="50"> <col width="50"> <col width="80"> <col width="100"> <col width="50"> <col width="50"> </colgroup>';
const clean_log_html_head = '<tr> <th>Datum</th> <th>Start</th> <th>Saugzeit</th> <th>Fläche</th> <th>???</th> <th>Ende</th></tr>';


// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (!state || state.ack) return;

    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // output to parser

    const terms = id.split('.')
    const command = terms.pop();
    const parent = terms.pop();

    if (com[command]) {
        let params = com[command].params || '';
        if (state.val !== true && state.val !== 'true') {
            params = state.val;
        }
        if (state.val !== false && state.val !== 'false') {
            if (command === 'start' && cleaning.isActive && adapter.config.enableResumeZone) {
                adapter.log.debug('Resuming paused zoneclean.');
                sendMsg('resume_zoned_clean', null, function () {
                    adapter.setForeignState(id, state.val, true);
                });
            } else {
                sendMsg(com[command].method, [params], function () {
                    adapter.setForeignState(id, state.val, true);
                });
            }
        }

    } else {
        // Send own commands
        if (command === 'X_send_command') {
            const values = (state.val || '').trim().split(';');
            //const method = values[0];
            let params = {};
            last_id.X_send_command = packet.msgCounter;
            if (values[1]) {
                try {
                    params = JSON.parse(values[1]);
                } catch (e) {
                    adapter.log.warn('Could not send these params because its not in JSON format: ' + values[1]);
                } finally {

                }
                adapter.log.info('send message: Method: ' + values[0] + ' Params: ' + values[1]);
                sendMsg(values[0], params, function () {
                    adapter.setForeignState(id, state.val, true);
                });
            } else {
                adapter.log.info('send message: Method: ' + values[0]);
                sendMsg(values[0], [''], function () {
                    adapter.setForeignState(id, state.val, true);
                });

            }

        } else if (command === 'clean_home') {
            cleaning.cleanHome(state.val)

        } else if (command === 'carpet_mode') {
            //when carpetmode change
            if (state.val === true || state.val === 'true') {
                sendMsg('set_carpet_mode', [{
                    enable: 1
                }], function () {
                    adapter.setForeignState(id, state.val, true);
                });
            } else {
                sendMsg('set_carpet_mode', [{
                    enable: 0
                }], function () {
                    adapter.setForeignState(id, false, true);
                });
            }

        } else if (command === 'goTo') {
            //changeMowerCfg(id, state.val);
            //goto function wit error catch
            parseGoTo(state.val, function () {
                adapter.setForeignState(id, state.val, true);
            });

        } else if (command === 'zoneClean') {
            adapter.sendTo(adapter.namespace, "cleanZone", state.val)
            adapter.setForeignState(id, '', true);

        } else if (command === 'resumeZoneClean') {
            sendMsg('resume_zoned_clean', null, function () {
                adapter.setForeignState(id, state.val, true);
            });

        } else if (command === 'loadRooms') {
            sendMsg('get_room_mapping', null, function () {
                adapter.setForeignState(id, state.val, true);
            });
        } else if (command === 'addRoom') {
            if (!isNaN(state.val))
                roomManager.createRoom("manual_" + state.val, parseInt(state.val, 10))
            else {
                let terms = state.val.match(/((?:[0-9]+\,){3,3}[0-9]+)(\,[0-9]+)?/)
                if (terms)
                    roomManager.createRoom("manual_" + terms[1].replace(/,/g, '_'), '[' + terms[1] + (terms[2] || ',1') + ']')
                else
                    adapter.log.warn('invalid input for addRoom, use index of map or coordinates like 1111,2222,3333,4444')
            }
            adapter.setForeignState(id, '', true);

        } else if (command === 'roomClean') {
            roomManager.cleanRooms([id.replace("roomClean", "mapIndex")]);
            adapter.setForeignState(id, true, true);
        } else if (command === 'multiRoomClean' || parent === 'timer') {
            if (parent === 'timer') {
                adapter.setForeignState(id, (state.val == TimerManager.SKIP || state.val == TimerManager.DISABLED) ? state.val : TimerManager.ENABLED, true, function () {
                    timerManager.calcNextProcess()
                });
                if (state.val != TimerManager.START) return
            } else
                adapter.setForeignState(id, true, true);
            // search for assigned roomObjs or id on timer
            adapter.getForeignObjects(id, 'state', 'rooms', function (err, states) {
                if (states) {
                    let mapIndex = [];
                    if (states[id].native.channels) {
                        for (let i in states[id].native.channels)
                            mapIndex.push(adapter.namespace.concat('.rooms.', states[id].native.channels[i], '.mapIndex'))
                    }
                    let rooms = ""
                    for (let r in states[id].enums)
                        rooms += r
                    if (rooms.length > 0) {
                        roomManager.findMapIndexByRoom(rooms, function (states) {
                            roomManager.cleanRooms(mapIndex.concat(states))
                        })
                    } else if (mapIndex.length > 0) {
                        roomManager.cleanRooms(mapIndex);
                    } else
                        adapter.log.warn("no room found for " + id)
                }
            })
        } else if (command === 'roomFanPower') {
            // do nothing, only set fan power for next roomClean
            adapter.setForeignState(id, state.val, true);
        } else if (com[command] === undefined) {
            adapter.log.error('Unknown state "' + id + '"');
        } else {
            adapter.log.error('Command "' + command + '" is not configured');
        }
    }

});

// is called if a subscribed obj (rooms.*) changes
/*
adapter.on('objectChange', function (id, obj) {
    adapter.log.error('objectChange ' + id + ' ' + JSON.stringify(obj));
    if (adapter.config.enableAlexa && obj.type == "channel" && obj.common.name != id.split('.').pop()){
        adapter.getObject(obj._id + '.roomClean', function(err, rcObj){
            if (rcObj && !rcObj.common.smartName || rcObj.common.smartName == i18n.cleanRoom){
                rcObj.common.smartName=  i18n.cleanRoom + ' ' + obj.common.name
                adapter.setObject(rcObj._id,rcObj,function(err){
                    if (!err)
                        adapter.log.info("set smartname to " + rcObj.common.smartName)
                })
            }
        })
    }
})
*/
adapter.on('unload', function (callback) {
    if (pingTimeout) clearTimeout(pingTimeout);
    adapter.setState('info.connection', false, true);
    if (paramPingInterval) clearInterval(paramPingInterval);
    if (typeof callback === 'function') callback();
});


adapter.on('ready', main);

let pingTimeout = null;

function sendPing() {
    pingTimeout = setTimeout(() => {
        pingTimeout = null;
        if (connected) {
            connected = false;
            adapter.log.debug('Disconnect');
            adapter.setState('info.connection', false, true);
        }
    }, 3000);

    if (connected) {
        sendMsg(com.get_status.method)
    } else {
        try {
            server.send(commands.ping, 0, commands.ping.length, adapter.config.port, adapter.config.ip, function (err) {
                if (err) adapter.log.error('Cannot send ping: ' + err)
            });
        } catch (e) {
            adapter.log.warn('Cannot send ping: ' + e);
            clearTimeout(pingTimeout);
            pingTimeout = null;
            if (connected) {
                connected = false;
                adapter.log.debug('Disconnect');
                adapter.setState('info.connection', false, true);
            }
        }
    }
    setTimeout(sendPing, cleaning.queue.length > 0 ? 10000 : adapter.config.pingInterval)
}

// function to control goto params
function parseGoTo(params, callback) {
    const coordinates = params.split(',');
    if (coordinates.length === 2) {
        const xVal = coordinates[0];
        const yVal = coordinates[1];

        if (!isNaN(yVal) && !isNaN(xVal)) {
            //send goTo request with koordinates
            sendMsg('app_goto_target', [parseInt(xVal), parseInt(yVal)]);
            callback();
        } else adapter.log.error('GoTo need two koordinates with type number');
        adapter.log.info('xVAL: ' + xVal + '  yVal:  ' + yVal);

    } else {
        adapter.log.error('GoTo only work with two arguments seperated by ', '');
    }
}

function send(reqParams, cb, i) {
    i = i || 0;
    if (!reqParams || i >= reqParams.length) {
        return cb && cb();
    }

    sendMsg(reqParams[i], null, () => {
        setTimeout(send, 200, reqParams, cb, i + 1);
    });
}

function requestParams() {
    if (connected) {
        adapter.log.debug('requesting params every: ' + adapter.config.param_pingInterval / 1000 + ' Sec');

        send(reqParams, () => {
            if (!isEquivalent(logEntriesNew, logEntries)) {
                logEntries = logEntriesNew;
                cleanLog = [];
                cleanLogHtmlAllLines = '';
                getLog(() => {
                    adapter.setState('history.allTableJSON', JSON.stringify(cleanLog), true);
                    //adapter.log.debug('CLEAN_LOGGING' + JSON.stringify(cleanLog));
                    adapter.setState('history.allTableHTML', clean_log_html_table, true);
                });
            }
        });

        timerManager && timerManager.check()
    }
}

function sendMsg(method, params, options, callback) {
    // define optional options
    if (typeof options === 'function') {
        callback = options;
        options = null;
    }

    // define default options
    options = options || {};
    if (options.rememberPacket === undefined) {
        options.rememberPacket = true;
    } // remember packets per default

    // remember packet if not explicitly forbidden
    // this is used to route the returned package to the sendTo callback
    if (options.rememberPacket) {
        last_id[method] = packet.msgCounter;
        //adapter.log.debug('lastid' + JSON.stringify(last_id));
    }

    const message_str = buildMsg(method, params);

    try {
        const cmdraw = packet.getRaw_fast(message_str);

        server.send(cmdraw, 0, cmdraw.length, adapter.config.port, adapter.config.ip, err => {
            if (err) adapter.log.error('Cannot send command: ' + err);
            if (typeof callback === 'function') callback(err);
        });
        if (method === 'get_map_v1') adapter.log.debug('sendMsg >>> ' + message_str);
        //adapter.log.debug('sendMsgRaw >>> ' + cmdraw.toString('hex'));
    } catch (err) {
        adapter.log.warn('Cannot send message_: ' + err);
        if (typeof callback === 'function') callback(err);
    }
    packet.msgCounter++;
}


function buildMsg(method, params) {
    const message = {};
    if (method) {
        message.id = packet.msgCounter;
        message.method = method;
        if (!(params === '' || params === undefined || params === null || (params instanceof Array && params.length === 1 && params[0] === ''))) {
            message.params = params;
        }
    } else {
        adapter.log.warn('Could not build message without arguments');
    }
    return JSON.stringify(message).replace('["[', '[[').replace(']"]', ']]');
}


function str2hex(str) {
    str = str.replace(/\s/g, '');
    const buf = new Buffer(str.length / 2);

    for (let i = 0; i < str.length / 2; i++) {
        buf[i] = parseInt(str[i * 2] + str[i * 2 + 1], 16);
    }
    return buf;
}

/** Parses the answer to a get_clean_summary message */
function parseCleaningSummary(response) {
    response = response.result;
    return {
        clean_time: response[0], // in seconds
        total_area: response[1], // in cm^2
        num_cleanups: response[2],
        cleaning_record_ids: response[3], // number[]
    };
}

/** Parses the answer to a get_clean_record message */
function parseCleaningRecords(response) {
    return response.result.map(entry => {
        return {
            start_time: entry[0], // unix timestamp
            end_time: entry[1], // unix timestamp
            duration: entry[2], // in seconds
            area: entry[3], // in cm^2
            errors: entry[4], // ?
            completed: entry[5] === 1, // boolean
        };
    });
}

/** Parses the answer from miIO.info 
 *  response= {"result":{"hw_ver":"Linux","fw_ver":"3.5.4_0850",
               "ap":{"ssid":"xxxxx","bssid":"xx:xx:xx:xx:xx:xx","rssi":-46},
               "netif":{"localIp":"192.168.1.154","mask":"255.255.255.0","gw":"192.168.1.1"},
               "model":"roborock.vacuum.s6","mac":"yy:yy:yy:yy:yy:yy","token":"xxxxxxxxxxxxxxxxxxxxxxxxx","life":59871}
   
function parseMiIO_info(response){
    return response.result;
}
*/
/** Parses the answer of get_consumable
 *  response= {"result":[{"main_brush_work_time":11472,"side_brush_work_time":11472,"filter_work_time":11472,"filter_element_work_time":3223,"sensor_dirty_time":11253}]}

function parseConsumable(response){
    return response.result[0];
}
 */

/** Parses the answer from get_carpet_mode 
function parseCarpetMode(response){
    let result= response.result[0];
    return result;
    //"result":[{"enable":1,"current_integral":450,"current_high":500,"current_low":400,"stall_time":10}]
}
*/

// TODO: deduplicate from io-package.json
const errorTexts = {
    '0': 'No error',
    '1': 'Laser distance sensor error',
    '2': 'Collision sensor error',
    '3': 'Wheels on top of void, move robot',
    '4': 'Clean hovering sensors, move robot',
    '5': 'Clean main brush',
    '6': 'Clean side brush',
    '7': 'Main wheel stuck?',
    '8': 'Device stuck, clean area',
    '9': 'Dust collector missing',
    '10': 'Clean filter',
    '11': 'Stuck in magnetic barrier',
    '12': 'Low battery',
    '13': 'Charging fault',
    '14': 'Battery fault',
    '15': 'Wall sensors dirty, wipe them',
    '16': 'Place me on flat surface',
    '17': 'Side brushes problem, reboot me',
    '18': 'Suction fan problem',
    '19': 'Unpowered charging station',
};

/** Parses the answer to a get_status message 
 * response =  {"result":[{"msg_ver":2,"msg_seq":5680,"state":8,"battery":100,"clean_time":8,"clean_area":0,
 *                          "error_code":0,"map_present":1,"in_cleaning":0,"in_returning":0,"in_fresh_state":1,
 *                          "lab_status":1,"water_box_status":0,"fan_power":103,"dnd_enabled":0,"map_status":3,"lock_status":0}]
 */
function parseStatus(response) {
    response = response.result[0];
    response.dnd_enabled = response.dnd_enabled === 1;
    response.error_text = errorTexts[response.error_code];
    response.in_cleaning = response.in_cleaning === 1;
    response.map_present = response.map_present === 1;
    //response.state_text= statusTexts[response.state];
    return response;
}

/** Parses the answer to a get_dnd_timer message */
/* function parseDNDTimer(response) {
    response = response.result[0];
    response.enabled = (response.enabled === 1);
    return response;
}*/

function getStates(message) {
    //Search id in answer
    clearTimeout(pingTimeout);
    pingTimeout = null;
    if (!connected) {
        connected = true;
        adapter.log.debug('Connected');
        adapter.setState('info.connection', true, true);
    }

    try {
        const answer = JSON.parse(message);
        answer.id = parseInt(answer.id, 10);
        //const ans= answer.result;
        //adapter.log.info(answer.result.length);
        //adapter.log.info(answer['id']);
        if (answer.error) {
            let name = "unknown"
            for (let i in last_id)
                if (last_id[i] == answer.id)
                    name = i
            return adapter.log.error("[" + answer.id + "](" + name + ") -> " + answer.error.message)
        }
        if (answer.id === last_id.get_status) {

            const status = parseStatus(answer);
            adapter.setStateChanged('info.battery', status.battery, true);
            adapter.setStateChanged('info.cleanedtime', Math.round(status.clean_time / 60), true);
            adapter.setStateChanged('info.cleanedarea', Math.round(status.clean_area / 10000) / 100, true);
            adapter.setStateChanged('control.fan_power', Math.round(status.fan_power), true);

            adapter.setStateChanged('info.error', status.error_code, true);
            adapter.setStateChanged('info.dnd', status.dnd_enabled, true);
            features.setWaterBox(status.water_box_status);
            if (cleaning.state != status.state) {
                cleaning.setRemoteState(status.state)
            }
        } else if (answer.id === last_id['miIO.info']) {
            const info = answer.result //parseMiIO_info(answer);
            features.setFirmware(info.fw_ver)
            features.setModel(info.model)
            adapter.setStateChanged('info.wifi_signal', info.ap.rssi, true);

        } else if (answer.id === last_id.get_sound_volume) {
            adapter.setStateChanged('control.sound_volume', answer.result[0], true);

        } else if (answer.id === last_id.get_carpet_mode) {
            features.setCarpetMode(answer.result[0].enable)

        } else if (answer.id === last_id.get_consumable) {
            const consumable = answer.result[0] //parseConsumable(answer)
            adapter.setStateChanged('consumable.main_brush', 100 - (Math.round(consumable.main_brush_work_time / 3600 / 3)), true); // 300h
            adapter.setStateChanged('consumable.side_brush', 100 - (Math.round(consumable.side_brush_work_time / 3600 / 2)), true); // 200h
            adapter.setStateChanged('consumable.filter', 100 - (Math.round(consumable.filter_work_time / 3600 / 1.5)), true); // 150h
            adapter.setStateChanged('consumable.sensors', 100 - (Math.round(consumable.sensor_dirty_time / 3600 / 0.3)), true); // 30h
            features.water_box && adapter.setStateChanged('consumable.water_filter', 100 - (Math.round(consumable.filter_element_work_time / 3600)), true); // 100h
        } else if (answer.id === last_id.get_clean_summary) {
            const summary = parseCleaningSummary(answer);
            adapter.setStateChanged('history.total_time', Math.round(summary.clean_time / 60), true);
            adapter.setStateChanged('history.total_area', Math.round(summary.total_area / 1000000), true);
            adapter.setStateChanged('history.total_cleanups', summary.num_cleanups, true);
            logEntriesNew = summary.cleaning_record_ids;
            //adapter.log.info('log_entrya' + JSON.stringify(logEntriesNew));
            //adapter.log.info('log_entry old' + JSON.stringify(logEntries));


        } else if (answer.id === last_id.X_send_command) {
            adapter.setState('control.X_get_response', JSON.stringify(answer.result), true);

        } else if (answer.id === last_id.get_clean_record) {
            const records = parseCleaningRecords(answer);
            for (let j = 0; j < records.length; j++) {
                const record = records[j];

                const dates = new Date();
                let hour = '';
                let min = '';
                dates.setTime(record.start_time * 1000);
                if (dates.getHours() < 10) {
                    hour = '0' + dates.getHours();
                } else {
                    hour = dates.getHours();
                }
                if (dates.getMinutes() < 10) {
                    min = '0' + dates.getMinutes();
                } else {
                    min = dates.getMinutes();
                }

                const log_data = {
                    Datum: dates.getDate() + '.' + (dates.getMonth() + 1),
                    Start: hour + ':' + min,
                    Saugzeit: Math.round(record.duration / 60) + ' min',
                    'Fläche': Math.round(record.area / 10000) / 100 + ' m²',
                    Error: record.errors,
                    Ende: record.completed
                };


                cleanLog.push(log_data);
                clean_log_html_table = makeTable(log_data);


            }
        } else if (answer.id == last_id.get_room_mapping) {
            features.roomMapping = true;
            if (answer.result.length) {
                roomManager.processRoomMaping(answer);
            } else if (!answer.result.length) {
                adapter.log.debug('Empty array try to get from Map')
                MAP.getRoomsFromMap(answer);
            }

        } else if (answer.id === last_id['get_map_v1'] || answer.id === last_id['get_fresh_map_v1']) {
            MAP.updateMapPointer(answer.result[0]);

        } else if (answer.id in sendCommandCallbacks) {

            // invoke the callback from the sendTo handler
            const callback = sendCommandCallbacks[answer.id];
            if (typeof callback === 'function') callback(answer);
        }
    } catch (err) {
        adapter.log.debug('The answer from the robot is not correct! (' + err + ') ' + JSON.stringify(message));
    }
}


function getLog(callback, i) {
    i = i || 0;

    if (!logEntries || i >= logEntries.length) {
        callback && callback();
    } else {
        if (logEntries[i] !== null || logEntries[i] !== 'null') {
            //adapter.log.debug('Request log entry: ' + logEntries[i]);
            sendMsg('get_clean_record', [logEntries[i]], () => {
                setTimeout(getLog, 200, callback, i + 1);
            });
        } else {
            adapter.log.error('Could not find log entry');
            setImmediate(getLog, callback, i + 1);
        }
    }
}


function isEquivalent(a, b) {
    // Create arrays of property names
    const aProps = Object.getOwnPropertyNames(a);
    const bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length !== bProps.length) {
        return false;
    }

    for (let i = 0; i < aProps.length; i++) {
        const propName = aProps[i];

        // If values of same property are not equal,
        // objects are not equivalent
        if (a[propName] !== b[propName]) {
            return false;
        }
    }

    // If we made it this far, objects
    // are considered equivalent
    return true;
}


function makeTable(line) {
    // const head = clean_log_html_head;
    let html_line = '<tr>';

    html_line += '<td>' + line.Datum + '</td>' + '<td>' + line.Start + '</td>' + '<td ALIGN="RIGHT">' + line.Saugzeit + '</td>' + '<td ALIGN="RIGHT">' + line['Fläche'] + '</td>' + '<td ALIGN="CENTER">' + line.Error + '</td>' + '<td ALIGN="CENTER">' + line.Ende + '</td>';

    html_line += '</tr>';

    cleanLogHtmlAllLines += html_line;

    return '<table>' + clean_log_html_attr + clean_log_html_head + cleanLogHtmlAllLines + '</table>';

}

function enabledExpert() {
    if (adapter.config.enableSelfCommands) {
        adapter.log.info('Expert mode enabled, states created');
        adapter.setObjectNotExists('control.X_send_command', {
            type: 'state',
            common: {
                name: 'send command',
                type: 'string',
                read: true,
                write: true,
            },
            native: {}
        });
        adapter.setObjectNotExists('control.X_get_response', {
            type: 'state',
            common: {
                name: 'get response',
                type: 'string',
                read: true,
                write: false,
            },
            native: {}
        });


    } else {
        adapter.log.info('Expert mode disabled, states deleted');
        adapter.delObject('control.X_send_command');
        adapter.delObject('control.X_get_response');

    }

}

function enabledVoiceControl() {
    if (adapter.config.enableAlexa) {
        adapter.log.info('Create state clean_home for controlling by cloud adapter');

        adapter.setObjectNotExists('control.clean_home', {
            type: 'state',
            common: {
                name: 'Start/Home',
                type: 'boolean',
                role: 'state',
                read: true,
                write: true,
                desc: 'Start and go home',
                smartName: 'Staubsauger'
            },
            native: {}
        });

    } else {
        adapter.log.info('Cloud control disabled');
        adapter.delObject('control.clean_home');

    }

}

//create default states
function init() {
    adapter.getForeignObject('system.config', (err, systemConfig) => {
        if (systemConfig && systemConfig.common && systemConfig.common.language && systemDictionary.Sunday[systemConfig.common.language]) {
            userLang = systemConfig.common.language
            let obj
            for (let i in i18n) {
                obj = i18n[i]
                if (typeof obj == "string")
                    i18n[i] = systemDictionary[obj][userLang]
                else if (typeof obj == "object")
                    for (let o in obj)
                        obj[o] = systemDictionary[obj[o]][userLang]
            }
        }
    });
    adapter.setObjectNotExists('control.spotclean', {
        type: 'state',
        common: {
            name: 'Spot Cleaning',
            type: 'boolean',
            role: 'button',
            read: false,
            write: true,
            desc: 'Start Spot Cleaning',
            smartName: 'Spot clean'
        },
        native: {}
    });
    adapter.setObjectNotExists('control.sound_volume_test', {
        type: 'state',
        common: {
            name: 'sound volume test',
            type: 'boolean',
            role: 'button',
            read: false,
            write: true,
            desc: 'let the speaker play sound'
        },
        native: {}
    });
    adapter.setObjectNotExists('control.sound_volume', {
        type: 'state',
        common: {
            name: 'sound volume',
            type: 'number',
            role: 'level',
            read: true,
            write: true,
            unit: '%',
            min: 30,
            max: 100,
            desc: 'Sound volume of the Robot'
        },
        native: {}
    });

    adapter.setObjectNotExists('info.wifi_signal', {
        type: 'state',
        common: {
            name: 'Wifi RSSI',
            type: 'number',
            role: 'level',
            read: true,
            write: false,
            unit: 'dBm',
            desc: 'Wifi signal of the  vacuum'
        },
        native: {}
    });

    adapter.setObjectNotExists('info.device_model', {
        type: 'state',
        common: {
            name: 'device model',
            type: 'string',
            read: true,
            write: false,
            desc: 'model of vacuum',
        },
        native: {}
    });
    adapter.setObjectNotExists('info.device_fw', {
        type: 'state',
        common: {
            name: 'Firmware',
            type: 'string',
            read: true,
            write: false,
            desc: 'Firmware of vacuum',
        },
        native: {}
    });
    adapter.setObjectNotExists('info.queue', {
        type: 'state',
        common: {
            name: 'Cleaning Queue',
            type: 'number',
            role: 'info',
            read: true,
            write: false
        },
        "native": {}
    }, function () {
        adapter.setState('info.queue', 0, true);
    })
}


function checkSetTimeDiff() {
    const now = parseInt(new Date().getTime() / 1000, 10); // Math.round(parseInt((new Date().getTime())) / 1000); //.toString(16)
    const messageTime = parseInt(packet.stamprec.toString('hex'), 16);
    packet.timediff = (messageTime - now) === -1 ? 0 : (messageTime - now); // may be (messageTime < now) ? 0...

    if (firstSet && packet.timediff !== 0) {
        adapter.log.warn('Time difference between Mihome Vacuum and ioBroker: ' + packet.timediff + ' sec');
    }

    if (firstSet) {
        firstSet = false;
    }
}

function main() {
    adapter.setState('info.connection', false, true);
    adapter.config.port = parseInt(adapter.config.port, 10) || 54321;
    adapter.config.ownPort = parseInt(adapter.config.ownPort, 10) || 53421;
    adapter.config.pingInterval = parseInt(adapter.config.pingInterval, 10) || 20000;
    adapter.config.param_pingInterval = parseInt(adapter.config.param_pingInterval, 10) || 60000;
    //adapter.log.info(JSON.stringify(adapter.config));

    init();
    Map = new maphelper(null, adapter);
    MAP.Init(); // for Map

    // Abfrageintervall mindestens 10 sec.
    if (adapter.config.param_pingInterval < 10000) {
        adapter.config.param_pingInterval = 10000;
    }


    if (!adapter.config.token) {
        adapter.log.error('Token not specified!');
        //return;
    } else {
        enabledExpert();
        enabledVoiceControl();




        packet = new MiHome.Packet(str2hex(adapter.config.token), adapter);

        packet.msgCounter = 1;

        commands = {
            ping: str2hex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
        };

        server.on('error', function (err) {
            adapter.log.error('UDP error: ' + err);
            server.close();
            process.exit();
        });


        server.on('message', function (msg, rinfo) {
            if (rinfo.port === adapter.config.port) {
                if (msg.length === 32) {
                    adapter.log.debug('Receive <<< Helo <<< ' + msg.toString('hex'));
                    packet.setRaw(msg);
                    isConnect = true;
                    checkSetTimeDiff();

                    clearTimeout(pingTimeout);
                    pingTimeout = null;
                    if (!connected) {
                        connected = true;
                        adapter.log.debug('Connected');
                        adapter.setState('info.connection', true, true);
                        sendMsg(com.get_status.method);
                        requestParams();
                    }

                } else {

                    //hier die Antwort zum decodieren
                    packet.setRaw(msg);
                    adapter.log.silly('Receive <<< ' + packet.getPlainData());
                    getStates(packet.getPlainData());
                }
            }
        });

        server.on('listening', function () {
            const address = server.address();
            adapter.log.debug('server started on ' + address.address + ':' + address.port);
        });

        try {
            server.bind(adapter.config.ownPort);
        } catch (e) {
            adapter.log.error('Cannot open UDP port: ' + e);
            return;
        }

        features.init()

        sendPing();
        paramPingInterval = setInterval(requestParams, adapter.config.param_pingInterval);

        adapter.subscribeStates('*');
        //adapter.subscribeObjects('rooms.*')

    }

}

const sendCommandCallbacks = {
    /* "counter": callback() */
};

/** Returns the only array element in a response */
function returnSingleResult(resp) {
    return resp.result[0];
}

adapter.on('message', function (obj) {
    // responds to the adapter that sent the original message
    function respond(response) {
        if (obj.callback) adapter.sendTo(obj.from, obj.command, response, obj.callback);
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
        if (!(params && params.length)) return true;
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
        // remember message id
        const id = packet.msgCounter;
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
        // send msg to the robo
        sendMsg(method, params, {
            rememberPacket: false
        }, err => {
            // on error, respond immediately
            if (err) respond({
                error: err
            });
            // else wait for the callback
        });
    }

    // handle the message
    if (obj) {
        let params;

        switch (obj.command) {
            case 'discovery':
                //adapter.log.info('discover' + JSON.stringify(obj))
                Map.getDeviceStatus(obj.message.username, obj.message.password, obj.message.server, '{"getVirtualModel":false,"getHuamiDevices":0}').then(function (data) {
                        adapter.log.debug('discover__' + JSON.stringify(data));
                        respond(data)

                    })
                    .catch(function (err) {
                        adapter.log.info('discover ' + err)
                        respond({
                            error: err
                        })
                    })
                return;
                // call this with 
                // sendTo('mihome-vacuum.0', 'sendCustomCommand',
                //     {method: 'method_id', params: [...] /* optional*/},
                //     callback
                // );
            case 'sendCustomCommand':
                // require the method to be given
                if (!requireParams(['method'])) return;
                // params is optional

                params = obj.message;
                sendCustomCommand(params.method, params.params);
                return;

                // ======================================================================
                // support for the commands mentioned here:
                // https://github.com/MeisterTR/XiaomiRobotVacuumProtocol#vaccum-commands

                // cleaning commands
            case 'startVacuuming':
                sendCustomCommand('app_start');
                return;
            case 'stopVacuuming':
                sendCustomCommand('app_stop');
                return;
            case 'cleanSpot':
                sendCustomCommand('app_spot');
                return;
            case 'cleanZone':
                if (!obj.message) return adapter.log.warn("cleanZone needs paramter coordinates")
                if (cleaning.isActive) {
                    adapter.log.info("should trigger cleaning zone " + obj.message + ", but is currently active. Add to queue")
                    cleaning.push(obj)
                } else {
                    cleaning.isActive = cleanStatus_ZoneCleaning;
                    adapter.log.info("trigger cleaning zone " + obj.message)
                    sendCustomCommand('app_zoned_clean', [obj.message])
                }
                return;
            case 'cleanSegments':
                if (!obj.message) return adapter.log.warn("cleanSegments needs paramter mapIndex")
                if (cleaning.isActive) {
                    adapter.log.info("should trigger cleaning segment " + obj.message + ", but is currently active. Add to queue")
                    cleaning.push(obj)
                } else {
                    cleaning.isActive = cleanStatus_RoomCleaning;
                    adapter.log.info("trigger cleaning segment " + obj.message)
                    let map = obj.message
                    if (!isNaN(map))
                        map = [parseInt(map, 10)]
                    else {
                        if (typeof map == "string")
                            map = obj.message.split(",")
                        for (let i in map) {
                            map[i] = parseInt(map[i], 10);
                            if (isNaN(map[i]))
                                delete map[i];
                        }
                    }
                    sendCustomCommand('app_segment_clean', map)
                }
                return;
            case 'cleanRooms':
                let rooms = obj.message // comma separated String with enum.rooms.XXX
                if (!rooms) return adapter.log.warn("cleanRooms needs paramter ioBroker room-id's")
                roomManager.findMapIndexByRoom(rooms, roomManager.cleanRooms)
                return;
            case 'pause':
                sendCustomCommand('app_pause');
                return;
            case 'charge':
                sendCustomCommand('app_charge');
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
                sendCustomCommand('reset_consumable');
                return;

                // get info about cleanups
            case 'getCleaningSummary':
                sendCustomCommand('get_clean_summary', parseCleaningSummary);
                return;
            case 'getCleaningRecord':
                // require the record id to be given
                if (!requireParams(['recordId'])) return;
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
                sendCustomCommand('get_serial_number', function (resp) {
                    return resp.result[0].serial_number;
                });
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
                if (!requireParams(['startHour', 'startMinute', 'endHour', 'endMinute'])) return;
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
                if (!requireParams(['fanSpeed'])) return;
                sendCustomCommand('set_custom_mode', [obj.message.fanSpeed]);
                return;

                // Remote controls
            case 'startRemoteControl':
                sendCustomCommand('app_rc_start');
                return;
            case 'stopRemoteControl':
                sendCustomCommand('app_rc_end');
                return;
            case 'move':
                // require all params to be given
                if (!requireParams(['velocity', 'angularVelocity', 'duration', 'sequenceNumber'])) return;
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
});


//------------------------------------------------------MAP Section
MAP.Init = function () {
    this.retries = 0
    this.mappointer = ""
    this.LASTMAPSAVE = Date.now();
    this.GETMAP = false;
    this.ENABLED = adapter.config.enableMiMap || adapter.config.valetudo_enable;
    // MAP initial
    this.MAPSAFEINTERVALL = parseInt(adapter.config.valetudo_MapsaveIntervall, 10) || 5000;
    this.POLLMAPINTERVALL = parseInt(adapter.config.valetudo_requestIntervall, 10) || 2000;
    this.ready = {
        login: false,
        mappointer: false
    }

    this.firstMap = true;

    if ((adapter.config.enableMiMap || adapter.config.valetudo_enable)) {
        adapter.setObjectNotExists('map.map64', {
            type: 'state',
            common: {
                name: 'Map64',
                type: 'string',
                read: true,
                write: false,
                desc: 'Map in a decoded Base64 PNG',
            },
            native: {}
        });
        adapter.setObjectNotExists('map.mapURL', {
            type: 'state',
            common: {
                name: 'MapURL',
                type: 'string',
                read: true,
                write: false,
                desc: 'Path to actual PNG File',
            },
            native: {}
        });

        if (adapter.config.enableMiMap) {
            Map.login().then(function (anser) {
                reqParams.push('get_map_v1');
                MAP.ready.login = true;
            }).catch(error => {
                adapter.log.warn(error);
            })
        } else if (adapter.config.valetudo_enable) {
            this._MapPoll()
        }

    }
}
MAP.updateMapPointer = function (answer) {
    let that = this;
    if (answer.split('%').length === 1) {
        setTimeout(function () {
            sendMsg('get_map_v1')
            adapter.log.debug('Mappointer_nomap___' + answer)
        }, 500)
        return
    } else if (answer.split('%').length === 3) {
        that.mappointer = answer;
        adapter.log.debug('Mappointer_updated')
        that.ready.mappointer = true;
        if (that.firstMap) {
            that.firstMap = false;
            that._MapPoll() // for auth at server;

        }

    }
}

MAP.getRoomsFromMap = function (answer) {
    let that = this;
    if (!adapter.config.enableMiMap) {
        return
    }
    adapter.log.debug('get rooms from map')
    if ((!that.ready.mappointer || !that.ready.login) && adapter.config.enableMiMap) {
        adapter.log.debug('get rooms from map pending...')
        setTimeout(() => {
            sendMsg('get_room_mapping');
        }, 20000)
        return
    }

    Map.updateMap(that.mappointer).then(function (data) {
            adapter.log.debug('get rooms from map data: ' + JSON.stringify(data[1]))
            let roomsarray = data[1]
            let roomids = []

            if (typeof (roomsarray) === 'undefined' || roomsarray.length === 0) return
 
            roomsarray.forEach(element => {
                roomids.push([element, 'room' + element])
            });

            answer.result = roomids
            roomManager.processRoomMaping(answer);
        })
        .catch(err => {})
}

MAP.StartMapPoll = function () {
    let that = this;
    if (!that.GETMAP && (adapter.config.enableMiMap || adapter.config.valetudo_enable)) {
        that.GETMAP = true;
        that._MapPoll();
    }
}

MAP._MapPoll = function () {
    let that = this;

    if ((!that.ready.mappointer || !that.ready.login) && adapter.config.enableMiMap) return

    Map.updateMap(that.mappointer).then(function (data) {
            let dataurl = data[0].toDataURL();

            adapter.setState('map.map64', '<img src="' + dataurl + '" /style="width: auto ;height: 100%;">', true);

            if (Date.now() - that.LASTMAPSAVE > that.MAPSAFEINTERVALL) {
                var buf = data[0].toBuffer();
                adapter.writeFile('mihome-vacuum.admin', 'actualMap.png', buf, function (error) {
                    if (error) {
                        adapter.log.error('Fehler beim Speichern der Karte');
                    } else {
                        adapter.setState('map.mapURL', "/mihome-vacuum.admin/actualMap.png", true);

                    }
                    that.LASTMAPSAVE = Date.now();
                })
            };

            if (that.GETMAP) {
                //adapter.log.info(VALETUDO.POLLMAPINTERVALL)
                setTimeout(function () {
                    sendMsg('get_map_v1');
                    that._MapPoll();
                }, that.POLLMAPINTERVALL);
            }


        })
        .catch(err => {
            adapter.log.error(err);
            if (that.GETMAP) setTimeout(function () {
                that._MapPoll();
            }, that.POLLMAPINTERVALL);
        })

}