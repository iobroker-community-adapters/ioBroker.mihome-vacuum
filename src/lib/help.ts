/**
 * The answer of the message `help`: what the instance answers, written for AI agents (e.g. ioBroker.pi-agent or
 * the MCP server with send_to) and script authors. Keep it in sync with `onMessage` in main.ts, `onMessage` in
 * lib/vacuum.ts and lib/stockCommands.ts.
 */

/**
 * Every command the instance answers; write = the command changes something; standard = the command follows the
 * shared catalog of sendTo commands (family robot, lib/robotCommands.ts)
 */
export const COMMANDS: { command: string; write: boolean; standard?: string }[] = [
    { command: 'help', write: false },
    // the commands of the shared catalog (lib/robotCommands.ts)
    { command: 'getRooms', write: false, standard: 'robot.getRooms' },
    { command: 'clean', write: true, standard: 'robot.clean' },
    { command: 'pause', write: true, standard: 'robot.pause' },
    { command: 'stop', write: true, standard: 'robot.stop' },
    { command: 'home', write: true, standard: 'robot.home' },
    { command: 'getStatus', write: false, standard: 'robot.getStatus' },
    // robot commands (lib/vacuum.ts)
    { command: 'cleanSegments', write: true },
    { command: 'cleanRooms', write: true },
    { command: 'cleanZone', write: true },
    { command: 'cleanSpot', write: true },
    { command: 'startVacuuming', write: true },
    { command: 'stopVacuuming', write: true },
    { command: 'charge', write: true },
    { command: 'findMe', write: true },
    { command: 'clearQueue', write: true },
    { command: 'getConsumableStatus', write: false },
    { command: 'resetConsumables', write: true },
    { command: 'getCleaningSummary', write: false },
    { command: 'getCleaningRecord', write: false },
    { command: 'getFanSpeed', write: false },
    { command: 'setFanSpeed', write: true },
    { command: 'getWaterBoxMode', write: false },
    { command: 'setWaterBoxMode', write: true },
    { command: 'getMopMode', write: false },
    { command: 'setMopMode', write: true },
    { command: 'getDNDTimer', write: false },
    { command: 'setDNDTimer', write: true },
    { command: 'deleteDNDTimer', write: true },
    { command: 'getMap', write: false },
    { command: 'getSerialNumber', write: false },
    { command: 'getDeviceDetails', write: false },
    { command: 'startRemoteControl', write: true },
    { command: 'move', write: true },
    { command: 'stopRemoteControl', write: true },
    { command: 'sendCustomCommand', write: true },
    { command: 'get_prop', write: false },
    // the commands of the states control.* (lib/stockCommands.ts), sent without a value
    { command: 'find', write: true },
    { command: 'start', write: true },
    { command: 'get_status', write: false },
    { command: 'get_consumable', write: false },
    { command: 'get_carpet_mode', write: false },
    { command: 'get_sound_volume', write: false },
    { command: 'sound_volume', write: true },
    { command: 'sound_volume_test', write: true },
    { command: 'fan_power', write: true },
    { command: 'mop_mode', write: true },
    { command: 'water_box_mode', write: true },
    { command: 'clean_summary', write: false },
    { command: 'miIO_info', write: false },
    { command: 'clean_record', write: false },
    { command: 'filter_reset', write: true },
    { command: 'sensors_reset', write: true },
    { command: 'main_brush_reset', write: true },
    { command: 'mop_pad_reset', write: true },
    { command: 'side_brush_reset', write: true },
    { command: 'water_filter_reset', write: true },
    { command: 'strainer_reset', write: true },
    { command: 'cleaner_filter_reset', write: true },
    { command: 'dust_collection_reset', write: true },
    { command: 'spotclean', write: true },
    { command: 'resumeZoneClean', write: true },
    { command: 'resumeRoomClean', write: true },
    { command: 'loadRooms', write: false },
    { command: 'loadMap', write: false },
    { command: 'startDustCollect', write: true },
    { command: 'stopDustCollect', write: true },
    { command: 'startWashMop', write: true },
    { command: 'stopWashMop', write: true },
    // adapter commands (main.ts)
    { command: 'getTimers', write: false },
    { command: 'saveTimers', write: true },
    { command: 'discovery', write: true },
    { command: 'startCloudLogin', write: true },
    { command: 'getProtectedConfigStatus', write: false },
    { command: 'saveConfig', write: true },
    { command: 'send', write: false },
];

export const HELP = `ioBroker.mihome-vacuum: controls a Xiaomi, Roborock, Viomi or Dreame vacuum robot in the local network (miIO).
An agent can clean rooms, zones, a spot or everything, pause, send the robot home, find it, and read its status,
consumables and cleaning history.
The robot commands work only with Roborock robots (state deviceInfo.model roborock.* or rockrobo.*); other robots
answer {error: {code, message}}: control them with the states. A robot command answers the raw answer of the robot
({id, result} or {error: {code, message}}); an empty answer means taken or queued: watch info.state. A cleaning
started while another one runs waits in the queue (info.queue) and starts when the robot is idle or docked.
getRooms, clean, pause, stop, home and getStatus follow the shared catalog of sendTo commands (family robot, the
same for all robot adapters) and answer {error: text, reason} on failure instead: reason NOT_CONNECTED, TIMEOUT,
NOT_SUPPORTED (not a Roborock robot; getRooms works with all), ROBOT_ERROR (the robot refused; code = its error
code), NOT_FOUND, AMBIGUOUS (both with candidates) or COMMAND_FAILED.

Rooms: the robot reports its rooms as the channels mihome-vacuum.0.rooms.<room> (named by the robot's room ID until
the user renames them; manual_* = added by hand); rooms.<room>.mapIndex holds the segment number or the zone
coordinates. The user assigns these channels to the ioBroker rooms (enum.rooms.*): look there for "the kitchen".

Commands (sendTo mihome-vacuum.0):
- getRooms {}: {rooms: [{id, name, room?, segment? | zone?}]}: the room channels the robot can clean; name = the
  ioBroker room the channel is assigned to, else the name of the channel; room = the ID of that ioBroker room.
- clean {rooms?, fanSpeed?, waterBoxMode?, waterBoxLevel?, mopMode?, repeat?}: without rooms cleans everything
  (startVacuuming); rooms = names or IDs of getRooms, ioBroker room IDs or names, or segment numbers (a list or
  "a,b"); the options as for cleanSegments. Answer {ok: true, rooms: [names]} (all: true without rooms), pending: true
  while it waits in the queue behind a running cleaning. Errors: reason NOT_FOUND or AMBIGUOUS with candidates.
- pause {}: pauses. stop {}: stops where it is (stopVacuuming). home {}: back to the dock (charge). Answer {ok: true,
  ...the answer of the robot}.
- getStatus {}: {state: 'cleaning' | 'returning' | 'docked' | 'charging' | 'paused' | 'error' | 'idle', stateCode
  (as info.state), battery (%), error? (text of the robot's error code), room? (the rooms being cleaned), result:
  [{state, battery, error_code, clean_time (s), clean_area (mm²), fan_power, in_cleaning, ...}]}; the same values
  are in the states info.*.
- cleanSegments {rooms, fanSpeed?, waterBoxMode?, waterBoxLevel?, mopMode?, repeat?}: cleans rooms by segment
  number (rooms.<room>.mapIndex): rooms = a number, a list [16, 17] or "16,17" (or the message is just that).
  fanSpeed / waterBoxMode / waterBoxLevel / mopMode: a value of the states control.fan_power / water_box_mode /
  water_box_level / mop_mode (see their object), else the settings of the room (rooms.<room>.roomFanPower,
  roomWaterBoxMode, roomWaterBoxLevel, roomMopMode, repeat) apply; repeat = number of passes. Empty answer.
- cleanRooms {rooms}: cleans the room channels assigned to these ioBroker rooms: rooms = an enum ID like
  "enum.rooms.kitchen" or a list of them (a string message is taken as rooms); their mapIndex goes to cleanSegments (or
  cleanZone) with the settings of the rooms. Empty answer; nothing happens if no room channel belongs to them.
- cleanZone {coordinates, fanSpeed?, waterBoxMode?, waterBoxLevel?, mopMode?} or the coordinates alone: cleans
  zones of the map, coordinates = "[x1,y1,x2,y2,passes]", several as "[...],[...]" (map units, the dock is about
  at 25500,25500). Empty answer.
- cleanSpot {}: cleans around the robot. startVacuuming {}: cleans everything. stopVacuuming {}: stops cleaning.
- charge {}: back to the dock. findMe {}: the robot plays its locating sound. clearQueue {}: drops the waiting
  cleanings.
- getConsumableStatus {}: {result: [{main_brush_work_time, side_brush_work_time, filter_work_time,
  sensor_dirty_time, ...}]} = seconds in use. resetConsumables {consumable}: sets one of them to 0 after the part
  was replaced or cleaned, e.g. {consumable: "main_brush_work_time"}.
- getCleaningSummary {}: {result: [total seconds, total mm², count, [record ids]]} (newer robots: {clean_time,
  clean_area, clean_count, records}). getCleaningRecord {recordId}: one cleaning: {result: [[start, end (s since
  1970), duration (s), area (mm²), error, complete (1)]]} (newer robots: {begin, end, duration, area, ...}).
- getFanSpeed {} / setFanSpeed {fanSpeed}, getWaterBoxMode {} / setWaterBoxMode {waterBoxMode, waterBoxLevel? (only
  with mode 207)}, getMopMode {} / setMopMode {mopMode}: suction power, water flow, mop mode (values as the states
  control.fan_power, water_box_mode, mop_mode).
- getDNDTimer {} / setDNDTimer {startHour, startMinute, endHour, endMinute} / deleteDNDTimer {}: do not disturb.
- getTimers {}: the cleaning timers of the adapter, the ioBroker rooms and the room channels: {timers: [{id,
  enabled, day: ["0"-"6"], hour, minute, channels, rooms}], rooms: [{id, name}], channels: [{id, name}]}.
- getMap {}, getSerialNumber {}, getDeviceDetails {}: raw information of the robot.
- startRemoteControl {}, move {velocity, angularVelocity, duration, sequenceNumber}, stopRemoteControl {}: drive by
  hand.
- sendCustomCommand {method, params?}: any miIO command (experts only). get_prop: the message is the list of
  properties.
- find, start, get_status, get_consumable, get_carpet_mode, get_sound_volume, sound_volume, sound_volume_test,
  fan_power, mop_mode, water_box_mode, clean_summary, miIO_info, clean_record, filter_reset, sensors_reset,
  main_brush_reset, mop_pad_reset, side_brush_reset, water_filter_reset, strainer_reset, cleaner_filter_reset,
  dust_collection_reset, spotclean, resumeZoneClean, resumeRoomClean, loadRooms, loadMap, startDustCollect,
  stopDustCollect, startWashMop, stopWashMop: the robot command of the state of that name, sent without a value
  (so fan_power, mop_mode, water_box_mode, sound_volume do nothing useful: use the commands above or the states).
- saveTimers, discovery, startCloudLogin, getProtectedConfigStatus, saveConfig, send: for the settings, not for
  agents.

States (mihome-vacuum.0.*): info.state (status with texts), info.battery, info.error, info.queue,
info.cleanedarea, info.cleanedtime; control.start / pause / home / find / spotclean / clearQueue (true = do it),
control.clean_home (true cleans, false goes home), control.fan_power, control.goTo ("x,y": drive there),
control.zoneClean (coordinates as for cleanZone); rooms.<room>.roomClean (true cleans that room),
rooms.loadRooms (true reloads the rooms from the robot), rooms.addRoom (a segment number or "x1,y1,x2,y2" adds a
room channel by hand), rooms.multiRoomClean (true cleans every room channel assigned to it); consumable.*,
history.* (total_time, total_area, total_cleanups, allTableJSON).

How to talk to the user:
- Find the room first (enum.rooms and the room channels); if no channel belongs to it, ask the user and suggest
  assigning the channel to the room. Name rooms by name, not by segment number; times in local time.
- clean, pause, stop, home, findMe and the other cleaning commands only on the user's request. Before cleaning say
  what will be cleaned.
- resetConsumables, the *_reset commands, setDNDTimer, deleteDNDTimer, saveTimers, sendCustomCommand, move and the
  remote control: only on the user's explicit request.`;
