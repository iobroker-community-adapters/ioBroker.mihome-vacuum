/* jshint -W097 */
/* jshint strict:false */
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils     = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter   = new utils.Adapter('mihome-vacuum');
var dgram     = require('dgram');
var MiHome    = require(__dirname + '/lib/mihomepacket');

var server    = dgram.createSocket('udp4');

var connected = false;
var commands  = {};
var pingInterval;
var message   = '';
var counter   = 9;
var packet;

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (!state || state.ack) return;

    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // output to parser
    var command = id.split('.').pop();

     if (command === 'fan_power') {
          sendCommand(commands['level'] + state.val + ']', function () {
              adapter.setForeignState(adapter.namespace + '.' + command, state.val, true);
          });
    } else
    if (commands[command]) {
        sendCommand(commands[command], function () {
            adapter.setForeignState(id, false, true);
        });
    } else {
        if (commands[command] === undefined) {
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
    if (typeof callback === 'function') callback();
});


adapter.on('ready', main);

var pingTimeout = null;

function sendPing() {
    pingTimeout = setTimeout(function () {
        pingTimeout = null;
        if (connected) {
            connected = false;
            adapter.log.info('Disconnect');
            adapter.setState('info.connection', false, true);
        }
    }, 3000);

    try {
        if (counter >= 10){
          counter = 0;
          packet.msgCounter = 1100;
          message = commands.get_consumable;
        } else{
          packet.msgCounter = 1000;
          message = commands.get_status;
          counter++;
        }
        server.send(commands.ping, 0, commands.ping.length, adapter.config.port, adapter.config.ip, function (err) {
            if (err) adapter.log.error('Cannot send ping: ' + err)
        });
    } catch (e) {
        adapter.log.warn('Cannot send ping: ' + e);
        clearTimeout(pingTimeout);
        pingTimeout = null;
        if (connected) {
            connected = false;
            adapter.log.info('Disconnect');
            adapter.setState('info.connection', false, true);
        }
    }

}

function str2hex(str) {
    str = str.replace(/\s/g, '');
    var buf = new Buffer(str.length / 2);

    for (var i = 0; i < str.length / 2; i++) {
        buf[i] = parseInt(str[i * 2] + str[i * 2 + 1], 16);
    }
    return buf;
}

function sendCommand(cmd, callback) {
    try {
        message = cmd;
        packet.setHelo();
        var cmdraw = packet.getRaw();
        adapter.log.info('Sende >>> Helo >>> ' + cmdraw.toString('hex'));
        server.send(cmdraw, 0, cmdraw.length, adapter.config.port, adapter.config.ip, function (err) {
            if (err) adapter.log.error('Cannot send command: ' + err);
            if (typeof callback === 'function') callback(err);
        });
    } catch (err) {
        adapter.log.warn('Cannot send command_: ' + err);
        if (typeof callback === 'function') callback(err);
    }
}
function getStates(message){
    //Search id in answer
    var answer = JSON.parse(message);
    answer.id = parseInt(answer.id, 10);
    //var ans= answer.result;
    //adapter.log.info(answer.result[0].state);
    //adapter.log.info(answer['id']);

    if (answer.id === 1000) {
    adapter.setState('info.battery', answer.result[0].battery , true);
    adapter.setState('info.cleanedtime', Math.round(answer.result[0].clean_time/60) , true);
    adapter.setState('info.cleanedarea', Math.round(answer.result[0].clean_area/10000)/100 , true);
    adapter.setState('control.fan_power', Math.round(answer.result[0].fan_power) , true);
    adapter.setState('info.state', answer.result[0].state , true);
    adapter.setState('info.error', answer.result[0].error_code , true);
    adapter.setState('info.dnd', answer.result[0].dnd_enabled , true)
    } else if (answer.id === 1100) {
    adapter.setState('info.consumable.main_brush', Math.round(answer.result[0].main_brush_work_time/3600/0.82) , true);
    adapter.setState('info.consumable.side_brush', Math.round(answer.result[0].side_brush_work_time/3600/0.94) , true);
    adapter.setState('info.consumable.filter', Math.round(answer.result[0].filter_work_time/3600/1.12) , true);
    }

    //return objresp;

}
function main() {
    adapter.setState('info.connection', false, true);
    adapter.config.port         = parseInt(adapter.config.port, 10)         || 54321;
    adapter.config.ownPort      = parseInt(adapter.config.ownPort, 10)      || 53421;
    adapter.config.pingInterval = parseInt(adapter.config.pingInterval, 10) || 20000;

    if (!adapter.config.token) {
        adapter.log.error('Token not specified!');
        return;
    }

    packet = new MiHome.Packet(str2hex(adapter.config.token));

    packet.msgCounter = 6430;

    commands = {
        ping:           str2hex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        start:          '"method":"app_start"',
        pause:          '"method":"app_pause"',
        home:           '"method":"app_charge"',
        find:           '"method":"find_me","params":[""]',
        get_status:     '"method":"get_status"',
        get_consumable: '"method":"get_consumable"',
        level:          '"method":"set_custom_mode","params":['
    };

    server.on('error', function (err) {
        adapter.log.error('UDP error: ' + err);
        server.close();
        process.exit();
    });

    server.on('message', function (msg, rinfo) {
        if (rinfo.port === adapter.config.port) {
            if (msg.length === 32) {
		        adapter.log.debug('Empfangen <<< Helo <<< ' + msg.toString('hex'));
                packet.setRaw(msg);
                clearTimeout(pingTimeout);
                pingTimeout = null;
                if (!connected) {
                    connected = true;
                    adapter.log.info('Connected');
                    adapter.setState('info.connection', true, true);
                }

                if (message.length > 0) {
                    try {
                        packet.setPlainData('{"id":' + packet.msgCounter + ',' + message + '}');
                        adapter.log.debug('{"id":' + packet.msgCounter  +',' + message + '}');
                        packet.msgCounter++;
                        var cmdraw = packet.getRaw();
                        adapter.log.debug('Sende >>> {"id":' + packet.msgCounter+',' + message + "} >>> " + cmdraw.toString('hex'));
                        adapter.log.debug(cmdraw.toString('hex'));
                        message="";
                        server.send(cmdraw, 0, cmdraw.length, adapter.config.port, adapter.config.ip, function (err) {
                            if (err) adapter.log.error('Cannot send command: ' + err);
                            if (typeof callback === 'function') callback(err);
                        });
                    } catch (err) {
                        adapter.log.warn('Cannot send command_: ' + err);
                        if (typeof callback === 'function') callback(err);
                    }
                }
            } else {
		        //hier die Antwort zum decodieren
                packet.setRaw(msg);
                adapter.log.debug('Empfangen <<< ' + packet.getPlainData() + "<<< " + msg.toString('hex'));
                //adapter.log.warn('server got: ' + msg.length + ' bytes from ' + rinfo.address + ':' + rinfo.port);
                getStates(packet.getPlainData());
            }
        }
    });

    server.on('listening', function () {
        var address = server.address();
        adapter.log.debug('server started on ' + address.address + ':' + address.port);
    });

    server.bind(adapter.config.ownPort);

    sendPing();
    pingInterval = setInterval(sendPing, adapter.config.pingInterval);
    adapter.subscribeStates('*');
}
