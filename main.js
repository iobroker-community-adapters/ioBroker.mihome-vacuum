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

var connected = false;
var commands = {};
var stateVal= 0;
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
adapter.on('stateChange', function(id, state) {
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
      sendMsg(com[command].method, [params], function() {
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
          adapter.log.warn('Cold not send this Params because its not a JSON Format: ' + values[1]);
        } finally {

        }
        adapter.log.info('send Message: Method: ' + values[0] + " Params: " + values[1]);
        sendMsg(values[0], params, function() {
          adapter.setForeignState(id, state.val, true);
        });
      } else {
        adapter.log.info('send Message: Method: ' + values[0]);
        sendMsg(values[0], [""], function() {
          adapter.setForeignState(id, state.val, true);
        });

      }

    }else if (command === "clean_home") {
          stateControl(state.val);

    }else if (com[command] === undefined) {
      adapter.log.error('Unknown state "' + id + '"');
    } else {
      adapter.log.error('Command "' + command + '" is not configured');
    }
  }

});

adapter.on('unload', function(callback) {
  if (pingTimeout) clearTimeout(pingTimeout);
  adapter.setState('info.connection', false, true);
  if (pingInterval) clearInterval(pingInterval);
  if (param_pingInterval) clearInterval(param_pingInterval);
  if (typeof callback === 'function') callback();
});


adapter.on('ready', main);

var pingTimeout = null;

function sendPing() {

  pingTimeout = setTimeout(function() {
    pingTimeout = null;
    if (connected) {
      connected = false;
      adapter.log.info('Disconnect');
      adapter.setState('info.connection', false, true);
    }
  }, 3000);

  try {
    server.send(commands.ping, 0, commands.ping.length, adapter.config.port, adapter.config.ip, function(err) {
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
function stateControl(value){
  if(value && stateVal !== 5){
    sendMsg(com.start.method);
    setTimeout(function() {
      sendMsg(com.get_status.method);
    }, 500);
  }else if (!value && stateVal == 5){
    sendMsg(com.pause.method);
    setTimeout(function() {
      sendMsg(com.home.method);
    }, 1000);
  }
}

function reqestParams() {
  if (connected) {
    adapter.log.debug("request params all: " + adapter.config.param_pingInterval / 1000 + " Sec");

    sendMsg(com.get_status.method);


    setTimeout(function() {
      sendMsg(com.get_consumable.method);
    }, 1000);

    setTimeout(function() {
      sendMsg(com.clean_summary.method);
    }, 2000);

    setTimeout(function() {
      if (!isEquivalent(log_entrys_new, log_entrys)) {
        log_entrys                = log_entrys_new;
        clean_log = [];
        clean_log_html_all_lines  = "";
        getLog(function() {
          adapter.setState('history.allTableJSON', JSON.stringify(clean_log), true);
          adapter.log.debug("CLEAN_LOGGING" + JSON.stringify(clean_log));
          adapter.setState('history.allTableHTML', clean_log_html_table, true);
        });
      }
    }, 3000);
  }
}


function sendMsg(method, params, callback) {

  last_id[method] = packet.msgCounter;
  adapter.log.debug('lastid' + JSON.stringify(last_id));

  var message_str = bulidMsg(method, params);

  try {
    var cmdraw = packet.getRaw_fast(message_str);

    server.send(cmdraw, 0, cmdraw.length, adapter.config.port, adapter.config.ip, function(err) {
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


function bulidMsg(method, params) {
  var message = {};
  if (method) {
    message.id = packet.msgCounter;
    message.method = method;
    if (!(params == "" || params == [""] || params == undefined)) {
      message.params = params;
    }
  } else {
    adapter.log.warn('Could not bulid message without arguments');
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


function getStates(message) {
  //Search id in answer
  clearTimeout(pingTimeout);
  pingTimeout = null;
  if (!connected) {
    connected = true;
    adapter.log.info('Connected');
    adapter.setState('info.connection', true, true);
  }
  var answer = JSON.parse(message);
  answer.id = parseInt(answer.id, 10);
  //var ans= answer.result;
  //adapter.log.info(answer.result.length);
  //adapter.log.info(answer['id']);

  if (answer.id === last_id["get_status"]) {
    adapter.setState('info.battery', answer.result[0].battery, true);
    adapter.setState('info.cleanedtime', Math.round(answer.result[0].clean_time / 60), true);
    adapter.setState('info.cleanedarea', Math.round(answer.result[0].clean_area / 10000) / 100, true);
    adapter.setState('control.fan_power', Math.round(answer.result[0].fan_power), true);
    adapter.setState('info.state', answer.result[0].state, true);
    stateVal=answer.result[0].state;
    if(stateVal === 5 || stateVal === "5"){
      adapter.setState('control.clean_home', true, true);
    }
    else{
      adapter.setState('control.clean_home', false, true);
    }
    adapter.setState('info.error', answer.result[0].error_code, true);
    adapter.setState('info.dnd', answer.result[0].dnd_enabled, true)
  } else if (answer.id === last_id["get_consumable"]) {

    adapter.setState('consumable.main_brush', 100 - (Math.round(answer.result[0].main_brush_work_time / 3600 / 3)), true);
    adapter.setState('consumable.side_brush', 100 - (Math.round(answer.result[0].side_brush_work_time / 3600 / 2)), true);
    adapter.setState('consumable.filter', 100 - (Math.round(answer.result[0].filter_work_time / 3600 / 1.5)), true);
    adapter.setState('consumable.sensors', 100 - (Math.round(answer.result[0].sensor_dirty_time / 3600 / 0.3)), true);
  } else if (answer.id === last_id["get_clean_summary"]) {

    adapter.setState('history.total_time', Math.round(answer.result[0] / 60), true);
    adapter.setState('history.total_area', Math.round(answer.result[1] / 1000000), true);
    adapter.setState('history.total_cleanups', Math.round(answer.result[2]), true);
    log_entrys_new = answer.result[3];
    //adapter.log.info("log_entrya" + JSON.stringify(log_entrys_new));
    //adapter.log.info("log_entry old" + JSON.stringify(log_entrys));


  } else if (answer.id === last_id["X_send_command"]) {
    adapter.setState('control.X_get_response', JSON.stringify(answer.result), true);

  } else if (answer.id === last_id["get_clean_record"]) {

    for (var j = 0; j < answer.result.length; j++) {
      var dates = new Date();
      var hour = "",
        min = "";
      dates.setTime(answer.result[j][0] * 1000);
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
          "Datum"   : dates.getDate() + "." + (dates.getMonth() + 1),
          "Start"   : hour + ":" + min,
          "Saugzeit": Math.round(answer.result[j][2] / 60) + " min",
          "Fläche"  : Math.round(answer.result[j][3] / 10000) / 100 + " m²",
          "Error"     :answer.result[j][4],
          "Ende"    :answer.result[j][5]
        };


    clean_log.push(log_data);
    clean_log_html_table = makeTable(log_data);


    }
  }
}


function getLog(callback) {

  var i = 0;

  function f() {

    if (log_entrys[i] != null || log_entrys[i] != "null") {
      sendMsg("get_clean_record", [log_entrys[i]], callback);
      adapter.log.debug("Request log entry: " + log_entrys[i]);

    } else {
      adapter.log.error("Clould not find log entry");
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

  html_line += "<td>" + line.Datum + "</td>" + "<td>" + line.Start + "</td>"+ '<td ALIGN="RIGHT">' + line.Saugzeit + "</td>"+ '<td ALIGN="RIGHT">' + line.Fläche + "</td>"+ '<td ALIGN="CENTER">' + line.Error + "</td>" + '<td ALIGN="CENTER">' + line.Ende + "</td>";

  html_line += "</tr>";

  clean_log_html_all_lines += html_line;

  table = "<table>" + clean_log_html_attr + clean_log_html_head + clean_log_html_all_lines + "</table>";

  return table;

}

function enabledExpert() {
  if (adapter.config.enableSelfCommands) {
    adapter.log.info('Expretmode enabled, states created');
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
    adapter.log.info('Expretmode disabled, states deleded');
    adapter.delObject('control.X_send_command');
    adapter.delObject('control.X_get_response');

  }

}
function enabledVoiceControl() {
  if (adapter.config.enableAlexa) {
    adapter.log.info('Crate state clean_home for controlling by cloud Adapter');

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

function checkSetTimeDiff(){
  var now = Math.round(parseInt((new Date().getTime()))/1000);//.toString(16)
  var MessageTime = parseInt(packet.stamprec.toString('hex'),16);
  if(firstSet && (MessageTime - now) !== 0)adapter.log.warn('Timedifference between Mihome Vacuum and ioBroker: '+( MessageTime -now)+ ' Sec');
  packet.timediff= MessageTime - now ;
  if(firstSet)firstSet= false;
}

function main() {
  adapter.setState('info.connection', false, true);
  adapter.config.port = parseInt(adapter.config.port, 10) || 54321;
  adapter.config.ownPort = parseInt(adapter.config.ownPort, 10) || 53421;
  adapter.config.pingInterval = parseInt(adapter.config.pingInterval, 10) || 20000;
  adapter.config.param_pingInterval = parseInt(adapter.config.param_pingInterval, 10) || 10000;

  // Abfrageintervall mindestens 10 sec.
  if (adapter.config.param_pingInterval < 10000) {
    adapter.config.param_pingInterval = 10000;
  }

  enabledExpert();
  enabledVoiceControl();
  if (!adapter.config.token) {
    adapter.log.error('Token not specified!');
    //return;
  }
  else{
    packet = new MiHome.Packet(str2hex(adapter.config.token));

    packet.msgCounter = 1000;

    commands = {
      ping: str2hex('21310020ffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    };
  }



  server.on('error', function(err) {
    adapter.log.error('UDP error: ' + err);
    server.close();
    process.exit();
  });


  server.on('message', function(msg, rinfo) {
    if (rinfo.port === adapter.config.port) {
      if (msg.length === 32) {
        adapter.log.debug('Receive <<< Helo <<< ' + msg.toString('hex'));
        packet.setRaw(msg);

        checkSetTimeDiff();

        clearTimeout(pingTimeout);
        pingTimeout = null;
        if (!connected) {
          connected = true;
          adapter.log.info('Connected');
          adapter.setState('info.connection', true, true);
        }

      } else {

        //hier die Antwort zum decodieren
        packet.setRaw(msg);
        adapter.log.debug('Receive <<< ' + packet.getPlainData() + "<<< " + msg.toString('hex'));
        getStates(packet.getPlainData());
      }
    }
  });

  server.on('listening', function() {
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
  param_pingInterval = setInterval(reqestParams, adapter.config.param_pingInterval);
  adapter.subscribeStates('*');




}
