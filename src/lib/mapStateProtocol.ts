import type { FallbackRoom, GoToCoordinates, MapRoomId, MapZones } from '../types/mapStateProtocol';

export function createFallbackRooms(roomIds: MapRoomId[]): FallbackRoom[] {
    return roomIds.map(roomId => [roomId, `room${roomId}`]);
}

export function shouldUpdateZones(zones: MapZones | undefined, lastZones: MapZones): boolean {
    return typeof zones !== 'undefined' && zones.length > 0 && zones[0][0] !== lastZones[0][0];
}

export function createZoneStateValue(zones: MapZones): string {
    const normalizedZones: MapZones = [];
    zones.forEach(zone => {
        zone.push(1);
        normalizedZones.push(zone);
    });
    const serialized = JSON.stringify(normalizedZones);
    return serialized.substring(1, serialized.length - 1);
}

export function shouldUpdateGoTo(goTo: GoToCoordinates | undefined, lastGoTo: GoToCoordinates): boolean {
    return typeof goTo !== 'undefined' && goTo.length > 0 && goTo[0] !== lastGoTo[0];
}

export function createGoToStateValue(goTo: GoToCoordinates): string {
    return goTo.join();
}
