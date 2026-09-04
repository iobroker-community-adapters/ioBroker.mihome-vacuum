export interface VacuumTranslations {
    weekDaysFull: string[];
    notAvailable: string;
    nextTimer: string;
    loadRooms: string;
    cleanRoom: string;
    cleanMultiRooms: string;
    addRoom: string;
    waterBox_installed: string;
    waterBox_filter: string;
    waterBox_filter_reset: string;
    waitingPos: string;
}
export interface ActiveCleanState {
    name: string;
    resume?: string;
}
export declare const i18n: {
    weekDaysFull: string[];
    notAvailable: string;
    nextTimer: string;
    loadRooms: string;
    cleanRoom: string;
    cleanMultiRooms: string;
    addRoom: string;
    waterBox_installed: string;
    waterBox_filter: string;
    waterBox_filter_reset: string;
    waitingPos: string;
};
export declare const errorTexts: Record<number, string>;
export declare const cleanStates: {
    readonly Unknown: 0;
    readonly Initiating: 1;
    readonly Sleeping: 2;
    readonly Waiting: 3;
    readonly Remote: 4;
    readonly Cleaning: 5;
    readonly Back_toHome: 6;
    readonly ManuellMode: 7;
    readonly Charging: 8;
    readonly Charging_Error: 9;
    readonly Pause: 10;
    readonly SpotCleaning: 11;
    readonly InError: 12;
    readonly ShuttingDown: 13;
    readonly Updating: 14;
    readonly Docking: 15;
    readonly GoingToSpot: 16;
    readonly ZoneCleaning: 17;
    readonly RoomCleaning: 18;
    readonly DustCollecting: 22;
    readonly CleaningMop: 23;
    readonly GoingMopClean: 26;
};
export declare const activeCleanStates: Record<number, ActiveCleanState>;
export declare const defaultCarpetModeSettings: {
    enabled: number;
    stall_time: number;
    low: number;
    high: number;
    integral: number;
};
