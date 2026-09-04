import type { RoomAdapter, RoomTranslations } from '../types/room';
declare class RoomManager {
    readonly adapter: RoomAdapter;
    readonly i18n: RoomTranslations;
    readonly stateRoomClean: any;
    readonly stateRoomStatus: any;
    readonly stateRoomRepeat: any;
    constructor(adapter: RoomAdapter, i18n: RoomTranslations);
    processRoomMaping(response: {
        result: unknown;
    }): false | void;
    cleanRooms(mapIndexStates: string[]): void;
    cleanRoomsFromState(id: string): void;
    findMapIndexByRoom(rooms: string, callback?: (states: string[]) => void): void;
    findChannelsByMapIndex(mapList: unknown[], callback?: (channels: string[]) => void): void;
    createRoom(roomId: string, mapIndex: string | number): Promise<void>;
    updateRoomStates(roomObjectId: string): Promise<void>;
}
export = RoomManager;
