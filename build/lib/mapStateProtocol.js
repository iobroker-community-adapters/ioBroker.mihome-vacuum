"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFallbackRooms = createFallbackRooms;
exports.shouldUpdateZones = shouldUpdateZones;
exports.createZoneStateValue = createZoneStateValue;
exports.shouldUpdateGoTo = shouldUpdateGoTo;
exports.createGoToStateValue = createGoToStateValue;
function createFallbackRooms(roomIds) {
    return roomIds.map(roomId => [roomId, `room${roomId}`]);
}
function shouldUpdateZones(zones, lastZones) {
    return typeof zones !== 'undefined' && zones.length > 0 && zones[0][0] !== lastZones[0][0];
}
function createZoneStateValue(zones) {
    const normalizedZones = [];
    zones.forEach(zone => {
        zone.push(1);
        normalizedZones.push(zone);
    });
    const serialized = JSON.stringify(normalizedZones);
    return serialized.substring(1, serialized.length - 1);
}
function shouldUpdateGoTo(goTo, lastGoTo) {
    return typeof goTo !== 'undefined' && goTo.length > 0 && goTo[0] !== lastGoTo[0];
}
function createGoToStateValue(goTo) {
    return goTo.join();
}
//# sourceMappingURL=mapStateProtocol.js.map