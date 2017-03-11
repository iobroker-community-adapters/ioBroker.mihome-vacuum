/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils     = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter   = new utils.Adapter('mihome-vacuum');
var dgram     = require('dgram');
var miHome    = require("./mihomepacket");

var server    = dgram.createSocket('udp4');

var connected = false;
var commands  = {};
var pingInterval;
var message = "";

var packet = new miHome.Packet();

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (!state || state.ack) return;

    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // output to parser
    var command = id.split('.').pop();

    if (command === 'level') {
        state.val = parseInt(state.val, 10);
        if (state.val < 1)  state.val = 1;
        if (state.val > 3)  state.val = 3;
        if (commands['level' + state.val]) {
            sendCommand(commands['level' + state.val], function () {
                adapter.setForeignState(adapter.namespace + '.level', state.val, true);
            });
        } else {
            adapter.log.warn('Command level' + state.val + ' is not configured');
        }
    } else
    if (command === 'state') {
        if (state.val === 'true' || state.val === true || state.val === '1' || state.val === 1) {
            sendCommand(commands['start'], function () {
                adapter.setForeignState(adapter.namespace + '.state', true, true);
            });
        } else {
            sendCommand(commands['pause'], function () {
                adapter.setForeignState(adapter.namespace + '.state', false, true);
            });
        }
    } else
    if (commands[command]) {
        sendCommand(commands[command], function () {
            if (command === 'home') {
                adapter.setForeignState(adapter.namespace + '.state', false, true);
            }
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
    //if (server && server.connected()) server.close();
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
        buf[i] = parseInt(str[i * 2] + str[i* 2 + 1], 16);
    }
    return buf;
}

function sendCommand(cmd, callback) {
    try {
        message=cmd;
        packet.setHelo();
        var cmdraw=packet.getRaw()
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

function main() {
    adapter.setState('info.connection', false, true);
    adapter.config.port         = parseInt(adapter.config.port, 10)         || 54321;
    adapter.config.ownPort      = parseInt(adapter.config.ownPort, 10)      || 56363;
    adapter.config.pingInterval = parseInt(adapter.config.pingInterval, 10) || 20000;


/*    packet.setToken(Buffer("34665248426447753954473346777549",'hex'));
    var cxx="2131005000000000034c85dd58a48d020a8231f7212fea5ba29f37f1155decfb3071ecdf47a0c825393e6e111d9249d70943fe63c31e85c52bffd21f94d63de5eb963da40410183894c2cff7e4205ed7";    
    packet.setRaw(Buffer(cxx,'hex'));
    var xxx =packet.getPlainData();
    packet.setPlainData(xxx);
    var cx2 = packet.getRaw().toString('hex');  
    adapter.log.info("Decode$$$: "+packet.getPlainData());
    adapter.log.info(cxx);
    adapter.log.info(cx2);
*/

    packet.setToken(Buffer(adapter.config.token,'hex'));
    packet.msgCounter=6430;
    commands = {
        ping:   str2hex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        //start:  '"method":"set_power","params":["on"]',
        //pause:  '"method":"set_power","params":["off"]',
        start:  '"method":"app_start"',
        pause:  '"method":"app_pause"',
        home:   '"method":"app_charge"',
        find:   '"method":"find_me","params":[""]',
        level1: '"method":"set_custom_mode","params":[38]',
        level2: '"method":"set_custom_mode","params":[60]',
        level3: '"method":"set_custom_mode","params":[77]'
    };

    server.on('error', function (err) {
        adapter.log.error('UDP error: ' + err);
        server.close();
        process.exit();
    });

    server.on('message', function (msg, rinfo) {
        if (rinfo.port === adapter.config.port) {
            if (msg.length === 32) {
		adapter.log.info('Empfangen <<< Helo <<< ' + msg.toString('hex'));
                packet.setRaw(msg);
                clearTimeout(pingTimeout);
                pingTimeout = null;
                if (!connected) {
                    connected = true;
                    adapter.log.info('Connected');
                    adapter.setState('info.connection', true, true);
                }

                if (message.length>0) {
                    try {
                        packet.setPlainData('{"id":'+packet.msgCounter+','+message+'}');
                        packet.msgCounter++;
                        var cmdraw=packet.getRaw();
                        adapter.log.info('Sende >>> {"id":'+packet.msgCounter+','+message+'}');
                        adapter.log.info(">>> "+cmdraw.toString('hex'));
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
                adapter.log.info('Empfangen <<< '+packet.getPlainData());
                adapter.log.info("<<< "+msg.toString('hex'));
                //adapter.log.warn('server got: ' + msg.length + ' bytes from ' + rinfo.address + ':' + rinfo.port);
            }
        }
    });

    server.on('listening', function () {
        var address = server.address();
        adapter.log.debug('server started on ' + address.address + ':' + address.port);
    });

    sendPing();
    pingInterval = setInterval(sendPing, adapter.config.pingInterval);
    adapter.subscribeStates('*');
}
