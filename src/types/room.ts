export interface RoomTranslations {
    cleanRoom: string;
    cleanRooms: string;
    loadRooms: string;
    cleanMultiRooms: string;
    addRoom: string;
    notAvailable: string;
}

export interface RoomState {
    val: string | number | boolean | null;
}

export interface RoomObject {
    _id: string;
    common: {
        name: unknown;
        [key: string]: unknown;
    };
    native: {
        channels?: string[];
        [key: string]: unknown;
    };
    enums: Record<string, unknown>;
}

export interface RoomAdapter {
    namespace: string;
    log: {
        info(message: string): void;
        warn(message: string): void;
        error(message: string): void;
    };
    setObjectNotExistsAsync(id: string, object: unknown): Promise<unknown>;
    setState(id: string, value: unknown, acknowledge: boolean): void;
    setStateAsync(id: string, value: unknown, acknowledge: boolean): Promise<unknown>;
    setStateChanged(
        id: string,
        value: unknown,
        acknowledge: boolean,
        callback?: (error: unknown, id?: string, notChanged?: boolean) => void,
    ): void;
    setForeignState(id: string, value: unknown, acknowledge: boolean): void;
    getStates(pattern: string, callback: (error: unknown, states?: Record<string, RoomState | null>) => void): void;
    getForeignStates(
        ids: string[],
        callback: (error: unknown, states?: Record<string, RoomState | null>) => void,
    ): void;
    getChannelsOf(channel: string, callback: (error: unknown, objects?: RoomObject[]) => void): void;
    getObject(id: string, callback: (error: unknown, object?: RoomObject | null) => void): void;
    getObjectAsync(id: string): Promise<{ common: Record<string, unknown> } | null | undefined>;
    getForeignObjects(
        pattern: string,
        type: string,
        enumName: string,
        callback: (error: unknown, objects?: Record<string, RoomObject>) => void,
    ): void;
    sendTo(instance: string, command: string, message: unknown): void;
}
