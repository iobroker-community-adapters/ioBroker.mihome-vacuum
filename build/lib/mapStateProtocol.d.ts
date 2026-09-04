import type { FallbackRoom, GoToCoordinates, MapRoomId, MapZones } from '../types/mapStateProtocol';
export declare function createFallbackRooms(roomIds: MapRoomId[]): FallbackRoom[];
export declare function shouldUpdateZones(zones: MapZones | undefined, lastZones: MapZones): boolean;
export declare function createZoneStateValue(zones: MapZones): string;
export declare function shouldUpdateGoTo(goTo: GoToCoordinates | undefined, lastGoTo: GoToCoordinates): boolean;
export declare function createGoToStateValue(goTo: GoToCoordinates): string;
