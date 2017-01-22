/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
var utils     = require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter   = new utils.Adapter('mihome-vacuum');
var dgram     = require('dgram');
var server    = dgram.createSocket('udp4');
var connected = false;
var commands  = {};
var pingInterval;

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (!state || state.ack) return;

    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // output to parser
    var command = id.split('.').pop();

    if (command === 'state') {
        if (state.val === 'true' || state.val === true || state.val === '1' || state.val === 1) {
            if (commands.start) {
                sendCommand(commands.start, function () {
                    adapter.setForeignState(adapter.namespace + '.state', true, true);
                });
            } else {
                adapter.log.warn('Command start is not configured')
            }
        } else {
            if (commands.pause) {
                sendCommand(commands.pause, function () {
                    adapter.setForeignState(adapter.namespace + '.state', false, true);
                });
            } else {
                adapter.log.warn('Command pause is not configured')
            }
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

    server.send(commands.ping, adapter.config.port, adapter.config.ip, function (err) {
        if (err) adapter.log.error('Cannot send ping: ' + err)
    });
}

function str2hex(str) {
    var buf = new Buffer(str.length / 2);

    for (var i = 0; i < str.length / 2; i++) {
        buf[i] = parseInt(str[i * 2] + str[i* 2 + 1], 16);
    }
    return buf;
}

function sendCommand(cmd, callback) {
    server.send(cmd, adapter.config.port, adapter.config.ip, function (err) {
        if (err) adapter.log.error('Cannot send command: ' + err);
        if (typeof callback === 'function') callback(err);
    });
}

function main() {
    adapter.setState('info.connection', false, true);
    adapter.config.port         = parseInt(adapter.config.port, 10)         || 54321;
    adapter.config.ownPort      = parseInt(adapter.config.ownPort, 10)      || 56363;
    adapter.config.pingInterval = parseInt(adapter.config.pingInterval, 10) || 20000;
    commands = {
        ping:   str2hex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        start:  adapter.config.start ? str2hex(adapter.config.start) : '',
        pause:  adapter.config.pause ? str2hex(adapter.config.pause) : '',
        home:   adapter.config.home  ? str2hex(adapter.config.home)  : '',
        find:   adapter.config.find  ? str2hex(adapter.config.find)  : ''
    };

    server.on('error', function (err) {
        adapter.log.error('UDP error: ' + err);
        server.close();
        process.exit();
    });

    server.on('message', function (msg, rinfo) {
        if (rinfo.port === adapter.config.port) {
            if (msg.length === commands.ping.length) {
                clearTimeout(pingTimeout);
                pingTimeout = null;
                if (!connected) {
                    connected = true;
                    adapter.log.info('Connected');
                    adapter.setState('info.connection', true, true);
                }
            }
        } else {
            adapter.log.debug('server got: ' + msg.length + ' bytes from ' + rinfo.address + ':' + rinfo.port);
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