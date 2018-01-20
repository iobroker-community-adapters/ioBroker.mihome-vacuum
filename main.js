/* jshint -W097 */
/* jshint strict:false */
/* jslint node: true */
'use strict';



// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = new utils.Adapter('mihome-vacuum');
var dgram = require('dgram');
var MiHome = require(__dirname + '/lib/mihomepacket');
var com = require(__dirname + '/lib/comands');

var server = dgram.createSocket('udp4');

var device = {};
var isConnect = false;
var model = "";
var connected = false;
var commands = {};
var stateVal = 0;
var pingInterval, param_pingInterval;
var message = '';
var packet;
var firstSet = true;
var clean_log = [];
var clean_log_html_all_lines = "";
var clean_log_html_table = "";
var log_entrys = {},
    log_entrys_new = {};
var last_id = {
    get_status: 0,
    get_consumable: 0,
    get_clean_summary: 0,
    get_clean_record: 0,
    X_send_command: 0,
};

//Tabelleneigenschaften
var clean_log_html_attr = '<colgroup> <col width="50"> <col width="50"> <col width="80"> <col width="100"> <col width="50"> <col width="50"> </colgroup>';
var clean_log_html_head = "<tr> <th>Datum</th> <th>Start</th> <th>Saugzeit</th> <th>Fläche</th> <th>???</th> <th>Ende</th></tr>";

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (!state || state.ack) return;

    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // output to parser


    var command = id.split('.').pop();

    if (com[command]) {
        var params = com[command].params || "";
        if (state.val !== true && state.val !== "true") {
            params = state.val;
        }
        if (state.val !== false && state.val !== "false") {
            sendMsg(com[command].method, [params], function () {
                adapter.setForeignState(id, state.val, true);
            });
        }

    } else {

        // Send own commands
        if (command === "X_send_command") {
            var values = state.val.trim().split(";");
            var method = values[0];
            var params = {};
            last_id["X_send_command"] = packet.msgCounter;
            if (values[1]) {
                try {
                    params = JSON.parse(values[1]);
                } catch (e) {
                    adapter.log.warn('Could not send these params because its not in JSON format: ' + values[1]);
                } finally {

                }
                adapter.log.info('send message: Method: ' + values[0] + " Params: " + values[1]);
                sendMsg(values[0], params, function () {
                    adapter.setForeignState(id, state.val, true);
                });
            } else {
                adapter.log.info('send message: Method: ' + values[0]);
                sendMsg(values[0], [""], function () {
                    adapter.setForeignState(id, state.val, true);
                });

            }

        } else if (command === "clean_home") {
            stateControl(state.val);

        } else if (com[command] === undefined) {
            adapter.log.error('Unknown state "' + id + '"');
        } else {
            adapter.log.error('Command "' + command + '" is not configured');
        }
    }

});

adapter.on('unload', function (callback) {
    if (pingTimeout) clearTimeout(pingTimeout);
    adapter.setState('info.connection', false, true);
    if (pingInterval) clearInterval(pingInterval);
    if (param_pingInterval) clearInterval(param_pingInterval);
    if (typeof callback === 'function') callback();
});


adapter.on('ready', main);

var pingTimeout = null;

function sendPing() {

    pingTimeout = setTimeout(function () {
        pingTimeout = null;
        if (connected) {
            connected = false;
            adapter.log.debug('Disconnect');
            adapter.setState('info.connection', false, true);
        }
    }, 3000);

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
function stateControl(value) {
    if (value && stateVal !== 5) {
        sendMsg(com.start.method);
        setTimeout(function () {
            sendMsg(com.get_status.method);
        }, 2000);
    } else if (!value && stateVal == 5) {
        sendMsg(com.pause.method);
        setTimeout(function () {
            sendMsg(com.home.method);
        }, 1000);
    }
}

function requestParams() {
    if (connected) {
        adapter.log.debug("requesting params every: " + adapter.config.param_pingInterval / 1000 + " Sec");

        sendMsg(com.get_status.method);

        

        if (model === "") {
            sendMsg(com.miIO_info.method);
        }


        setTimeout(function () {
            sendMsg(com.get_consumable.method);
        }, 100);

        setTimeout(function () {
            sendMsg(com.clean_summary.method);
        }, 200);

        setTimeout(function () {
            sendMsg(com.get_sound_volume.method);
        }, 300);

        setTimeout(function () {
            if (!isEquivalent(log_entrys_new, log_entrys)) {
                log_entrys = log_entrys_new;
                clean_log = [];
                clean_log_html_all_lines = "";
                getLog(function () {
                    adapter.setState('history.allTableJSON', JSON.stringify(clean_log), true);
                    adapter.log.debug("CLEAN_LOGGING" + JSON.stringify(clean_log));
                    adapter.setState('history.allTableHTML', clean_log_html_table, true);
                });
            }
        }, 600);
    }
}


function sendMsg(method, params, options, callback) {

    // define optional options
    if (typeof options === "function") {
        callback = options;
        options = null;
    }
    // define default options
    options = options || {};
    if (options.rememberPacket == undefined) options.rememberPacket = true; // remember packets per default

    // remember packet if not explicitly forbidden
    // this is used to route the returned package to the sendTo callback
    if (options.rememberPacket) {
        last_id[method] = packet.msgCounter;
        adapter.log.debug('lastid' + JSON.stringify(last_id));
    }

    var message_str = buildMsg(method, params);

    try {
        var cmdraw = packet.getRaw_fast(message_str);

        server.send(cmdraw, 0, cmdraw.length, adapter.config.port, adapter.config.ip, function (err) {
            if (err) adapter.log.error('Cannot send command: ' + err);
            if (typeof callback === 'function') callback(err);
        });
        adapter.log.debug('sendMsg >>> ' + message_str);
        adapter.log.debug('sendMsgRaw >>> ' + cmdraw.toString('hex'));
    } catch (err) {
        adapter.log.warn('Cannot send message_: ' + err);
        if (typeof callback === 'function') callback(err);
    }
    packet.msgCounter++;
}


function buildMsg(method, params) {
    var message = {};
    if (method) {
        message.id = packet.msgCounter;
        message.method = method;
        if (!(params == "" || params == [""] || params == undefined)) {
            message.params = params;
        }
    } else {
        adapter.log.warn('Could not build message without arguments');
    }
    return JSON.stringify(message);
}



function str2hex(str) {
    str = str.replace(/\s/g, '');
    var buf = new Buffer(str.length / 2);

    for (var i = 0; i < str.length / 2; i++) {
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
    return response.result.map(function (entry) {
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

var statusTexts = {
    "0": "Unknown",
    "1": "Initiating",
    "2": "Sleeping",
    "3": "Waiting",
    "4": "?",
    "5": "Cleaning",
    "6": "Back to home",
    "7": "?",
    "8": "Charging",
    "9": "Charging Error",
    "10": "Pause",
    "11": "Spot Cleaning",
    "12": "In Error",
    "13": "Shutting down",
    "14": "Updating",
    "15": "Docking",
    "100": "Full"
};
// TODO: deduplicate from io-package.json
var errorTexts = {
    "0": "No error",
    "1": "Laser distance sensor error",
    "2": "Collision sensor error",
    "3": "Wheels on top of void, move robot",
    "4": "Clean hovering sensors, move robot",
    "5": "Clean main brush",
    "6": "Clean side brush",
    "7": "Main wheel stuck?",
    "8": "Device stuck, clean area",
    "9": "Dust collector missing",
    "10": "Clean filter",
    "11": "Stuck in magnetic barrier",
    "12": "Low battery",
    "13": "Charging fault",
    "14": "Battery fault",
    "15": "Wall sensors dirty, wipe them",
    "16": "Place me on flat surface",
    "17": "Side brushes problem, reboot me",
    "18": "Suction fan problem",
    "19": "Unpowered charging station",
};
/** Parses the answer to a get_status message */
function parseStatus(response) {
    response = response.result[0];
    return {
        battery: response.battery,
        clean_area: response.clean_area,
        clean_time: response.clean_time,
        dnd_enabled: response.dnd_enabled === 1,
        error_code: response.error_code,
        error_text: errorTexts[response.error_code],
        fan_power: response.fan_power,
        in_cleaning: response.in_cleaning === 1,
        map_present: response.map_present === 1,
        msg_seq: response.msg_seq,
        msg_ver: response.msg_ver,
        state: response.state,
        state_text: statusTexts[response.state],
    };
}

/** Parses the answer to a get_dnd_timer message */
function parseDNDTimer(response) {
    response = response.result[0];
    response.enabled = (response.enabled === 1);
    return response;
}

function getStates(message) {
    //Search id in answer
    clearTimeout(pingTimeout);
    pingTimeout = null;
    if (!connected) {
        connected = true;
        adapter.log.debug('Connected');
        adapter.setState('info.connection', true, true);
    }
    var answer = JSON.parse(message);
    answer.id = parseInt(answer.id, 10);
    //var ans= answer.result;
    //adapter.log.info(answer.result.length);
    //adapter.log.info(answer['id']);

    if (answer.id === last_id["get_status"]) {
        var status = parseStatus(answer);
        adapter.setState('info.battery', status.battery, true);
        adapter.setState('info.cleanedtime', Math.round(status.clean_time / 60), true);
        adapter.setState('info.cleanedarea', Math.round(status.clean_area / 10000) / 100, true);
        adapter.setState('control.fan_power', Math.round(status.fan_power), true);
        adapter.setState('info.state', status.state, true);
        stateVal = status.state;
        if (stateVal === 5 || stateVal === "5") {
            adapter.setState('control.clean_home', true, true);
        }
        else {
            adapter.setState('control.clean_home', false, true);
        }
        adapter.setState('info.error', status.error_code, true);
        adapter.setState('info.dnd', status.dnd_enabled, true)
    } else if (answer.id === last_id["miIO.info"]) {
        adapter.log.info("device" + JSON.stringify(answer.result));
        device = answer.result;
        adapter.setState('info.device_fw', answer.result.fw_ver, true);
        adapter.setState('info.device_model', answer.result.model, true);
        model = answer.result.model;

    } else if (answer.id === last_id["get_sound_volume"]) {
        adapter.setState('control.sound_volume', answer.result[0], true);
    
    } else if (answer.id === last_id["get_consumable"]) {

        adapter.setState('consumable.main_brush', 100 - (Math.round(answer.result[0].main_brush_work_time / 3600 / 3)), true);
        adapter.setState('consumable.side_brush', 100 - (Math.round(answer.result[0].side_brush_work_time / 3600 / 2)), true);
        adapter.setState('consumable.filter', 100 - (Math.round(answer.result[0].filter_work_time / 3600 / 1.5)), true);
        adapter.setState('consumable.sensors', 100 - (Math.round(answer.result[0].sensor_dirty_time / 3600 / 0.3)), true);
    } else if (answer.id === last_id["get_clean_summary"]) {
        var summary = parseCleaningSummary(answer);
        adapter.setState('history.total_time', Math.round(summary.clean_time / 60), true);
        adapter.setState('history.total_area', Math.round(summary.total_area / 1000000), true);
        adapter.setState('history.total_cleanups', summary.num_cleanups, true);
        log_entrys_new = summary.cleaning_record_ids;
        //adapter.log.info("log_entrya" + JSON.stringify(log_entrys_new));
        //adapter.log.info("log_entry old" + JSON.stringify(log_entrys));


    } else if (answer.id === last_id["X_send_command"]) {
        adapter.setState('control.X_get_response', JSON.stringify(answer.result), true);

    } else if (answer.id === last_id["get_clean_record"]) {
        var records = parseCleaningRecords(answer);
        for (var j = 0; j < records.length; j++) {
            var record = records[j];

            var dates = new Date();
            var hour = "",
                min = "";
            dates.setTime(record.start_time * 1000);
            if (dates.getHours() < 10) {
                hour = "0" + dates.getHours();
            } else {
                hour = dates.getHours();
            }
            if (dates.getMinutes() < 10) {
                min = "0" + dates.getMinutes();
            } else {
                min = dates.getMinutes();
            }

            var log_data = {
                "Datum": dates.getDate() + "." + (dates.getMonth() + 1),
                "Start": hour + ":" + min,
                "Saugzeit": Math.round(record.duration / 60) + " min",
                "Fläche": Math.round(record.area / 10000) / 100 + " m²",
                "Error": record.errors,
                "Ende": record.completed
            };


            clean_log.push(log_data);
            clean_log_html_table = makeTable(log_data);


        }

    } else if (answer.id in sendCommandCallbacks) {

        // invoke the callback from the sendTo handler
        var callback = sendCommandCallbacks[answer.id];
        if (typeof callback === "function") callback(answer);
    }
}


function getLog(callback) {

    var i = 0;

    function f() {

        if (log_entrys[i] != null || log_entrys[i] != "null") {
            sendMsg("get_clean_record", [log_entrys[i]], callback);
            adapter.log.debug("Request log entry: " + log_entrys[i]);

        } else {
            adapter.log.error("Could not find log entry");
        }
        i++;
        if (i < log_entrys.length) {
            setTimeout(f, 500);
        }
    }
    f();
}


function isEquivalent(a, b) {
    // Create arrays of property names
    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    // If number of properties is different,
    // objects are not equivalent
    if (aProps.length != bProps.length) {
        return false;
    }

    for (var i = 0; i < aProps.length; i++) {
        var propName = aProps[i];

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
    var head = clean_log_html_head;
    var table = "";
    var html_line = "<tr>";

    html_line += "<td>" + line.Datum + "</td>" + "<td>" + line.Start + "</td>" + '<td ALIGN="RIGHT">' + line.Saugzeit + "</td>" + '<td ALIGN="RIGHT">' + line.Fläche + "</td>" + '<td ALIGN="CENTER">' + line.Error + "</td>" + '<td ALIGN="CENTER">' + line.Ende + "</td>";

    html_line += "</tr>";

    clean_log_html_all_lines += html_line;

    table = "<table>" + clean_log_html_attr + clean_log_html_head + clean_log_html_all_lines + "</table>";

    return table;

}

function enabledExpert() {
    if (adapter.config.enableSelfCommands) {
        adapter.log.info('Expert mode enabled, states created');
        adapter.setObjectNotExists('control.X_send_command', {
            type: 'state',
            common: {
                name: "send command",
                type: "string",
                read: true,
                write: true,
            },
            native: {}
        });
        adapter.setObjectNotExists('control.X_get_response', {
            type: 'state',
            common: {
                name: "get response",
                type: "string",
                read: true,
                write: false,
            },
            native: {}
        });


    } else {
        adapter.log.info('Expert mode disabled, states deleded');
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
                name: "Start/Home",
                type: "boolean",
                role: "state",
                read: true,
                write: true,
                desc: "Start and go home",
                smartName: "Staubsauger"
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
    adapter.setObjectNotExists('control.spotclean', {
        type: 'state',
        common: {
            name: "Spot Cleaning",
            type: "boolean",
            role: "button",
            read: true,
            write: true,
            desc: "Start Spot Cleaning",
            smartName: "Spot clean"
        },
        native: {}
    });
    adapter.setObjectNotExists('control.sound_volume_test', {
        type: 'state',
        common: {
            name: "sound volume test",
            type: "boolean",
            role: "button",
            read: true,
            write: true,
            desc: "let the speaker play sound"
        },
        native: {}
    });
    adapter.setObjectNotExists('control.sound_volume', {
        type: 'state',
        common: {
            name: "sound volume",
            type: "number",
            role: "level",
            read: true,
            write: true,
            unit: "%",
            min: 30,
            max: 100,
            desc: "Sound volume of the Robot"
        },
        native: {}
    });

    adapter.setObjectNotExists('info.device_model', {
        type: 'state',
        common: {
            name: "device model",
            type: "string",
            read: true,
            write: false,
            desc: "model of vacuum",
        },
        native: {}
    });
    adapter.setObjectNotExists('info.device_fw', {
        type: 'state',
        common: {
            name: "Firmware",
            type: "string",
            read: true,
            write: false,
            desc: "Firmware of vacuum",
        },
        native: {}
    });

    // States for Rockrobo S5 (second Generation)


}

function checkSetTimeDiff() {
    var now = Math.round(parseInt((new Date().getTime())) / 1000);//.toString(16)
    var MessageTime = parseInt(packet.stamprec.toString('hex'), 16);
    packet.timediff = (MessageTime - now) == -1 ? 0 : (MessageTime - now);

    if (firstSet && packet.timediff !== 0) adapter.log.warn('Time difference between Mihome Vacuum and ioBroker: ' + packet.timediff + ' sec');

    if (firstSet) firstSet = false;
}

function main() {
    adapter.setState('info.connection', false, true);
    adapter.config.port = parseInt(adapter.config.port, 10) || 54321;
    adapter.config.ownPort = parseInt(adapter.config.ownPort, 10) || 53421;
    adapter.config.pingInterval = parseInt(adapter.config.pingInterval, 10) || 20000;
    adapter.config.param_pingInterval = parseInt(adapter.config.param_pingInterval, 10) || 10000;

    adapter.config.param_pingInterval = 10000;
    init();

    // Abfrageintervall mindestens 10 sec.
    //if (adapter.config.param_pingInterval < 10000) {
    //  adapter.config.param_pingInterval = 10000;
    //}


    if (!adapter.config.token) {
        adapter.log.error('Token not specified!');
        //return;
    }
    else {
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
                        requestParams();
                    }

                } else {

                    //hier die Antwort zum decodieren
                    packet.setRaw(msg);
                    adapter.log.debug('Receive <<< ' + packet.getPlainData() + "<<< " + msg.toString('hex'));
                    getStates(packet.getPlainData());
                }
            }
        });

        server.on('listening', function () {
            var address = server.address();
            adapter.log.debug('server started on ' + address.address + ':' + address.port);
        });

        try {
            server.bind(adapter.config.ownPort);
        } catch (e) {
            adapter.log.error('Cannot open UDP port: ' + e);
            return;
        }

        sendPing();
        pingInterval = setInterval(sendPing, adapter.config.pingInterval);
        param_pingInterval = setInterval(requestParams, adapter.config.param_pingInterval);
   
        adapter.subscribeStates('*');


    }

}

var sendCommandCallbacks = {/* "counter": callback() */ };
adapter.on("message", function (obj) {
    // responds to the adapter that sent the original message
    function respond(response) {
        if (obj.callback) adapter.sendTo(obj.from, obj.command, response, obj.callback);
    }
    // some predefined responses so we only have to define them once
    var predefinedResponses = {
        ACK: { error: null },
        OK: { error: null, result: "ok" },
        ERROR_UNKNOWN_COMMAND: { error: "Unknown command!" },
        MISSING_PARAMETER: function (paramName) {
            return { error: 'missing parameter "' + paramName + '"!' };
        }
    };
    // make required parameters easier
    function requireParams(params /*: string[] */) {
        if (!(params && params.length)) return true;
        for (var i = 0; i < params.length; i++) {
            var param = params[i];
            if (!(obj.message && obj.message.hasOwnProperty(param))) {
                respond(predefinedResponses.MISSING_PARAMETER(param));
                return false;
            }
        }
        return true;
    }

    function sendCustomCommand(
        method /*: string */,
        params /*: (optional) string[] */,
        parser /*: (optional) (object) => object */
    ) {
        // parse arguments
        if (typeof params === "function") {
            parser = params;
            params = null;
        }
        if (parser != null && typeof parser !== "function") {
            throw new Error("Parser must be a function");
        }
        // remember message id
        var id = packet.msgCounter;
        // create callback to be called later
        sendCommandCallbacks[id] = function (response) {
            if (parser != null) {
                // optionally transform the result
                response = parser(response);
            } else {
                // in any case, only return the result
                response = response.result;
            }
            // now respond with the result
            respond({ error: null, result: response });
            // remove the callback from the dict
            if (sendCommandCallbacks[id] != null) delete sendCommandCallbacks[id];
        };
        // send msg to the robo
        sendMsg(method, params, { rememberPacket: false }, function (err) {
            // on error, respond immediately
            if (err) respond({ error: err });
            // else wait for the callback
        });
    }

    /** Returns the only array element in a response */
    function returnSingleResult(resp) {
        return resp.result[0];
    }

    // handle the message
    if (obj) {
        switch (obj.command) {
            // call this with 
            // sendTo("mihome-vacuum.0", "sendCustomCommand", 
            //     {method: "method_id", params: [...] /* optional*/}, 
            //     callback
            // );
            case "sendCustomCommand":
                // require the method to be given
                if (!requireParams(["method"])) return;
                // params is optional

                var params = obj.message;
                sendCustomCommand(params.method, params.params);
                return;

            // ======================================================================
            // support for the commands mentioned here:
            // https://github.com/MeisterTR/XiaomiRobotVacuumProtocol#vaccum-commands

            // cleaning commands
            case "startVacuuming":
                sendCustomCommand("app_start");
                return;
            case "stopVacuuming":
                sendCustomCommand("app_stop");
                return;
            case "cleanSpot":
                sendCustomCommand("app_spot");
                return;
            case "pause":
                sendCustomCommand("app_pause");
                return;
            case "charge":
                sendCustomCommand("app_charge");
                return;

            // TODO: What does this do?
            case "findMe":
                sendCustomCommand("find_me");
                return;

            // get info about the consumables
            // TODO: parse the results
            case "getConsumableStatus":
                sendCustomCommand("get_consumable", returnSingleResult);
                return;
            case "resetConsumables":
                sendCustomCommand("reset_consumable");
                return;

            // get info about cleanups
            case "getCleaningSummary":
                sendCustomCommand("get_clean_summary", parseCleaningSummary);
                return;
            case "getCleaningRecord":
                // require the record id to be given
                if (!requireParams(["recordId"])) return;
                // TODO: can we do multiple at once?
                sendCustomCommand("get_clean_record", [obj.message.recordId], parseCleaningRecords);
                return;

            // TODO: find out how this works
            // case "getCleaningRecordMap":
            //     sendCustomCommand("get_clean_record_map");
            case "getMap":
                sendCustomCommand("get_map_v1");
                return;

            // Basic information
            case "getStatus":
                sendCustomCommand("get_status", parseStatus);
                return;
            case "getSerialNumber":
                sendCustomCommand("get_serial_number", function (resp) { return resp.result[0].serial_number; });
                return;
            case "getDeviceDetails":
                sendCustomCommand("miIO.info");
                return;

            // Do not disturb
            case "getDNDTimer":
                sendCustomCommand("get_dnd_timer", returnSingleResult);
                return;
            case "setDNDTimer":
                // require start and end time to be given
                if (!requireParams(["startHour", "startMinute", "endHour", "endMinute"])) return;
                var params = obj.message;
                sendCustomCommand("set_dnd_timer", [params.startHour, params.startMinute, params.endHour, params.endMinute]);
                return;
            case "deleteDNDTimer":
                sendCustomCommand("close_dnd_timer");
                return;

            // Fan speed
            case "getFanSpeed":
                // require start and end time to be given
                sendCustomCommand("get_custom_mode", returnSingleResult);
                return;
            case "setFanSpeed":
                // require start and end time to be given
                if (!requireParams(["fanSpeed"])) return;
                sendCustomCommand("set_custom_mode", [obj.message.fanSpeed]);
                return;

            // Remote controls
            case "startRemoteControl":
                sendCustomCommand("app_rc_start");
                return;
            case "stopRemoteControl":
                sendCustomCommand("app_rc_end");
                return;
            case "move":
                // require all params to be given
                if (!requireParams(["velocity", "angularVelocity", "duration", "sequenceNumber"])) return;
                // TODO: Constrain the params
                var params = obj.message;
                // TODO: can we issue multiple commands at once?
                var args = [{
                    "omega": params.angularVelocity,
                    "velocity": params.velocity,
                    "seqnum": params.sequenceNumber, // <- TODO: make this automatic
                    "duration": params.duration
                }];
                sendCustomCommand("app_rc_move", [args]);
                return;


            // ======================================================================

            default:
                respond(predefinedResponses.ERROR_UNKNOWN_COMMAND);
                return;
        }
    }
});