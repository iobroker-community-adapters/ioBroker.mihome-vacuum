import type { AdapterTimeout } from './adapter';
export interface TimerTranslations {
    nextTimer: string;
    notAvailable: string;
    weekDaysFull: string[];
}
export interface TimerObject {
    _id: string;
    native: {
        nextProcessTime?: Date | string | number;
        channels?: string[];
    };
    common: {
        name: string;
        states: Record<string, string>;
    };
}
export interface TimerState {
    val: unknown;
}
export interface TimerRoomObject {
    _id: string;
    common: {
        name: string;
    };
}
export interface TimerAdapter {
    namespace: string;
    config: {
        pingInterval: number;
    };
    log: {
        debug(message: string): void;
        info(message: string): void;
        warn(message: string): void;
    };
    formatDate(date: Date, format: string): string;
    setTimeout: (callback: () => void, delay: number) => AdapterTimeout | undefined;
    clearTimeout: (timeout: AdapterTimeout | undefined) => void;
    setObjectNotExists(id: string, object: unknown): void;
    extendObject(id: string, object: unknown): void;
    setState(id: string, value: unknown, acknowledge: boolean): void;
    setForeignState(id: string, value: unknown, acknowledge: boolean, callback: (error: unknown, object?: unknown) => void): void;
    getChannelsOf(channel: string, callback: (error: unknown, objects: TimerRoomObject[]) => void): void;
    getStatesOf(channel: string, callback: (error: unknown, objects: TimerObject[]) => void): void;
    getStates(pattern: string, callback: (error: unknown, states: Record<string, TimerState | null>) => void): void;
    supportsFeature?(feature: string): boolean;
    getPluginInstance?(name: string): {
        getSentryObject(): {
            captureException(error: unknown): void;
        };
    } | undefined;
}
