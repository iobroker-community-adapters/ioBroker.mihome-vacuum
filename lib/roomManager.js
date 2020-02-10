'use strict';
let adapter = null
let roomManager= null
let i18n= null

class RoomManager {
    constructor(adapterInstance, i18nInstance) {
        adapter= adapterInstance;
        i18n= i18nInstance;
        roomManager= this;
        this.stateRoomClean = {
            type: "state",
            common: {
                name: i18n.cleanRoom,
                type: "boolean",
                role: "button",
                read: false,
                write: true,
                desc: "Start Room Cleaning",
                smartName: i18n.cleanRooms
            },
            native: {}
        };
        adapter.setObject("rooms.loadRooms", {
            type: "state",
            common: {
                name: i18n.loadRooms,
                type: "boolean",
                role: "button",
                read: false,
                write: true,
                desc: "loads id's from stored rooms"
            },
            native: {}
        });
        adapter.setObject("rooms.multiRoomClean", {
            type: "state",
            common: {
                name: i18n.cleanMultiRooms,
                type: "boolean",
                role: "button",
                read: false,
                write: true,
                desc: "clean all rooms, which are connected to this datapoint"
            },
            native: {}
        });
        adapter.setObject("rooms.addRoom", {
            type: "state",
            common: {
                name: i18n.addRoom,
                type: "string",
                role: "value",
                read: true,
                write: true,
                desc: "add roos manual with map Index or zone coordinates"
            },
                native: {}
            }, function (err, obj) {
                obj && adapter.setForeignState(obj.id, i18n.addRoom, true);
        })
    }

    /** Parses the answer of get_room_mapping */
    processRoomMaping(response) {
        const rooms = {};
        let room;
        if (typeof response.result != "object")
            return false;
        for (let r in response.result) {
            room = response.result[r];
            rooms[room[1]] = room[0];
        }
        adapter.getChannelsOf("rooms", function(err, roomObjs) {
            for (let r in roomObjs) {
                let roomObj = roomObjs[r];
                let extRoomId = roomObj._id.split(".").pop();
                if (extRoomId.indexOf("manual_") == -1) {
                    room = rooms[extRoomId];
                    if (!room) {
                        adapter.log.info("room: " + extRoomId + " not mapped");
                        adapter.setState(roomObj._id + ".mapIndex", i18n.notAvailable, true );
                        adapter.delObject(roomObj._id + ".roomClean");
                    } else {
                        adapter.log.info("room: " + extRoomId + " mapped with index " + room)
                        adapter.setState(roomObj._id + ".mapIndex", room, true);
                        adapter.setObjectNotExists(roomObj._id + ".roomClean", roomManager.stateRoomClean);
                        delete rooms[extRoomId];
                    }
                }
            }
            for (let extRoomId in rooms) {
                adapter.getObject("rooms." + extRoomId, function (err, roomObj) {
                    if (roomObj)
                        adapter.setState(roomObj._id + ".mapIndex", rooms[extRoomId], true);
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
            if (states) {
                let stateId
                for (let stateId in states) {
                    if (stateId.indexOf('.mapIndex') > 0) {
                        let val = parseInt(states[stateId].val, 10);
                        if (!isNaN(val))
                            mapIndex.indexOf(val) == -1 && mapIndex.push(val);
                        else if (states[stateId].val[0] == "[")
                             zones.indexOf(states[stateId].val) == -1 && zones.push(states[stateId].val)
                        else
                            adapter.log.error("could not clean " + stateId + ", because mapIndex/zone is invalid -> " + states[stateId])
                    } else
                        adapter.log.error("state must be .mapIndex for roomManager.cleanRooms " + stateId)
                }
                if (mapIndexStates.length == 1) {
                    adapter.getState(mapIndexStates[0].replace('.mapIndex', '.roomFanPower'), function (err, fanPower) {
                        adapter.setState("control.fan_power", fanPower.val);
                    })
                }
                if (mapIndex.length > 0)
                    adapter.sendTo(adapter.namespace, "cleanSegments", mapIndex.join(","))
                if (zones.length > 0) {
                    adapter.sendTo(adapter.namespace, "cleanZone", zones.join(","))
                }
            }
        });
    }

    findMapIndexByRoom(rooms, callback) {
        adapter.getForeignObjects(adapter.namespace + '.rooms.*.mapIndex', 'state', 'rooms', function (err, states) {
            if (states){
                let mapIndexStates= [];
                for ( let stateId in states){
                    for ( let r in states[stateId].enums)
                        if (rooms.indexOf(r) >= 0 && stateId.indexOf('.mapIndex') > 0) // bug in js-controller 1.5, that not only mapIndex in states
                            mapIndexStates.push(stateId)
                }
                callback && callback(mapIndexStates)
            } 
        });
    }

    createRoom(roomId, mapIndex) {
        adapter.log.info("create new room: " + roomId);
        adapter.createChannel("rooms", roomId, function(err, roomObj) {
            if (roomObj) {
                adapter.setObjectNotExists( roomObj.id + ".mapIndex", {
                    type: "state",
                    common:
                    mapIndex[0] == "["
                        ? {
                            name: "map zone",
                            type: "string",
                            role: "value",
                            read: false,
                            write: false,
                            desc: "coordinates of map zone"
                        }
                        : {
                            name: "map index",
                            type: "number",
                            role: "value",
                            read: false,
                            write: false,
                            desc: "index of assigned map"
                        },
                    native: {}
                }, function(err, obj) {
                    adapter.setState(obj.id, mapIndex, true);
                });

                adapter.setObjectNotExists( roomObj.id + ".roomClean", roomManager.stateRoomClean );
                adapter.getObject("control.fan_power", function(err, obj) {
                    obj && adapter.getState(obj._id, function(err, comonState) {
                    adapter.setObjectNotExists(roomObj.id + ".roomFanPower", {
                        type: "state",
                        common: obj.common,
                        native: {}
                        }, function(err, state) {
                            adapter.setState(state.id, comonState.val, !true);
                        });
                    });
                });
            }
        });
    }
}
module.exports= RoomManager