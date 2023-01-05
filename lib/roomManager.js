'use strict';
let adapter = null;
let roomManager = null;
let i18n = null;

class RoomManager {
    constructor(adapterInstance, i18nInstance) {
        adapter = adapterInstance;
        i18n = i18nInstance;
        roomManager = this;
        this.stateRoomClean = {
            type: 'state',
            common: {
                name: i18n.cleanRoom,
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
                desc: 'Start Room Cleaning',
                smartName: i18n.cleanRooms
            },
            native: {}
        };
        this.stateRoomStatus = {
            type: 'state',
            common: {
                name: 'info',
                type: 'string',
                role: 'info',
                read: true,
                write: false,
                def: '',
                desc: 'Status of Cleaning'
            },
            native: {}
        };
        this.stateRoomRepeat = {
            type: 'state',
            common: {
                name: 'repeat',
                type: 'number',
                role: 'level.repeat',
                read: true,
                write: true,
                min: 1,
                max: 10,
                step: 1,
                def: 1,
                desc: 'number of iterations'
            },
            native: {}
        };        
        adapter.setObject('rooms.loadRooms', {
            type: 'state',
            common: {
                name: i18n.loadRooms,
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
                desc: 'loads id\'s from stored rooms'
            },
            native: {}
        });
        adapter.setObject('rooms.multiRoomClean', {
            type: 'state',
            common: {
                name: i18n.cleanMultiRooms,
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
                desc: 'clean all rooms, which are connected to this datapoint'
            },
            native: {}
        });
        adapter.setObject('rooms.addRoom', {
            type: 'state',
            common: {
                name: i18n.addRoom,
                type: 'string',
                role: 'value',
                read: true,
                write: true,
                desc: 'add roos manual with map Index or zone coordinates'
            },
            native: {}
            },
            (err, obj) => obj && adapter.setForeignState(obj.id, i18n.addRoom, true));

        adapter.getStates(adapter.namespace + '.rooms.*.mapIndex', (err, states) => {
            if (states) {
                for (let stateId in states) {
                    this.updateRoomStates(stateId.replace('.mapIndex', ''));                  
                }
            }
        });
    }

    /** Parses the answer of get_room_mapping  "result":[[16,"881001046149"],[17,"881001046154"],[18,"881001046142"],[19,"881001046148"] */
    processRoomMaping(response) {
        const rooms = {};
        let room;
        if (typeof response.result !== 'object') {
            return false;
        }

        for (let r in response.result) {
            room = response.result[r];
            if (room[1])
                rooms[room[1]] = room[0];
            else
                adapter.log.warn('empty roomid for segment ' + room[0]);
        }
        adapter.getChannelsOf('rooms', function(err, roomObjs) {
            for (let r in roomObjs) {
                let roomObj = roomObjs[r];
                let extRoomId = roomObj._id.split('.').pop();
                if (extRoomId.indexOf('manual_') === -1) {
                    room = rooms[extRoomId];
                    if (!room) {
                        adapter.setStateChanged(roomObj._id + '.mapIndex', i18n.notAvailable, true, (err,id,notChanged) => {
                            if (!notChanged){
                                adapter.log.info('room: ' + extRoomId + ' not mapped');
                                adapter.setState(roomObj._id + '.state', i18n.notAvailable, true);
                            }
                        });
                    } else {
                        const roomNo= parseInt(room,10);
                        adapter.setStateChanged(roomObj._id + '.mapIndex', roomNo, true, (err,id,notChanged) => {
                            if (!notChanged){
                                adapter.log.info('room: ' + extRoomId + ' mapped with index ' + roomNo);
                                roomManager.updateRoomStates(roomObj._id);
                            }
                        });
                        delete rooms[extRoomId];
                    }
                }
            }
            for (let extRoomId in rooms) {
                adapter.getObject('rooms.' + extRoomId, function (err, roomObj) {
                    if (roomObj)
                        adapter.setStateChanged(roomObj._id + '.mapIndex', rooms[extRoomId], true);
                    else
                        roomManager.createRoom(extRoomId, rooms[extRoomId]);
                });
            }
        });
    }

    cleanRooms(mapIndexStates) {
        adapter.getForeignStates(mapIndexStates, function (err, states) {
            let mapIndex = [];
            let zones = [];
            let mapChannels= [];
            let zoneChannels= [];
            if (states) {
                for (let stateId in states) {
                    if (stateId.indexOf('.mapIndex') > 0) {
                        let val = (states[stateId] && states[stateId].val) || 'invalid';
                        if (!isNaN(val))
                            mapIndex.indexOf(parseInt(val,10)) === -1 && mapIndex.push(val) && mapChannels.push(stateId.replace(/\.([^.]+)$/,''));
                        else if (val[0] === '[')
                             zones.indexOf(val) === -1 && zones.push(val) && zoneChannels.push(stateId.replace(/\.([^.]+)$/,''));
                        else
                            adapter.log.error('could not clean ' + stateId + ', because mapIndex/zone is invalid: ' + val)
                    } else
                        adapter.log.error('state must be .mapIndex for roomManager.cleanRooms ' + stateId)
                }
                if (mapIndex.length > 0) {
                    adapter.sendTo(adapter.namespace, 'cleanSegments', {segments: mapIndex, channels:mapChannels});
                }
                if (zones.length > 0) {
                    adapter.sendTo(adapter.namespace, 'cleanZone', {zones: zones, channels:zoneChannels})
                }
            }
        });
    }

    // search for assigned roomObjs or id on timer or other state
    cleanRoomsFromState(id){
        adapter.getForeignObjects(id, 'state', 'rooms', (err, states) => {
            if (states && states[id].native) {
                let mapIndex = [];
                if (states[id].native.channels) {
                    for (let i in states[id].native.channels) {
                        mapIndex.push(adapter.namespace.concat('.rooms.', states[id].native.channels[i], '.mapIndex'))
                    }
                }
                let rooms = '';
                for (let r in states[id].enums) {
                    rooms += r;
                }

                if (rooms.length > 0) {
                    roomManager.findMapIndexByRoom(rooms, states =>
                        roomManager.cleanRooms(mapIndex.concat(states)));
                } else if (mapIndex.length > 0) {
                    roomManager.cleanRooms(mapIndex);
                } else {
                    adapter.log.warn('no room found for ' + id)
                }
            }
        })
    }

    findMapIndexByRoom(rooms, callback) {
        adapter.getForeignObjects(adapter.namespace + '.rooms.*.mapIndex', 'state', 'rooms', (err, states) => {
            if (states) {
                let mapIndexStates = [];
                for (let stateId in states) {
                    for (let r in states[stateId].enums) {
                        if (rooms.indexOf(r) >= 0 && stateId.indexOf('.mapIndex') > 0) {// bug in js-controller 1.5, that not only mapIndex in states
                            mapIndexStates.push(stateId);
                        }
                    }
                }
                callback && callback(mapIndexStates);
            }
        });
    }

    findChannelsByMapIndex(mapList, callback) {
        adapter.getStates('rooms.*.mapIndex', (err, states) => {
            let channels = [];
            if (states) {
                for (let stateId in states) {
                    if (states[stateId] && mapList.indexOf(states[stateId].val) >= 0) {
                        channels.push(stateId.replace(/\.([^.]+)$/,''))
                    }
                }
            }
            callback && callback(channels)
        });
    }

    createRoom(roomId, mapIndex) {
        adapter.log.info('create new room: ' + roomId);
        adapter.createChannel('rooms', roomId, (err, roomObj) => {
            if (roomObj) {
                adapter.setObjectNotExists( roomObj.id + '.mapIndex', {
                    type: 'state',
                    common:
                    mapIndex[0] === '['
                        ? {
                            name: 'map zone',
                            type: 'string',
                            role: 'value',
                            read: false,
                            write: false,
                            desc: 'coordinates of map zone'
                        }
                        : {
                            name: 'map index',
                            type: 'number',
                            role: 'value',
                            read: false,
                            write: false,
                            desc: 'index of assigned map'
                        },
                    native: {}
                },
                    err => !err && adapter.setState(roomObj.id + '.mapIndex', mapIndex, true));
                this.updateRoomStates(roomObj.id);
            }
        });
    }

    updateRoomStates(roomObj_id){
        adapter.setObjectNotExists(roomObj_id + '.roomClean', roomManager.stateRoomClean);
        adapter.setObjectNotExists(roomObj_id + '.state', roomManager.stateRoomStatus, () =>
            adapter.setForeignState(roomObj_id + '.state', '', true));
        adapter.setObjectNotExists(roomObj_id + '.repeat', roomManager.stateRoomRepeat);
        adapter.getObject('control.fan_power', (err, obj) => {
            obj && adapter.getState(obj._id, (err, comonState) => {
                adapter.setObjectNotExists(roomObj_id + '.roomFanPower', {
                    type: 'state',
                    common: obj.common,
                    native: {}
                },
                err => !err && comonState && adapter.setState(roomObj_id + '.roomFanPower', comonState.val, false));
            });
        });
        adapter.getObject('control.water_box_mode', (err, obj) => {
            obj && adapter.getState(obj._id, (err, comonState) => {
                adapter.setObjectNotExists(roomObj_id + '.roomWaterBoxMode', {
                    type: 'state',
                    common: obj.common,
                    native: {}
                },
                err => !err && comonState && adapter.setState(roomObj_id + '.roomWaterBoxMode', comonState.val, false));
            });
        });
        adapter.getObject('control.mop_mode', (err, obj) => {
            obj && adapter.getState(obj._id, (err, comonState) => {
                adapter.setObjectNotExists(roomObj_id + '.roomMopMode', {
                    type: 'state',
                    common: obj.common,
                    native: {}
                },
                err => !err && comonState && adapter.setState(roomObj_id + '.roomMopMode', comonState.val, false));
            });
        });
        adapter.getObject('control.mop_mode', (err, obj) => {
            obj && adapter.getState(obj._id, (err, comonState) => {
                adapter.setObjectNotExists(roomObj_id + '.roomMopMode', {
                    type: 'state',
                    common: obj.common,
                    native: {}
                },
                err => !err && comonState && adapter.setState(roomObj_id + '.roomMopMode', comonState.val, false));
            });
        });               
    }
}

module.exports = RoomManager;
